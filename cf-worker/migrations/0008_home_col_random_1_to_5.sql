-- home_col passa a ser 1–5 (coluna 1 = mais à esquerda). Não usar 0, NULL ou >5.
-- Atribui um valor aleatório em {1,2,3,4,5} a **todas** as linhas (incl. NULL/0/legado).
-- SQLite: random() 64-bit; abs(random()) % 5 dá 0..4; +1 dá 1..5.

UPDATE projects
SET home_col = (abs(random()) % 5) + 1;
