-- Remove as colunas `show_on_home` e `published` da tabela `projects`.
--
-- Decisão de produto: todos os projetos passam a aparecer na grade masonry
-- da Home. O admin deixa de ter controlo de "Mostrar na Home" e de
-- "Publicado" (qualquer save → deploy). Isto também elimina a divergência
-- que existia entre:
--   - `/api/projects/export` (usado pelo build Jekyll) com filtro `published=1`,
--   - `/api/projects` (usado pelo admin) sem filtro,
-- garantindo que a aba Projetos do admin espelhe exactamente a Home.
--
-- Compatibilidade SQLite/D1: `ALTER TABLE DROP COLUMN` está disponível
-- desde SQLite 3.35.0 (Março 2021). A versão do libSQL do Cloudflare D1
-- suporta-o. O índice `idx_projects_published` tem de ser apagado primeiro
-- (SQLite bloqueia o DROP COLUMN enquanto existir um índice sobre ela).

DROP INDEX IF EXISTS idx_projects_published;

ALTER TABLE projects DROP COLUMN show_on_home;
ALTER TABLE projects DROP COLUMN published;
