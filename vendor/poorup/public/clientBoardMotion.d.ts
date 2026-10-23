export interface WalkTimeline {
  readonly path: readonly number[]
  readonly stepMs: number
  readonly startedAt: number
  readonly duration: number
  snapshot(timestamp?: number): {
    index: number
    beforeFirst: boolean
    done: boolean
    elapsed: number
  }
}
export const PIECE_WALK_STEP_MS: number
export function createWalkTimeline(options?: {
  path?: number[]
  stepMs?: number
  startedAt?: number
  now?: () => number
}): WalkTimeline
