import pg from 'pg'
import { collectReview } from '../review/store.ts'
import { summariseReview } from '../review/summarise.ts'
import { defaultModelClient } from '../skills/model.ts'
import type { JobHandler } from './worker.ts'

/* The job kinds this platform knows how to run. Each one is a thin adapter:
   the work itself lives with the module that owns it, so a handler is only
   ever "unwrap the payload, call the thing, return something worth storing". */

export const JOB_KINDS = {
  reviewCollect: 'review.collect',
} as const

/** One live collection per review — the dedupe key the queue enforces on. */
export const collectDedupeKey = (reviewId: string) => `${JOB_KINDS.reviewCollect}:${reviewId}`

export const HANDLERS: Record<string, JobHandler> = {
  [JOB_KINDS.reviewCollect]: async (db: pg.Client | pg.Pool, payload) => {
    const workspaceId = payload.workspaceId as string
    const reviewId = payload.reviewId as string
    if (!workspaceId || !reviewId) throw new Error('review.collect needs workspaceId and reviewId')
    const collected = await collectReview(db, workspaceId, reviewId)

    /* The unattended pipeline ends here: collect, auto-accept the measurements
       (1.9), then write the opening from what was accepted (1.10). A summary
       that fails to write must not fail the collection — the evidence is the
       expensive part and it is already on the table, and a review with findings
       and no opening paragraph is still a review a human can finish. */
    let summary: { unsourced: string[] } | null = null
    let summaryError: string | null = null
    try {
      summary = await summariseReview(db, defaultModelClient(), workspaceId, reviewId)
    } catch (err) {
      summaryError = (err as Error).message
    }
    return {
      ...collected,
      summarised: summary !== null && summary.unsourced.length === 0,
      summaryUnsourced: summary?.unsourced ?? [],
      summaryError,
    }
  },
}
