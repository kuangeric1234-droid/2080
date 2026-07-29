-- 0005: SEC.1 auth foundation (SPEC-SECURITY §1).
-- Agency users get email + password (mandatory TOTP 2FA is SEC.2, magic-link
-- portal auth is SEC.5). Sessions are httpOnly-cookie backed, 12h idle / 7d absolute.

ALTER TABLE users
  ADD COLUMN email         text UNIQUE,
  ADD COLUMN password_hash text;

CREATE TABLE sessions (
  id                  text PRIMARY KEY,
  workspace_id        text NOT NULL REFERENCES workspaces(id),
  user_id             text NOT NULL REFERENCES users(id),
  token_hash          text NOT NULL,        -- sha256 of the opaque cookie token
  created_at          timestamptz NOT NULL DEFAULT now(),
  idle_expires_at     timestamptz NOT NULL, -- slides forward on each use
  absolute_expires_at timestamptz NOT NULL, -- hard ceiling
  revoked_at          timestamptz
);
CREATE INDEX sessions_token ON sessions (token_hash);
CREATE INDEX sessions_user ON sessions (user_id);
