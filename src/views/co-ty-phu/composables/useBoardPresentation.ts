import { computed, ref, watch } from 'vue'
import { useRafFn, useDocumentVisibility } from '@vueuse/core'
import type { GameState } from '../types'
import { createWalkTimeline } from '../../../../vendor/poorup/public/clientBoardMotion.js'
import { DICE_ROLL_MS } from '../../../../vendor/poorup/public/gamePresentationTiming.js'
import { boardPoint } from '../utils/board-geometry'
import type { Direction } from './useCharacterRenderer'

export function useBoardPresentation(getState: () => GameState, motionEnabled: () => boolean) {
  const now = ref(Date.now()),
    offset = ref(0)
  const visibility = useDocumentVisibility()
  const presentation = computed(() => getState().presentation)
  const endsAt = computed(() => presentation.value?.readyAt || 0)
  const busy = computed(() => now.value + offset.value < endsAt.value)
  const elapsed = computed(() => now.value + offset.value - (presentation.value?.startedAt || 0))
  const rolling = computed(
    () => busy.value && !presentation.value?.skipDice && elapsed.value < DICE_ROLL_MS,
  )
  const { pause, resume } = useRafFn(
    () => {
      now.value = Date.now()
      if (!busy.value) pause()
    },
    { immediate: false },
  )
  watch(
    () => getState().serverTime,
    () => {
      offset.value = (getState().serverTime || Date.now()) - Date.now()
    },
    { immediate: true },
  )
  watch(
    [() => getState().presentation, visibility],
    () => {
      now.value = Date.now()
      if (busy.value) resume()
      else pause()
    },
    { immediate: true },
  )
  const dice = computed(() =>
    rolling.value && motionEnabled()
      ? [
          (Math.floor(Math.max(0, elapsed.value) / 75) % 6) + 1,
          (Math.floor(Math.max(0, elapsed.value) / 95 + 2) % 6) + 1,
        ]
      : getState().dice,
  )
  function location(
    id: string,
    position: number,
  ): { x: number; y: number; walking: boolean; direction: Direction } {
    const p = presentation.value
    if (!p || p.actorId !== id || !busy.value || !motionEnabled() || visibility.value !== 'visible')
      return { ...boardPoint(position), walking: false, direction: 'SE' }
    let at = boardPoint(p.segments[0]?.from ?? position)
    let direction: Direction = 'SE'
    for (const segment of p.segments) {
      const timeline = createWalkTimeline({
        path: segment.path,
        stepMs: segment.stepMs,
        startedAt: segment.offsetMs,
      })
      const state = timeline.snapshot(elapsed.value)
      if (elapsed.value < segment.offsetMs) return { ...at, walking: false, direction }
      if (state.done) {
        at = boardPoint(segment.to)
        continue
      }
      if (segment.teleport) {
        return { ...boardPoint(segment.to), walking: false, direction }
      }
      const step = Math.floor((elapsed.value - segment.offsetMs) / segment.stepMs)
      const start = boardPoint(step ? segment.path[step - 1]! : segment.from)
      const end = boardPoint(segment.path[step] ?? segment.to)
      const progress = Math.min(
        1,
        Math.max(0, (elapsed.value - segment.offsetMs - step * segment.stepMs) / segment.stepMs),
      )
      direction =
        Math.abs(end.x - start.x) > Math.abs(end.y - start.y)
          ? end.x > start.x
            ? 'E'
            : 'W'
          : end.y > start.y
            ? 'S'
            : 'N'
      return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
        walking: true,
        direction,
      }
    }
    return { ...at, walking: false, direction }
  }
  function playerStyle(id: string, position: number, index: number) {
    const point = location(id, position)
    return {
      left: `${point.x + ((index % 3) - 1) * 1.8}%`,
      top: `${point.y + Math.floor(index / 3) * 1.7}%`,
    }
  }
  return { busy, rolling, dice, location, playerStyle }
}
