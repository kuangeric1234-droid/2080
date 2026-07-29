-- 0007: on-demand site SEO audits (SPEC-SEO §4.2 technical/on-page evidence layer).
-- The report is the deterministic analysis; seo-diagnose adds narrative once the
-- model key lands. Rank monitoring (BrightLocal/GSC/GBP, §2) is a separate blocked track.
CREATE TABLE seo_audits (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  client_id    text REFERENCES clients(id),
  url          text NOT NULL,
  final_url    text,
  status       int,
  score        int  NOT NULL,
  grade        text NOT NULL,
  report       jsonb NOT NULL,
  requested_by text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seo_audits_recent ON seo_audits (created_at DESC);
CREATE INDEX seo_audits_client ON seo_audits (client_id, created_at DESC);
