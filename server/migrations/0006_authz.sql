-- 0006: SEC.3 authorization. A stable per-user handle (WC/HK/IS/QG) is the
-- audit actor identity, derived from the session — never from the request body.
ALTER TABLE users ADD COLUMN handle text;
