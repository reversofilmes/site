-- Substitui 1x3 (muito alto) por 1x1.5 na grelha da Home.
UPDATE projects SET home_size = '1x1.5' WHERE home_size = '1x3';
