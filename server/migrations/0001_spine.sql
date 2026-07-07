-- 0001_spine.sql — SPEC-SPINE §2 field-level contracts + §7 extras
-- (entity_maps, gate_items, sync_status). Conventions per §1: prefixed ULID
-- text ids, workspace_id on every table, money in integer cents, timestamptz.

-- ── enums ──────────────────────────────────────────────────────────────────
CREATE TYPE practice_type AS ENUM
  ('dental','chiro','physio','osteo','specialist','podiatry','optometry','tcm','psych','vet');
CREATE TYPE lifecycle AS ENUM
  ('prospect','onboarding','build','launch','operate','grow','at_risk','offboarding','archived');
CREATE TYPE contact_role AS ENUM
  ('owner','practice_manager','front_desk','billing','clinician');
CREATE TYPE event_type AS ENUM
  ('FLAG','EMAIL_IN','EMAIL_OUT','CALL','SMS','MEETING','TASK','PUBLISH','REPORT',
   'INVOICE','PAYMENT','REVIEW','EDIT','APPROVAL','NOTE','SYSTEM');
CREATE TYPE event_source AS ENUM
  ('gmail','voice','fathom','ads','seo','cms','portal','xero','stripe','manual','skill');
CREATE TYPE visibility AS ENUM ('agency_only','client_visible');
CREATE TYPE request_status AS ENUM ('new','triaged','in_progress','waiting_client','done','filed');
CREATE TYPE request_source AS ENUM ('email','portal','phone','meeting');
CREATE TYPE sla_state AS ENUM ('ok','at_risk','breached');
CREATE TYPE workflow AS ENUM ('W1','W2','W3','W4','W5','W6','W7','W8','sales','system');
CREATE TYPE severity AS ENUM ('info','amber','red');
CREATE TYPE flag_state AS ENUM ('open','watching','snoozed','resolved');
CREATE TYPE deal_stage AS ENUM ('cold','warm','meeting','proposal','won','lost');
CREATE TYPE metric_source AS ENUM ('ads','seo','ga4','calls','forms','reviews');
CREATE TYPE sync_state AS ENUM ('ok','stale','error');
CREATE TYPE gate_level AS ENUM ('G0','G1','G2','G3');
CREATE TYPE gate_outcome AS ENUM ('auto','approved','edited','rejected','expired');
CREATE TYPE gate_state AS ENUM ('pending','approved','edited','rejected','expired','auto');
CREATE TYPE actor_type AS ENUM ('human','skill','system');

-- ── updated_at trigger ──────────────────────────────────────────────────────
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ── tables ──────────────────────────────────────────────────────────────────
CREATE TABLE workspaces (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL, -- self-reference by convention: every table carries it
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (workspace_id = id)
);

CREATE TABLE clients (
  id                   text PRIMARY KEY,
  workspace_id         text NOT NULL REFERENCES workspaces(id),
  slug                 text NOT NULL,
  name                 text NOT NULL,
  practice_type        practice_type NOT NULL,
  lifecycle            lifecycle NOT NULL DEFAULT 'prospect',
  health_score         int,
  health_annotations   jsonb NOT NULL DEFAULT '{}',
  owner_user_id        text,
  timezone             text NOT NULL DEFAULT 'Australia/Melbourne',
  languages            text[] NOT NULL DEFAULT '{en}',
  plan                 jsonb NOT NULL DEFAULT '{}',
  autonomy             jsonb NOT NULL DEFAULT '{}',
  guarantee_started_at timestamptz,
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
CREATE TRIGGER clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE contacts (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id),
  client_id     text NOT NULL REFERENCES clients(id),
  name          text NOT NULL,
  email         text[] NOT NULL DEFAULT '{}',
  phone         text[] NOT NULL DEFAULT '{}',
  role          contact_role,
  portal_access boolean NOT NULL DEFAULT false,
  is_vip        boolean NOT NULL DEFAULT false,
  language_pref text,
  notify_prefs  jsonb NOT NULL DEFAULT '{}',
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER contacts_updated BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX contacts_client ON contacts (client_id);

-- Append-only: UPDATE/DELETE revoked from app_user below.
CREATE TABLE timeline_events (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  client_id    text NOT NULL REFERENCES clients(id),
  type         event_type NOT NULL,
  occurred_at  timestamptz NOT NULL,
  title        text NOT NULL,
  body         text,
  payload      jsonb NOT NULL DEFAULT '{}',
  source       event_source NOT NULL,
  source_ref   text,
  visibility   visibility NOT NULL DEFAULT 'agency_only',
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX timeline_client_time ON timeline_events (client_id, occurred_at DESC);
CREATE INDEX timeline_type ON timeline_events (type);
CREATE INDEX timeline_payload ON timeline_events USING GIN (payload);

CREATE TABLE requests (
  id             text PRIMARY KEY,
  workspace_id   text NOT NULL REFERENCES workspaces(id),
  client_id      text NOT NULL REFERENCES clients(id),
  thread_id      text,
  type           text NOT NULL, -- SPEC-INBOX taxonomy owns the value set
  summary        text NOT NULL,
  status         request_status NOT NULL DEFAULT 'new',
  sla_due_at     timestamptz,
  confidence     numeric,
  source         request_source,
  task_ids       text[] NOT NULL DEFAULT '{}',
  missing_assets jsonb NOT NULL DEFAULT '[]',
  language       text,
  archived_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER requests_updated BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX requests_client ON requests (client_id, status);

CREATE TABLE flags (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  client_id    text NOT NULL REFERENCES clients(id),
  workflow     workflow NOT NULL,
  severity     severity NOT NULL,
  state        flag_state NOT NULL DEFAULT 'open',
  dedupe_key   text,
  title        text NOT NULL,
  diagnosis    jsonb NOT NULL DEFAULT '{}',
  task_id      text, -- FK added after tasks exists (circular)
  opened_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);
CREATE INDEX flags_client_state ON flags (client_id, state);
CREATE INDEX flags_dedupe ON flags (client_id, dedupe_key);

CREATE TABLE tasks (
  id                text PRIMARY KEY,
  workspace_id      text NOT NULL REFERENCES workspaces(id),
  client_id         text NOT NULL REFERENCES clients(id),
  external_ref      text, -- ActiveCollab id while AC is the surface
  title             text NOT NULL,
  assignee          text,
  due_at            timestamptz,
  status            text NOT NULL DEFAULT 'open',
  source_request_id text REFERENCES requests(id),
  source_flag_id    text REFERENCES flags(id),
  source_meeting_id text,
  sla_state         sla_state NOT NULL DEFAULT 'ok',
  archived_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- every task knows why it exists: exactly one source
  CHECK (num_nonnulls(source_request_id, source_flag_id, source_meeting_id) = 1)
);
CREATE TRIGGER tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX tasks_client ON tasks (client_id, status);

ALTER TABLE flags ADD CONSTRAINT flags_task_fk FOREIGN KEY (task_id) REFERENCES tasks(id);

CREATE TABLE deals (
  id                   text PRIMARY KEY,
  workspace_id         text NOT NULL REFERENCES workspaces(id),
  client_id            text REFERENCES clients(id), -- nullable until won
  name                 text NOT NULL,
  stage                deal_stage NOT NULL DEFAULT 'cold',
  source_channel       text,
  value_estimate_cents int,
  audit_url            text,
  stage_history        jsonb NOT NULL DEFAULT '[]',
  lost_reason          text,
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER deals_updated BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reports and health read ONLY from here, never live APIs (§2).
CREATE TABLE metrics_daily (
  workspace_id text NOT NULL REFERENCES workspaces(id),
  client_id    text NOT NULL REFERENCES clients(id),
  date         date NOT NULL,
  source       metric_source NOT NULL,
  metric       text NOT NULL,
  value        numeric NOT NULL,
  meta         jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (client_id, date, source, metric)
);

CREATE TABLE sync_status (
  workspace_id text NOT NULL REFERENCES workspaces(id),
  client_id    text NOT NULL REFERENCES clients(id),
  source       metric_source NOT NULL,
  last_ok_at   timestamptz,
  state        sync_state NOT NULL DEFAULT 'ok',
  detail       text,
  PRIMARY KEY (client_id, source)
);

CREATE TABLE skill_runs (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  skill        text NOT NULL,
  version      text NOT NULL,
  kb_versions  jsonb NOT NULL DEFAULT '{}',
  client_id    text REFERENCES clients(id),
  trigger      text,
  input_hash   text,
  output       jsonb,
  gate         gate_level NOT NULL,
  gate_outcome gate_outcome,
  gate_actor   text,
  tokens_in    int,
  tokens_out   int,
  cost_cents   int,
  latency_ms   int,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_runs_skill ON skill_runs (skill, created_at DESC);
CREATE INDEX skill_runs_client ON skill_runs (client_id, created_at DESC);

-- Human corrections become labelled examples (§2 skill_runs note).
CREATE TABLE precision_ledger (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  skill_run_id text NOT NULL REFERENCES skill_runs(id),
  skill        text NOT NULL,
  version      text NOT NULL,
  outcome      gate_outcome NOT NULL CHECK (outcome IN ('edited','rejected')),
  diff         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gate_items (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  skill_run_id text NOT NULL REFERENCES skill_runs(id),
  gate         gate_level NOT NULL,
  state        gate_state NOT NULL DEFAULT 'pending',
  payload      jsonb NOT NULL, -- the proposed action, frozen on approval
  diff         jsonb,
  expires_at   timestamptz,
  acted_by     text,
  acted_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gate_items_state ON gate_items (state, created_at);

-- Append-only, no updates ever (§2). UPDATE/DELETE revoked from app_user below.
CREATE TABLE audit_log (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  at           timestamptz NOT NULL DEFAULT now(),
  actor_type   actor_type NOT NULL,
  actor_id     text,
  action       text NOT NULL, -- verb.noun: ads.mutate, cms.publish, gate.approve…
  target_type  text,
  target_id    text,
  client_id    text REFERENCES clients(id),
  why          text,
  before_ref   text,
  after_ref    text,
  rollback_of  text,
  request_ip   inet
);
CREATE INDEX audit_client_time ON audit_log (client_id, at DESC);
CREATE INDEX audit_action ON audit_log (action);

CREATE TABLE notifications (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id),
  user_id       text NOT NULL,
  event_class   text NOT NULL,
  severity      severity NOT NULL,
  client_id     text REFERENCES clients(id),
  title         text NOT NULL,
  body          text,
  link          text,
  channels_sent jsonb NOT NULL DEFAULT '[]',
  read_at       timestamptz,
  coalesce_key  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, read_at, created_at DESC);

-- The matcher learns: queue choices become mapping rows (§3).
CREATE TABLE entity_maps (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  kind         text NOT NULL, -- phone_did | email | domain | ads_account | brightlocal | gbp | ac_project | thread
  external_key text NOT NULL,
  client_id    text NOT NULL REFERENCES clients(id),
  learned_from text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, kind, external_key)
);

-- ── app role: caps enforced in the database, not by the model ───────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- append-only surfaces
REVOKE UPDATE, DELETE ON timeline_events FROM app_user;
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
