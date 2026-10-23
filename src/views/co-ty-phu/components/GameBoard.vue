<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { watch } from 'vue'
import type { GameState } from '../types'
import CharacterSprite from './CharacterSprite.vue'
import PropertyBuildings from './PropertyBuildings.vue'
import BoardGarden from './BoardGarden.vue'
import { useBoardPresentation } from '../composables/useBoardPresentation'
const props = withDefaults(
  defineProps<{
    state: GameState
    selected: number | null
    motionEnabled?: boolean
    theme?: string
  }>(),
  { motionEnabled: true, theme: 'light' },
)
const emit = defineEmits<{ select: [id: number]; presenting: [value: boolean] }>()
const { busy, rolling, dice, location, playerStyle } = useBoardPresentation(
  () => props.state,
  () => props.motionEnabled,
)
watch(busy, (value) => emit('presenting', value), { immediate: true })
function position(i: number) {
  if (i <= 10) return { gridRow: 11, gridColumn: 11 - i }
  if (i <= 20) return { gridRow: 21 - i, gridColumn: 1 }
  if (i <= 30) return { gridRow: 1, gridColumn: i - 19 }
  return { gridRow: i - 29, gridColumn: 11 }
}
const icons: Record<string, string> = {
  go: 'lucide:flag',
  jail: 'lucide:lock-keyhole',
  'go-jail': 'lucide:siren',
  parking: 'lucide:trees',
  station: 'lucide:train-front',
  utility: 'lucide:zap',
  tax: 'lucide:landmark',
  chance: 'lucide:sparkles',
  chest: 'lucide:gift',
}
</script>

<template>
  <div class="capital-board" :class="`scene-${theme}`" aria-label="Bàn cờ 40 ô">
    <div class="board-center">
      <span class="edition">THE VIETNAM EDITION</span>
      <BoardGarden />
      <h2>HACHI<br /><em>CAPITAL</em></h2>
      <p>MỘT BÀN CỜ. TRIỆU CƠ HỘI.</p>
      <div
        class="board-dice"
        :class="{ rolling: rolling && motionEnabled }"
        :aria-label="`Xúc xắc: ${state.dice.join(' và ')}`"
      >
        <span v-for="(die, i) in dice" :key="i" class="dice-cube"
          ><Icon :icon="`lucide:dice-${die}`"
        /></span>
      </div>
      <span class="bank-count">{{ state.houses }} nhà · {{ state.hotels }} khách sạn</span>
    </div>
    <button
      v-for="tile in state.board"
      :key="tile.id"
      :style="position(tile.id)"
      class="board-space"
      :class="[
        { picked: selected === tile.id, current: state.players[state.turn]?.position === tile.id },
        `group-${tile.group || 'none'}`,
        {
          corner: tile.id % 10 === 0,
          developed: !!state.properties.find((a) => a.id === tile.id)?.level,
        },
      ]"
      :aria-label="`${tile.id}. ${tile.name}${tile.price ? `, giá ${tile.price}` : ''}`"
      :aria-pressed="selected === tile.id"
      @click="$emit('select', tile.id)"
    >
      <span class="color-strip" v-if="tile.group" />
      <img
        v-else-if="['chance', 'chest', 'jail', 'go-jail'].includes(tile.kind)"
        class="space-art"
        :src="`/co-ty-phu/poorup-art/icons/${tile.kind === 'chance' ? 'surprise' : tile.kind === 'chest' ? 'treasure-chest' : 'passing-by-bars'}.svg`"
        alt=""
      />
      <Icon v-else :icon="icons[tile.kind] || 'lucide:map-pin'" class="space-symbol" />
      <span class="space-name">{{ tile.name }}</span>
      <small v-if="tile.price && !state.properties.find((a) => a.id === tile.id)?.level">{{
        tile.price
      }}</small>
      <span
        v-if="state.properties.find((a) => a.id === tile.id)?.owner"
        class="owner-line"
        :class="`player-${state.players.findIndex((p) => p.id === state.properties.find((a) => a.id === tile.id)?.owner)}`"
      />
      <Transition name="construction" mode="out-in"
        ><span
          v-if="state.properties.find((a) => a.id === tile.id)?.level"
          :key="`${tile.id}:${state.properties.find((a) => a.id === tile.id)?.level}`"
          class="tile-buildings"
          ><PropertyBuildings
            :level="state.properties.find((a) => a.id === tile.id)?.level || 0"
            :name="tile.name" /></span
      ></Transition>
    </button>
    <div class="moving-piece-layer" aria-label="Nhân vật trên bàn cờ">
      <span
        v-for="(p, index) in state.players.filter((p) => !p.bankrupt)"
        :key="p.id"
        class="moving-piece"
        :class="[
          `player-${state.players.indexOf(p)}`,
          { walking: location(p.id, p.position).walking },
        ]"
        :style="playerStyle(p.id, p.position, index)"
        :title="p.name"
      >
        <CharacterSprite
          :character="p.character"
          :name="p.name"
          :animate="location(p.id, p.position).walking"
          :explicit-motion="motionEnabled"
          :direction="location(p.id, p.position).direction"
        />
      </span>
    </div>
  </div>
</template>
