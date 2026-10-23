<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { GameState } from '../types'
import { tokenIcon } from '../types'
defineProps<{ state: GameState; selected: number | null }>()
defineEmits<{ select: [id: number] }>()
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
  <div class="capital-board" aria-label="Bàn cờ 40 ô">
    <div class="board-center">
      <span class="edition">THE VIETNAM EDITION</span>
      <div class="city-silhouette" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      <h2>HACHI<br /><em>CAPITAL</em></h2>
      <p>MỘT BÀN CỜ. TRIỆU CƠ HỘI.</p>
      <div
        class="board-dice"
        :key="state.logs.filter((l) => l.includes(' gieo ')).length"
        :aria-label="`Xúc xắc: ${state.dice.join(' và ')}`"
      >
        <Icon v-for="(die, i) in state.dice" :key="i" :icon="`lucide:dice-${die}`" />
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
        { corner: tile.id % 10 === 0 },
      ]"
      :aria-label="`${tile.id}. ${tile.name}${tile.price ? `, giá ${tile.price}` : ''}`"
      :aria-pressed="selected === tile.id"
      @click="$emit('select', tile.id)"
    >
      <span class="color-strip" v-if="tile.group" />
      <Icon v-else :icon="icons[tile.kind] || 'lucide:map-pin'" class="space-symbol" />
      <span class="space-name">{{ tile.name }}</span>
      <small v-if="tile.price">{{ tile.price }}</small>
      <span
        v-if="state.properties.find((a) => a.id === tile.id)?.owner"
        class="owner-line"
        :class="`player-${state.players.findIndex((p) => p.id === state.properties.find((a) => a.id === tile.id)?.owner)}`"
      />
      <span v-if="state.properties.find((a) => a.id === tile.id)?.level" class="building-level">{{
        state.properties.find((a) => a.id === tile.id)?.level === 5
          ? 'KS'
          : state.properties.find((a) => a.id === tile.id)?.level
      }}</span>
      <span class="piece-stack"
        ><span
          v-for="p in state.players.filter((p) => !p.bankrupt && p.position === tile.id)"
          :key="p.id"
          class="board-piece"
          :class="`player-${state.players.indexOf(p)}`"
          :title="p.name"
          ><Icon :icon="tokenIcon(p.token)" /></span
      ></span>
    </button>
  </div>
</template>
