import { ref } from 'vue'
import { createGlobalState, useScriptTag } from '@vueuse/core'
import type { CharacterConfig } from '../character-config.mjs'

export type Direction = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW'
interface Renderer {
  drawAvatar(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: {
      avatar: CharacterConfig & { customShoes: string; customAccessory: string }
      direction: Direction
      isWalking: boolean
      walkFrame: number
      hideName: boolean
    },
  ): void
}
declare global {
  interface Window {
    HachiCharacterRenderer?: Renderer
  }
}

// The small renderer is shared for this SPA session; each canvas owns its drawing lifecycle.
export const useCharacterRenderer = createGlobalState(() => {
  const ready = ref(!!window.HachiCharacterRenderer)
  const failed = ref(false)
  const { load, unload } = useScriptTag(
    '/co-ty-phu/vendor/sprites.js',
    () => {
      ready.value = !!window.HachiCharacterRenderer
    },
    { manual: true },
  )
  async function start() {
    if (window.HachiCharacterRenderer) {
      ready.value = true
      return
    }
    failed.value = false
    try {
      await load()
      ready.value = !!window.HachiCharacterRenderer
      failed.value = !ready.value
    } catch {
      failed.value = true
    }
  }
  function retry() {
    unload()
    void start()
  }
  void start()
  return { ready, failed, retry }
})
