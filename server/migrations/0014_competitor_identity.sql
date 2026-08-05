-- §13.2 step 1.37. Seeding the competitor set was a check-then-insert: count
-- the rows, and if there are none, write three. Two collections of the same
-- review that overlap both read zero and both write, so the section that is
-- capped at three (1.31) printed six — each competitor twice, once thin and
-- once with its facts.
--
-- It is not hypothetical and it is not only the harness: `receiveIntake`
-- queues a collect, the fidelity harness also calls `collectReview` directly,
-- and the queue's dedupe key only covers the jobs it owns. The guard has to be
-- in the table rather than in the read that precedes the write.
--
-- Deduplicate what is already there first, keeping the earliest row per name —
-- the later one is the duplicate by definition.
DELETE FROM review_competitors a
 USING review_competitors b
 WHERE a.review_id = b.review_id
   AND lower(a.name) = lower(b.name)
   AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS review_competitors_review_name_idx
    ON review_competitors (review_id, lower(name));
