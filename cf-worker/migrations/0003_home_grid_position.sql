-- Posição 2D fixa na grelha Home (canvas livre no admin, renderizada igual no site).
-- NULL = posição ainda não atribuída (fallback: Packery no cliente faz auto-layout).
ALTER TABLE projects ADD COLUMN home_col INTEGER;
ALTER TABLE projects ADD COLUMN home_row INTEGER;
