-- 0009: Online Presence Review (module 1) — the free SEO audit, industrialised.
--
-- Shape follows the report: a review holds eight category scores and an ordered
-- set of findings, each finding is one paragraph from the snippet bank, and no
-- finding exists without the signals that earned it. Signals and findings are
-- kept apart deliberately — signals are measurements (append-only, re-collectable),
-- findings are editorial decisions (the reviewer's, and auditable as theirs).

CREATE TYPE review_status AS ENUM
  ('requested','collecting','draft','in_review','delivered','failed');
CREATE TYPE finding_state AS ENUM ('candidate','accepted','rejected','edited');
CREATE TYPE signal_source AS ENUM ('crawl','render','dns','tls','http','archive','manual','judgement');

-- ── intake ─────────────────────────────────────────────────────────────────
-- The raw form submission, stored untouched. Parsed fields are a convenience
-- copy; `payload` is what actually arrived and is never rewritten, so a bad
-- parse can be re-run without asking the practice to submit again.
CREATE TABLE intake_requests (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id),
  source        text NOT NULL,              -- 'jotform' | 'manual' | later: 'wordpress'
  external_id   text,                       -- provider submission id — the idempotency key
  payload       jsonb NOT NULL,
  domain        text,
  practice_name text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  parse_error   text,
  received_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX intake_requests_recent ON intake_requests (received_at DESC);

-- ── the review ─────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id                text PRIMARY KEY,
  workspace_id      text NOT NULL REFERENCES workspaces(id),
  client_id         text REFERENCES clients(id),          -- null while still a prospect
  intake_request_id text REFERENCES intake_requests(id),
  domain            text NOT NULL,
  practice_name     text,
  practice_type     practice_type,
  suburb            text,
  contact_name      text,
  contact_email     text,
  status            review_status NOT NULL DEFAULT 'requested',
  bank_version      text NOT NULL DEFAULT 'v1',           -- which snippet bank wrote it
  category_scores   jsonb NOT NULL DEFAULT '{}',          -- {website_technical: 3, ...} 1..5
  overall_score     int CHECK (overall_score BETWEEN 1 AND 5),
  overall_comment   text,
  summary_text      text,                                 -- the generated opening paragraph
  collect_error     text,
  collected_at      timestamptz,
  delivered_at      timestamptz,
  requested_by      text,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_recent ON reviews (requested_at DESC);
CREATE INDEX reviews_client ON reviews (client_id, requested_at DESC);
CREATE INDEX reviews_status ON reviews (status);
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── evidence ───────────────────────────────────────────────────────────────
-- Append-only. Re-collecting a review writes new rows rather than mutating old
-- ones, so a delivered report can always be explained against the measurements
-- that existed when it was written. `target` is the domain measured — the
-- practice's own site, or a competitor's when the same checks run against them.
CREATE TABLE review_signals (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  review_id    text NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  target       text NOT NULL,               -- domain this measurement is about
  key          text NOT NULL,               -- 'site.https', 'render.body_font_px'
  value        jsonb,                       -- null means "checked, could not determine"
  source       signal_source NOT NULL,
  provenance   text NOT NULL,               -- how we know: the request, the header, the selector
  collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_signals_lookup
  ON review_signals (review_id, target, key, collected_at DESC);

-- ── findings ───────────────────────────────────────────────────────────────
-- One row per snippet that fired. `triggered_by` carries the signal keys that
-- earned it — this is the answer to "why does the report say that?", and the
-- app refuses to render an automatic finding whose array is empty.
CREATE TABLE review_findings (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id),
  review_id     text NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  snippet_id    text NOT NULL,
  bank_version  text NOT NULL DEFAULT 'v1',
  category      text NOT NULL,
  dimension     text NOT NULL,
  variant       text NOT NULL,              -- positive | negative | neutral
  weight        int  NOT NULL DEFAULT 0,
  state         finding_state NOT NULL DEFAULT 'candidate',
  rendered_text text NOT NULL,              -- snippet text with variables filled
  edited_text   text,                       -- set only when the reviewer overrides the house copy
  vars          jsonb NOT NULL DEFAULT '{}',
  triggered_by  jsonb NOT NULL DEFAULT '[]',
  ahpra_blocking boolean NOT NULL DEFAULT false,
  position      int NOT NULL DEFAULT 0,
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, snippet_id)
);
CREATE INDEX review_findings_order ON review_findings (review_id, category, position);

-- ── exhibits ───────────────────────────────────────────────────────────────
-- Screenshots that get embedded in the .docx: the homepage, the performance
-- report, the SERP. `finding_id` null means the exhibit belongs to the report
-- rather than to one paragraph.
CREATE TABLE review_exhibits (
  id           text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  review_id    text NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  finding_id   text REFERENCES review_findings(id) ON DELETE SET NULL,
  kind         text NOT NULL,               -- screenshot | performance_report | serp_screenshot
  label        text NOT NULL,
  path         text NOT NULL,               -- relative to the exhibit store
  width        int,
  height       int,
  position     int NOT NULL DEFAULT 0,
  captured_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_exhibits_review ON review_exhibits (review_id, position);

-- ── competitors ────────────────────────────────────────────────────────────
-- Feeds the comp.row template. Automatic fields fill from running the same
-- collectors against the competitor domain; the SERP, review and social fields
-- are the reviewer's until a SERP provider is connected.
CREATE TABLE review_competitors (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces(id),
  review_id     text NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  name          text NOT NULL,
  domain        text,
  facts         jsonb NOT NULL DEFAULT '{}', -- the comp.row variables
  threat        int CHECK (threat BETWEEN 1 AND 10),
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_competitors_review ON review_competitors (review_id, position);
