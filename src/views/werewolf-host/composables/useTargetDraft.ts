import { onScopeDispose } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import type { Input } from '../types'

export function useTargetDraft(send: (action: string, input: Input) => Promise<boolean>) {
  let generation = 0
  let pending: { input: Input; generation: number } | undefined
  let draining: Promise<boolean> | undefined
  const timer = useTimeoutFn(
    () => {
      void flush()
    },
    100,
    { immediate: false },
  )

  function queue(input: Input) {
    pending = { input: { ...input, targets: [...(input.targets || [])] }, generation }
    timer.start()
  }
  async function drain() {
    let success = true
    while (pending) {
      const item = pending
      pending = undefined
      const result = await send('draft', item.input)
      // An acknowledgement from the previous turn must not undo the new turn's selection.
      if (item.generation === generation) success = result
    }
    return success
  }
  async function flush() {
    timer.stop()
    let success = true
    do {
      if (!draining)
        draining = drain().finally(() => {
          draining = undefined
        })
      success = await draining
    } while (pending || draining)
    return success
  }
  function reset() {
    generation++
    pending = undefined
    timer.stop()
  }
  onScopeDispose(reset)
  return { queue, flush, reset }
}
