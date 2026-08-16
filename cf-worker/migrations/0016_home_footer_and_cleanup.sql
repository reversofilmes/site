-- Rodapé da Home (fechamento): imagem de fundo
INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('home_footer_bg', NULL);

-- Chaves legadas da equipe (substituídas por home_about_equipe JSON em 0015)
DELETE FROM site_settings WHERE key IN (
  'home_about_equipe_indio',
  'home_about_equipe_lele',
  'home_about_equipe_pedrada',
  'home_about_equipe_patrick',
  'home_about_equipe_calurina'
);
