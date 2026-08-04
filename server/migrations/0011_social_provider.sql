-- §13.2 step 1.11. Social audience, post frequency and engagement come from a
-- credentialed third-party API (Facebook/Instagram Graph), not from our crawler
-- and not from a human. That is a fourth kind of provenance and the report's
-- evidence trail should say so rather than dressing it up as one of the others.
ALTER TYPE signal_source ADD VALUE IF NOT EXISTS 'provider';
