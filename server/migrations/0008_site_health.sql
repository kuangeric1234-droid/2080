-- 0008: Site Health (§13 3.6) — one row per monitored client site.
CREATE TABLE site_health (
  id             text PRIMARY KEY,
  workspace_id   text NOT NULL REFERENCES workspaces(id),
  client_id      text REFERENCES clients(id),
  url            text NOT NULL,
  status         text NOT NULL DEFAULT 'unknown', -- up | degraded | down | unknown
  http_status    int,
  latency_ms     int,
  ssl_days_left  int,
  ssl_expires_at timestamptz,
  form_canary    text NOT NULL DEFAULT 'unknown', -- ok | fail | unknown (mocked until CMS forms)
  flags          jsonb NOT NULL DEFAULT '[]',
  checked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_health_client ON site_health (client_id);
