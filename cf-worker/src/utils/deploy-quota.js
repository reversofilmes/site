export function quotaConfig(env) {
  const monthly = parseInt(env.NETLIFY_MONTHLY_CREDITS || '300', 10);
  const perDeploy = parseInt(env.NETLIFY_CREDITS_PER_DEPLOY || '15', 10);
  const cycleStart = String(env.NETLIFY_CYCLE_START || '').trim() || null;
  const cycleEnd = String(env.NETLIFY_CYCLE_END || '').trim() || null;
  const billingUrl =
    String(env.NETLIFY_BILLING_URL || '').trim() ||
    'https://app.netlify.com/teams/reversofilmes/billing';
  return { monthly, perDeploy, cycleStart, cycleEnd, billingUrl };
}

export function isCreditBlockError(status, bodyText) {
  if (status === 403 || status === 402 || status === 429) return true;
  const t = String(bodyText || '').toLowerCase();
  return (
    t.includes('credit') ||
    t.includes('usage exceeded') ||
    t.includes('operational credits') ||
    t.includes('build minutes') ||
    t.includes('deploy limit')
  );
}

function cycleStartSql(cfg) {
  if (cfg.cycleStart) return `${cfg.cycleStart} 00:00:00`;
  return null;
}

export async function clearDeployBlockIfCycleRenewed(env) {
  const cfg = quotaConfig(env);
  if (!cfg.cycleEnd) return false;

  const endMs = Date.parse(`${cfg.cycleEnd}T23:59:59Z`);
  if (!Number.isFinite(endMs) || Date.now() <= endMs) return false;

  const row = await env.DB.prepare(
    'SELECT blocked FROM deploy_quota_state WHERE id = 1',
  ).first();
  if (!row?.blocked) return false;

  await env.DB.prepare(
    `UPDATE deploy_quota_state
     SET blocked = 0, blocked_at = NULL, blocked_reason = NULL,
         blocked_http_status = NULL, updated_at = datetime('now')
     WHERE id = 1`,
  ).run();
  return true;
}

export async function setDeployBlocked(env, { reason, httpStatus }) {
  await env.DB.prepare(
    `UPDATE deploy_quota_state
     SET blocked = 1, blocked_at = datetime('now'), blocked_reason = ?,
         blocked_http_status = ?, updated_at = datetime('now')
     WHERE id = 1`,
  )
    .bind(reason || 'Créditos Netlify esgotados', httpStatus ?? null)
    .run();
}

export async function clearDeployBlock(env) {
  await env.DB.prepare(
    `UPDATE deploy_quota_state
     SET blocked = 0, blocked_at = NULL, blocked_reason = NULL,
         blocked_http_status = NULL, updated_at = datetime('now')
     WHERE id = 1`,
  ).run();
}

export async function isDeployBlocked(env) {
  await clearDeployBlockIfCycleRenewed(env);
  const row = await env.DB.prepare(
    'SELECT blocked FROM deploy_quota_state WHERE id = 1',
  ).first();
  return !!row?.blocked;
}

export async function logDeployAttempt(env, { status, httpStatus = null, errorDetail = null }) {
  await env.DB.prepare(
    `INSERT INTO deploy_log (triggered_at, status, http_status, error_detail)
     VALUES (datetime('now'), ?, ?, ?)`,
  )
    .bind(status, httpStatus, errorDetail ? String(errorDetail).slice(0, 500) : null)
    .run();
}

export async function countSuccessfulDeploysSince(env, sinceSql) {
  if (!sinceSql) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM deploy_log WHERE status = 'success'`,
    ).first();
    return row?.n ?? 0;
  }
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM deploy_log
     WHERE status = 'success' AND triggered_at >= ?`,
  )
    .bind(sinceSql)
    .first();
  return row?.n ?? 0;
}

export async function getDeployQuotaStatus(env) {
  await clearDeployBlockIfCycleRenewed(env);
  const cfg = quotaConfig(env);
  const since = cycleStartSql(cfg);
  const deploysSuccess = await countSuccessfulDeploysSince(env, since);

  const state = await env.DB.prepare(
    `SELECT blocked, blocked_at, blocked_reason, blocked_http_status
     FROM deploy_quota_state WHERE id = 1`,
  ).first();

  const creditsEstimatedDeploys = deploysSuccess * cfg.perDeploy;
  const creditsRemainingEstimate = Math.max(0, cfg.monthly - creditsEstimatedDeploys);
  const deploysRemainingEstimate = Math.floor(creditsRemainingEstimate / cfg.perDeploy);

  const lastFailed = await env.DB.prepare(
    `SELECT triggered_at, http_status, error_detail FROM deploy_log
     WHERE status = 'failed' ORDER BY id DESC LIMIT 1`,
  ).first();

  return {
    blocked: !!state?.blocked,
    blocked_at: state?.blocked_at ?? null,
    blocked_reason: state?.blocked_reason ?? null,
    blocked_http_status: state?.blocked_http_status ?? null,
    cycle_start: cfg.cycleStart,
    cycle_end: cfg.cycleEnd,
    monthly_credits: cfg.monthly,
    credits_per_deploy: cfg.perDeploy,
    deploys_success_this_cycle: deploysSuccess,
    credits_estimated_deploys: creditsEstimatedDeploys,
    credits_remaining_estimate: creditsRemainingEstimate,
    deploys_remaining_estimate: deploysRemainingEstimate,
    last_failed_at: lastFailed?.triggered_at ?? null,
    last_failed_http_status: lastFailed?.http_status ?? null,
    note:
      'Estimativa baseada apenas nos deploys disparados por este painel (~15 créditos cada). ' +
      'Tráfego do site e outros usos também consomem créditos e não aparecem aqui.',
    billing_url: cfg.billingUrl,
  };
}
