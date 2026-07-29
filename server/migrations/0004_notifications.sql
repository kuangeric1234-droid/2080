-- 0004: notification routing (SPEC-SPINE §5).
-- Agency users are the routing targets. Full auth/roles are SPEC-SECURITY's job;
-- this is the minimal recipient + per-user-preference surface the router needs.

CREATE TABLE users (
  id                text PRIMARY KEY,
  workspace_id      text NOT NULL REFERENCES workspaces(id),
  name              text NOT NULL,
  role              text NOT NULL,            -- owner | seo | web | clinical
  quiet_start       int  NOT NULL DEFAULT 21, -- local hour, inclusive
  quiet_end         int  NOT NULL DEFAULT 7,  -- local hour, exclusive
  muted_classes     text[] NOT NULL DEFAULT '{}',   -- per-user routing: silence a class
  channel_overrides jsonb  NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- coalescing keeps a running count; escalation stamps when a red went unacked.
ALTER TABLE notifications
  ADD COLUMN count        int NOT NULL DEFAULT 1,
  ADD COLUMN escalated_at timestamptz,
  ADD COLUMN acked_by     text;
