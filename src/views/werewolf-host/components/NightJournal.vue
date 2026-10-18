<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { Log } from '../types'
import { nightJournal } from '../utils/journal'
const props = defineProps<{ logs: Log[]; round: number; phase: string }>()
const nights = computed(() => nightJournal(props.logs))
const pending = (round: number) => round === props.round && ['night', 'dawn'].includes(props.phase)
</script>
<template>
  <div class="night-journal">
    <p class="fineprint">
      Ai đã làm gì trong đêm và chuyện gì xảy ra khi trời sáng. Chỉ quản trò xem được cho đến khi
      ván kết thúc.
    </p>
    <p v-if="!nights.length" class="journal-empty">Đêm đầu tiên chưa bắt đầu.</p>
    <details v-for="night in nights" :key="night.round" :open="night.round === round">
      <summary>
        <Icon icon="lucide:moon" /><strong>Đêm {{ night.round }}</strong
        ><small
          >{{
            pending(night.round)
              ? 'Đang diễn ra'
              : night.entries.some((entry) => entry.phase === 'dawn')
                ? 'Đã công bố'
                : 'Chưa hoàn thành'
          }}
          · {{ night.entries.length }} sự kiện</small
        ><Icon icon="lucide:chevron-down" />
      </summary>
      <ol class="history-log">
        <li v-for="(entry, index) in night.entries" :key="index">
          {{ entry.message }}
        </li>
      </ol>
    </details>
  </div>
</template>
<style scoped>
.night-journal > details {
  border: 1px solid var(--color-border-default);
  margin: 12px 0;
  background: var(--color-bg-deep);
}
.night-journal summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  cursor: pointer;
  list-style: none;
}
.night-journal summary::-webkit-details-marker {
  display: none;
}
.night-journal summary strong {
  font-family: var(--font-display);
  font-size: 15px;
}
.night-journal summary small {
  margin-left: auto;
  font-size: 10px;
  color: var(--color-text-dim);
}
.night-journal .history-log {
  margin: 0;
  padding: 0 16px 8px;
}
.night-journal .history-log li {
  position: relative;
  padding-left: 18px;
}
.night-journal .history-log li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 22px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent-amber);
}
.journal-empty {
  padding: 24px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
