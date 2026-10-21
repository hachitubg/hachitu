import { effectScope } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useTargetDraft } from './useTargetDraft'
import type { Input } from '../types'

let scope = effectScope()
beforeEach(() => {
  vi.useFakeTimers()
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  vi.useRealTimers()
})

it('coalesces fast taps and sends only the newest snapshot', async () => {
  const send = vi.fn<(action: string, input: Input) => Promise<boolean>>().mockResolvedValue(true)
  const draft = scope.run(() => useTargetDraft(send))!
  draft.queue({ revision: 1, targets: ['a'] })
  draft.queue({ revision: 1, targets: ['b'] })
  draft.queue({ revision: 1, targets: ['c'] })
  expect(send).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(100)
  expect(send).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenLastCalledWith('draft', { revision: 1, targets: ['c'] })
})

it('keeps one request in flight and flushes the latest selection before confirmation', async () => {
  let resolveFirst!: (value: boolean) => void
  const first = new Promise<boolean>((resolve) => {
    resolveFirst = resolve
  })
  const send = vi
    .fn<(action: string, input: Input) => Promise<boolean>>()
    .mockResolvedValue(true)
    .mockReturnValueOnce(first)
  const draft = scope.run(() => useTargetDraft(send))!
  draft.queue({ revision: 1, targets: ['a'] })
  vi.advanceTimersByTime(100)
  draft.queue({ revision: 1, targets: ['b'] })
  draft.queue({ revision: 1, targets: ['c'] })
  const flushed = draft.flush()
  expect(send).toHaveBeenCalledTimes(1)
  resolveFirst(true)
  expect(await flushed).toBe(true)
  expect(send.mock.calls.map((call) => call[1].targets)).toEqual([['a'], ['c']])
})

it('drops queued work on a new turn and ignores an old failed acknowledgement', async () => {
  let resolveOld!: (value: boolean) => void
  const send = vi
    .fn<(action: string, input: Input) => Promise<boolean>>()
    .mockResolvedValue(true)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
  const draft = scope.run(() => useTargetDraft(send))!
  draft.queue({ revision: 1, targets: ['a'] })
  vi.advanceTimersByTime(100)
  draft.queue({ revision: 1, targets: ['b'] })
  draft.reset()
  draft.queue({ revision: 2, targets: ['c'] })
  const flushed = draft.flush()
  resolveOld(false)
  expect(await flushed).toBe(true)
  expect(send.mock.calls.map((call) => call[1])).toEqual([
    { revision: 1, targets: ['a'] },
    { revision: 2, targets: ['c'] },
  ])
})

it('reports failure without repeatedly retrying or consuming confirmation', async () => {
  const send = vi.fn<(action: string, input: Input) => Promise<boolean>>().mockResolvedValue(false)
  const draft = scope.run(() => useTargetDraft(send))!
  draft.queue({ targets: ['a'] })
  expect(await draft.flush()).toBe(false)
  await vi.advanceTimersByTimeAsync(1000)
  expect(send).toHaveBeenCalledTimes(1)
})

it('cancels queued drafts on unmount', async () => {
  const send = vi.fn<(action: string, input: Input) => Promise<boolean>>().mockResolvedValue(true)
  const draft = scope.run(() => useTargetDraft(send))!
  draft.queue({ targets: ['a'] })
  scope.stop()
  await vi.advanceTimersByTimeAsync(1000)
  await flushPromises()
  expect(send).not.toHaveBeenCalled()
})
