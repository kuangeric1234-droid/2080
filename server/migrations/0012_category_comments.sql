-- §13.2 step 1.18. The summary table's Comments column is a short verdict per
-- category in every real report — "Great performance and diversified
-- email/server", "Abandoned social media" — not the static dimension list the
-- blank template carries as a placeholder.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS category_comments jsonb NOT NULL DEFAULT '{}';
