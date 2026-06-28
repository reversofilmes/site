-- Configurações globais do site (Hero, etc.)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('hero_video', NULL);

-- Se a chave legada 'hero_video_poster' existir (migrations antigas), remove-a.
DELETE FROM site_settings WHERE key = 'hero_video_poster';
