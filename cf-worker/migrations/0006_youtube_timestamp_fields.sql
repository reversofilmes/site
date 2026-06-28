-- Tempos (segundos) escolhidos no admin via YouTube IFrame API — usados em ingest (ffmpeg) e rascunho.
-- NULL = usar comportamento clássico (1º frame / 0s) no script local.

ALTER TABLE projects ADD COLUMN youtube_thumb_time_sec REAL;
ALTER TABLE projects ADD COLUMN youtube_preview_start_sec REAL;
