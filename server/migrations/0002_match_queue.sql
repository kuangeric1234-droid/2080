-- 0002_match_queue.sql — the entity matcher's human queue (SPEC-SPINE §3).
-- Events scoring 0.5–0.8 wait here; timeline_events.client_id is NOT NULL by
-- design, so unmatched events never touch the timeline. A resolution becomes
-- an entity_maps row — the matcher learns.

CREATE TABLE match_queue (
  id                 text PRIMARY KEY,
  workspace_id       text NOT NULL REFERENCES workspaces(id),
  refs               jsonb NOT NULL,           -- the identifying refs that were matched against
  event              jsonb NOT NULL,           -- the held timeline event, attached on resolve
  candidates         jsonb NOT NULL DEFAULT '[]',
  confidence         numeric,
  state              text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved','prospect','dismissed')),
  resolved_client_id text REFERENCES clients(id),
  resolved_by        text,
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_queue_state ON match_queue (state, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON match_queue TO app_user;
