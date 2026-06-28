-- Corrige numeração da ordem na Home por coluna: de 0-based para 1-based (primeiro item = 1).
-- Executar uma única vez contra o D1 remoto (ou local) após deploy do código que assume order >= 1.
-- Não repetir: valores já 1-based ficariam incrementados de novo.
UPDATE projects SET "order" = "order" + 1 WHERE "order" IS NOT NULL;
