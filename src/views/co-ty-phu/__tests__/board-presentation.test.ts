import { effectScope, shallowRef } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { useBoardPresentation } from '../composables/useBoardPresentation'
import { boardPoint } from '../utils/board-geometry'
import type { GameState } from '../types'

afterEach(() => vi.useRealTimers())
it('uses Poorup timestamps for intermediate motion, catches up and stops at exact destination', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(10000)
  const state = shallowRef({
    dice: [2, 3],
    serverTime: 10000,
    presentation: {
      id: 1,
      actorId: 'a',
      startedAt: 10000,
      readyAt: 12100,
      gameStartedAt: 9000,
      dice: [2, 3],
      segments: [
        {
          from: 0,
          to: 2,
          path: [1, 2],
          teleport: false,
          cause: 'move',
          offsetMs: 1240,
          stepMs: 300,
          durationMs: 600,
        },
      ],
    },
  } as GameState)
  const scope = effectScope()
  const animation = scope.run(() =>
    useBoardPresentation(
      () => state.value,
      () => true,
    ),
  )!
  expect(animation.rolling.value).toBe(true)
  expect(animation.location('a', 2).x).toBe(boardPoint(0).x)
  await vi.advanceTimersByTimeAsync(1400)
  const p = animation.location('a', 2)
  expect(p.walking).toBe(true)
  expect(p.x).toBeLessThan(boardPoint(0).x)
  expect(p.x).toBeGreaterThan(boardPoint(1).x)
  expect(p.direction).toBe('W')
  await vi.advanceTimersByTimeAsync(900)
  expect(animation.busy.value).toBe(false)
  expect(animation.location('a', 2)).toMatchObject({ ...boardPoint(2), walking: false })
  scope.stop()
})
it('geometry has 40 unique perimeter positions and wraps GO', () => {
  expect(new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(boardPoint(i)))).size).toBe(40)
  expect(boardPoint(40)).toEqual(boardPoint(0))
  expect(boardPoint(-1)).toEqual(boardPoint(39))
  expect(boardPoint(0).x).toBeGreaterThan(boardPoint(10).x)
})
