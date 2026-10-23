<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRafFn, usePreferredReducedMotion, useDocumentVisibility } from '@vueuse/core'
import { defaultCharacter } from '../character-config.mjs'
import type { CharacterConfig } from '../character-config.mjs'
import { useCharacterRenderer } from '../composables/useCharacterRenderer'
import type { Direction } from '../composables/useCharacterRenderer'
const props = withDefaults(
  defineProps<{
    character?: CharacterConfig
    direction?: Direction
    animate?: boolean
    explicitMotion?: boolean
    name?: string
  }>(),
  { direction: 'SE', animate: false, name: '' },
)
const canvas = ref<HTMLCanvasElement>()
const { ready, failed } = useCharacterRenderer()
const reducedMotion = usePreferredReducedMotion()
const visibility = useDocumentVisibility()
const moving = computed(
  () =>
    props.animate &&
    visibility.value === 'visible' &&
    (props.explicitMotion || reducedMotion.value !== 'reduce'),
)
const shoes = ['#24282d', '#fff5e9', '#9b5638', '#d9654f', '#3f7ea6', '#c88b18']
const accessories = ['#d9654f', '#2f241f', '#c88b18', '#fff5e9', '#3f7ea6', '#75824c']
let frame = 0
function draw() {
  if (!ready.value || !window.HachiCharacterRenderer) return
  const context = canvas.value?.getContext('2d')
  if (!context) return
  const c = props.character || defaultCharacter
  context.clearRect(0, 0, 96, 144)
  context.save()
  context.scale(2, 2)
  window.HachiCharacterRenderer.drawAvatar(context, 24, 59, {
    avatar: { ...c, customShoes: shoes[c.shoes]!, customAccessory: accessories[c.accessoryColor]! },
    direction: props.direction,
    isWalking: moving.value,
    walkFrame: frame,
    hideName: true,
  })
  context.restore()
}
let lastFrame = 0
const { pause, resume } = useRafFn(
  ({ timestamp }) => {
    if (timestamp - lastFrame < 1000 / 30) return
    lastFrame = timestamp
    frame = timestamp / 35
    draw()
  },
  { immediate: false },
)
watch(
  [canvas, ready, () => props.character, () => props.direction, moving],
  () => {
    if (moving.value && ready.value) resume()
    else {
      pause()
      frame = 0
    }
    draw()
  },
  { immediate: true, flush: 'post' },
)
</script>
<template>
  <span
    class="character-sprite"
    role="img"
    :aria-label="name ? `Nhân vật của ${name}` : 'Nhân vật 2D'"
  >
    <canvas ref="canvas" width="96" height="144" aria-hidden="true" />
    <span v-if="!ready" class="character-loading">{{
      failed ? 'Chưa tải được nhân vật' : 'Đang tải…'
    }}</span>
  </span>
</template>
<style scoped>
.character-sprite {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 96px;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
.character-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 9px;
  color: var(--color-text-dim);
}
</style>
