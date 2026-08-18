#!/usr/bin/env node
/**
 * Migra service_types legado → category + service_types (novo modelo).
 *
 * Pré-requisito: migration 0017_project_category.sql aplicada.
 *
 * Uso (produção):
 *   node scripts/migrate-project-taxonomy.mjs --remote
 * Uso (local D1):
 *   node scripts/migrate-project-taxonomy.mjs
 *
 * Opções:
 *   --dry-run        só imprime alterações, não grava
 *   --remote         usa D1 remoto (reverso-db)
 *   --only-pending   migra só projetos sem category (retomar após falha)
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateLegacyTaxonomy } from '../src/utils/project-taxonomy.js';

const workerRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const remote = args.has('--remote');
const onlyPending = args.has('--only-pending');

const RETRY_ATTEMPTS = 5;
const RETRY_BASE_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wranglerD1(sql) {
  const sqlQuoted = `"${sql.replace(/"/g, '""')}"`;
  let cmd = `npx wrangler d1 execute reverso-db --json --command ${sqlQuoted}`;
  if (remote) cmd += ' --remote';
  const result = spawnSync(cmd, {
    cwd: workerRoot,
    encoding: 'utf8',
    shell: true,
  });
  if (result.status !== 0) {
    const err = new Error(result.stderr || result.stdout || 'wrangler d1 execute failed');
    err.stdout = result.stdout;
    err.stderr = result.stderr;
    throw err;
  }
  const out = result.stdout;
  const parsed = JSON.parse(out);
  const block = Array.isArray(parsed) ? parsed[0] : parsed;
  if (block?.error) {
    const err = new Error(block.error.text || JSON.stringify(block.error));
    err.code = block.error.code;
    err.cloudflare = block.error;
    throw err;
  }
  if (!block?.success) throw new Error(`Falha D1:\n${out}`);
  return block.results || [];
}

async function wranglerD1WithRetry(sql) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return wranglerD1(sql);
    } catch (err) {
      lastErr = err;
      const retryable =
        err.code === 7403
        || /not authorized|rate limit|429|503|timeout/i.test(String(err.message));
      if (!retryable || attempt === RETRY_ATTEMPTS) throw err;
      const waitMs = RETRY_BASE_MS * attempt;
      console.warn(`  ⚠ Tentativa ${attempt}/${RETRY_ATTEMPTS} falhou (${err.message}). Retentando em ${waitMs}ms…`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

async function main() {
  const rows = wranglerD1('SELECT slug, category, service_types FROM projects ORDER BY slug');

  const pending = onlyPending
    ? rows.filter((row) => !row.category || String(row.category).trim() === '')
    : rows;

  console.log(
    `Projetos a migrar: ${pending.length}${onlyPending ? ' (apenas pendentes)' : ''}${dryRun ? ' (dry-run)' : ''}`,
  );

  let updated = 0;
  let failed = 0;

  for (const row of pending) {
    const { category, service_types } = migrateLegacyTaxonomy(row.service_types);
    const svcJson = JSON.stringify(service_types);
    const catSql = category ? `'${sqlEscape(category)}'` : 'NULL';

    console.log(
      `  ${row.slug}\n    → category=${category ?? '(null)'}\n    → service_types=${svcJson}`,
    );

    if (!dryRun) {
      try {
        await wranglerD1WithRetry(
          `UPDATE projects SET category = ${catSql}, service_types = '${sqlEscape(svcJson)}' WHERE slug = '${sqlEscape(row.slug)}'`,
        );
        updated += 1;
        await sleep(250);
      } catch (err) {
        failed += 1;
        console.error(`  ✗ Falha ao migrar ${row.slug}: ${err.message}`);
      }
    }
  }

  if (onlyPending && pending.length === 0) {
    console.log('Nenhum projeto pendente.');
  } else if (dryRun) {
    console.log('Dry-run concluído.');
  } else {
    console.log(`Migração concluída: ${updated} atualizados, ${failed} falhas.`);
    if (failed > 0) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
