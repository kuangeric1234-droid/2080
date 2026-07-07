-- 0003_inbox.sql — raw inbound mail persistence (SPEC-INBOX §4: preserve raw
-- for the viewer; idempotent on message_id; the zero-loss audit reads this).

CREATE TABLE inbox_messages (
  id             text PRIMARY KEY,
  workspace_id   text NOT NULL REFERENCES workspaces(id),
  message_id     text NOT NULL,             -- provider message id (natural idempotency key)
  thread_id      text,
  from_email     text NOT NULL,
  to_email       text,
  subject        text,
  body_text      text,                      -- stripped new content (classification input)
  raw            jsonb NOT NULL DEFAULT '{}', -- full original for the viewer
  headers        jsonb NOT NULL DEFAULT '{}',
  received_at    timestamptz NOT NULL DEFAULT now(),
  -- received → (triaged | filed | held | error); filed/held carry a disposition
  state          text NOT NULL DEFAULT 'received'
                 CHECK (state IN ('received','triaged','filed','held','error')),
  disposition    text,                      -- autoreply | noise | spam | complaint | prospect | match_queue | unknown
  request_ids    text[] NOT NULL DEFAULT '{}',
  match_queue_id text,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, message_id)
);
CREATE INDEX inbox_messages_state ON inbox_messages (state, received_at DESC);
CREATE INDEX inbox_messages_thread ON inbox_messages (thread_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON inbox_messages TO app_user;
