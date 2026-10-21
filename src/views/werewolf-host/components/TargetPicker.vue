<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import PlayerAvatar from './PlayerAvatar.vue'
import type { Member } from '../types'

const props = withDefaults(
  defineProps<{
    players: Member[]
    selected: string[]
    disabled?: boolean
    limit?: number
  }>(),
  { disabled: false, limit: 1 },
)
const emit = defineEmits<{ select: [id: string] }>()
const query = ref('')
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
const indexed = computed(() =>
  props.players.map((player) => ({ player, search: normalize(player.name) })),
)
const visible = computed(() => {
  const value = normalize(query.value.trim())
  return value ? indexed.value.filter((item) => item.search.includes(value)) : indexed.value
})
const selectedIds = computed(() => new Set(props.selected))
const selectedNames = computed(() =>
  props.players
    .filter((p) => selectedIds.value.has(p.id))
    .map((p) => p.name)
    .join(', '),
)
</script>

<template>
  <section class="target-picker" aria-label="Chọn người chơi">
    <div class="picker-heading">
      <strong>Chọn người chơi</strong><span>{{ selected.length }}/{{ limit }} đã chọn</span>
    </div>
    <label v-if="players.length >= 8" class="picker-search"
      ><Icon icon="lucide:search" /><input
        v-model="query"
        class="picker-query"
        type="search"
        aria-label="Tìm người chơi"
        placeholder="Tìm tên người chơi…"
        autocomplete="off"
        :disabled="disabled"
    /></label>
    <p class="picker-selection" aria-live="polite" aria-atomic="true">
      {{ selectedNames ? `Đã chọn: ${selectedNames}` : 'Chạm vào avatar hoặc tên để chọn.' }}
    </p>
    <div
      v-if="visible.length"
      class="target-grid picker-grid"
      role="group"
      aria-label="Danh sách mục tiêu"
      tabindex="0"
    >
      <button
        v-for="{ player } in visible"
        :key="player.id"
        v-memo="[
          player.id,
          player.name,
          player.avatar,
          player.seat,
          selectedIds.has(player.id),
          disabled,
        ]"
        class="target-option"
        :aria-label="`${player.name}${player.seat > 0 ? `, chỗ ${player.seat}` : ''}`"
        :aria-pressed="selectedIds.has(player.id)"
        :disabled="disabled"
        @click="emit('select', player.id)"
      >
        <PlayerAvatar class="target-avatar" :value="player.avatar" :name="player.name" />
        <span class="target-identity"
          ><strong>{{ player.name }}</strong
          ><small v-if="player.seat > 0">Chỗ {{ player.seat }}</small></span
        >
        <span class="target-indicator" aria-hidden="true"
          ><Icon v-if="selectedIds.has(player.id)" icon="lucide:check"
        /></span>
      </button>
    </div>
    <p v-else class="picker-empty" role="status">Không tìm thấy người chơi. Hãy thử tên khác.</p>
    <small v-if="players.length >= 8" class="picker-count"
      >{{ visible.length }}/{{ players.length }} người có thể chọn · Cuộn danh sách để xem
      thêm</small
    >
  </section>
</template>

<style scoped>
.target-picker {
  margin: 16px 0 0;
  min-width: 0;
}
.picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.picker-heading > span {
  flex-shrink: 0;
  color: var(--color-accent-coral);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.picker-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  border: 1px solid var(--color-border-default);
  padding: 0 12px;
  background: var(--color-bg-deep);
}
.target-picker .picker-search input.picker-query {
  width: 100%;
  min-height: 44px;
  border: 0;
  padding: 8px 0;
  margin: 0;
  background: transparent;
  font-size: 16px;
}
.picker-selection {
  min-height: 36px;
  margin: 10px 0 !important;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.target-picker .picker-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: min(46dvh, 430px);
  overflow: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-accent-coral) var(--color-bg-elevated);
  margin: 0;
  padding: 2px;
  scroll-padding: 4px;
}
.target-picker .target-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-height: 70px;
  padding: 10px 8px;
  text-align: left;
  transition: none;
  transform: none;
  min-width: 0;
}
.target-picker .target-option:active:not(:disabled) {
  transform: none;
}
.target-picker .target-option[aria-pressed='true'] {
  border-color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
  box-shadow: inset 0 0 0 1px var(--color-accent-coral);
}
.target-avatar {
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border-default);
}
.target-identity {
  flex: 1;
  min-width: 0;
}
.target-identity strong {
  display: block;
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.target-identity small {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: var(--color-text-dim);
}
.target-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  pointer-events: none;
  color: var(--color-accent-coral);
}
.target-indicator > svg {
  width: 14px;
  height: 14px;
}
.picker-count {
  display: block;
  margin-top: 8px;
  font-size: 10px;
  color: var(--color-text-dim);
  line-height: 1.5;
}
.picker-empty {
  padding: 20px 12px;
  text-align: center;
  background: var(--color-bg-deep);
}
@media (min-width: 1000px) {
  .target-picker .picker-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 360px) {
  .target-avatar {
    width: 30px;
    height: 30px;
  }
  .target-identity strong {
    font-size: 12px;
  }
}
</style>
