-- Migrate home_size values to new aspect-ratio-based format names
-- 1x0.5 (wide) -> 16x9
-- 1x1 stays 1x1
-- 1x1.5 (tall) -> randomly 9x16 or 4x5
UPDATE projects SET home_size = '16x9' WHERE home_size = '1x0.5';
UPDATE projects SET home_size = (
  CASE WHEN (abs(random()) % 2) = 0 THEN '9x16' ELSE '4x5' END
) WHERE home_size = '1x1.5';
