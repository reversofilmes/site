ALTER TABLE deploy_log ADD COLUMN status TEXT NOT NULL DEFAULT 'success';
ALTER TABLE deploy_log ADD COLUMN http_status INTEGER;
ALTER TABLE deploy_log ADD COLUMN error_detail TEXT;

CREATE TABLE IF NOT EXISTS deploy_quota_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  blocked INTEGER NOT NULL DEFAULT 0,
  blocked_at TEXT,
  blocked_reason TEXT,
  blocked_http_status INTEGER,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO deploy_quota_state (id) VALUES (1);
