-- Substitui 1x2 (muito alto) por 1x0.5 na grelha da Home.
UPDATE projects SET home_size = '1x0.5' WHERE home_size = '1x2';
