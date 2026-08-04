import pg from 'pg'
import { collectReview } from '../review/store.ts'
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
    return collectReview(db, workspaceId, reviewId)
  },
}
