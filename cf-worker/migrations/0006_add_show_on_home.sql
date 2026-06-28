-- Reintroduz visibilidade na Home (filtrar no Jekyll + admin).
-- Normaliza tamanhos legados: blocos 2 colunas/2x2 → 1x1 / 1x2.
ALTER TABLE projects ADD COLUMN show_on_home INTEGER NOT NULL DEFAULT 0;

UPDATE projects SET home_size = '1x1' WHERE home_size = '2x1';
UPDATE projects SET home_size = '1x2' WHERE home_size = '2x2';
