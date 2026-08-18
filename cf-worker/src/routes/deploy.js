import { json, error } from '../utils/response.js';
import { logAudit } from '../utils/audit.js';
import {
  getDeployQuotaStatus,
  isCreditBlockError,
  isDeployBlocked,
  logDeployAttempt,
  quotaConfig,
  setDeployBlocked,
  clearDeployBlock,
} from '../utils/deploy-quota.js';

const DEBOUNCE_MS = 5 * 60 * 1000;

/** URL do POST ao build hook com `trigger_branch` (Netlify sobrescreve a branch configurada na criação do hook). */
function netlifyDeployHookRequestUrl(rawUrl, branch) {
  const u = String(rawUrl || '').trim();
  if (!u) return null;
  const b = String(branch ?? 'main').trim() || 'main';
  try {
    const url = new URL(u);
    url.searchParams.set('trigger_branch', b);
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Lógica partilhada: POST ao build hook Netlify + deploy_log + audit.
 * Usada por POST /api/deploy e por rotas que devem disparar deploy sem depender do admin (ex. reorder).
 *
 * @returns {Promise<{ kind: 'triggered' } | { kind: 'skipped', message: string } | { kind: 'not_configured' } | { kind: 'invalid_hook_url' } | { kind: 'blocked', message: string } | { kind: 'netlify_error', status: number, body: string, creditBlock: boolean }>}
 */
export async function runDeployHook(env, ctx) {
  if (!env.NETLIFY_DEPLOY_HOOK_URL) {
    return { kind: 'not_configured' };
  }

  if (await isDeployBlocked(env)) {
    return {
      kind: 'blocked',
      message:
        'Deploy bloqueado: a Netlify rejeitou a última tentativa por falta de créditos. ' +
        'Confira o saldo no painel da Netlify ou aguarde a renovação do ciclo.',
    };
  }

  const hookUrl = netlifyDeployHookRequestUrl(
    env.NETLIFY_DEPLOY_HOOK_URL,
    env.NETLIFY_DEPLOY_BRANCH,
  );
  if (!hookUrl) {
    return { kind: 'invalid_hook_url' };
  }

  const last = await env.DB.prepare(
    `SELECT triggered_at FROM deploy_log
     WHERE status IN ('success', 'failed')
     ORDER BY id DESC LIMIT 1`,
  ).first();

  if (last) {
    const elapsed = Date.now() - new Date(last.triggered_at + 'Z').getTime();
    if (elapsed < DEBOUNCE_MS) {
      const waitSec = Math.ceil((DEBOUNCE_MS - elapsed) / 1000);
      const waitMin = Math.ceil(waitSec / 60);
      return {
        kind: 'skipped',
        message: `Atualização adiada: aguarde cerca de ${waitMin} min (intervalo mínimo entre deploys). Os dados já foram salvos.`,
      };
    }
  }

  const res = await fetch(hookUrl, { method: 'POST' });
  const body = await res.text().catch(() => '');

  if (!res.ok) {
    const creditBlock = isCreditBlockError(res.status, body);
    await logDeployAttempt(env, {
      status: 'failed',
      httpStatus: res.status,
      errorDetail: body,
    });
    if (creditBlock) {
      await setDeployBlocked(env, {
        reason: 'Créditos Netlify esgotados ou deploys pausados',
        httpStatus: res.status,
      });
    }
    return {
      kind: 'netlify_error',
      status: res.status,
      body,
      creditBlock,
    };
  }

  await logDeployAttempt(env, { status: 'success', httpStatus: res.status });

  logAudit(ctx, env.DB, {
    action: 'deploy', targetType: 'build', targetId: 'netlify',
  });

  return { kind: 'triggered' };
}

export async function handleDeployStatus(env) {
  const status = await getDeployQuotaStatus(env);
  return json(status);
}

export async function handleDeployQuotaReset(env, ctx) {
  await clearDeployBlock(env);
  logAudit(ctx, env.DB, {
    action: 'deploy_quota_reset', targetType: 'build', targetId: 'netlify',
  });
  const status = await getDeployQuotaStatus(env);
  return json({ cleared: true, ...status });
}

export async function handleDeploy(env, ctx) {
  const out = await runDeployHook(env, ctx);
  if (out.kind === 'not_configured') {
    return error('Deploy hook not configured', 500);
  }
  if (out.kind === 'invalid_hook_url') {
    return error('NETLIFY_DEPLOY_HOOK_URL is invalid', 500);
  }
  if (out.kind === 'blocked') {
    const status = await getDeployQuotaStatus(env);
    return json({ error: out.message, blocked: true, ...status }, 423);
  }
  if (out.kind === 'skipped') {
    return json({ skipped: true, message: out.message });
  }
  if (out.kind === 'netlify_error') {
    const status = await getDeployQuotaStatus(env);
    const msg = out.creditBlock
      ? 'Netlify rejeitou o deploy por falta de créditos ou limite de uso.'
      : `Netlify retornou HTTP ${out.status}`;
    return json(
      {
        error: msg,
        blocked: out.creditBlock,
        http_status: out.status,
        ...status,
      },
      out.creditBlock ? 423 : 502,
    );
  }
  const status = await getDeployQuotaStatus(env);
  return json({ triggered: true, ...status });
}
