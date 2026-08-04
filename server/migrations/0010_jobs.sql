-- 0010: background jobs.
--
-- Collecting a review is tens of seconds today and longer once a browser joins
-- it. That cannot live inside an HTTP request: the caller times out, a refresh
-- starts a second crawl of the same client's site, and a NUC restart loses the
-- work with no record it was ever asked for.
--
-- Deliberately a table and one in-process worker rather than Redis or a second
-- service. This is one box doing a handful of audits a day; a queue that needs
-- its own daemon is a second thing to keep alive for no gain.

CREATE TYPE job_state AS ENUM ('queued','running','done','failed','dead');

CREATE TABLE jobs (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  kind         text NOT NULL,                    -- 'review.collect'
  payload      jsonb NOT NULL DEFAULT '{}',
  state        job_state NOT NULL DEFAULT 'queued',
  attempts     int  NOT NULL DEFAULT 0,
  max_attempts int  NOT NULL DEFAULT 3,
  run_after    timestamptz NOT NULL DEFAULT now(),
  locked_at    timestamptz,
  locked_by    text,                             -- worker id, for stale-lock recovery
  last_error   text,
  -- One live job per subject. A second "collect this review" while the first is
  -- still running is a double-click, not a second instruction.
  dedupe_key   text,
  result       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

CREATE UNIQUE INDEX jobs_one_live_per_subject
  ON jobs (dedupe_key) WHERE dedupe_key IS NOT NULL AND state IN ('queued','running');

CREATE INDEX jobs_claimable ON jobs (state, run_after) WHERE state = 'queued';
CREATE INDEX jobs_recent    ON jobs (created_at DESC);

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
