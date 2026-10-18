<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { artStyle, teamNames } from '../types'
import type { Role } from '../types'

const props = defineProps<{ roles: Role[] }>()
const query = ref('')
const faction = ref('')
const availability = ref<'all' | 'enabled' | 'disabled'>('all')
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
const characters = computed(() => props.roles.filter((role) => role.team !== 'utility'))
const enabledCount = computed(() => characters.value.filter((role) => role.enabled).length)
const disabledCount = computed(() => characters.value.length - enabledCount.value)
const factions = computed(() => [...new Set(characters.value.map((role) => role.team))])
const filtered = computed(() =>
  characters.value.filter(
    (role) =>
      (availability.value === 'all' || role.enabled === (availability.value === 'enabled')) &&
      (!faction.value || role.team === faction.value) &&
      normalize(`${role.name_vi} ${role.name_en}`).includes(normalize(query.value.trim())),
  ),
)
</script>

<template>
  <section class="card-library">
    <label class="library-search"
      ><Icon icon="lucide:search" /><input
        v-model="query"
        type="search"
        placeholder="Tìm tên lá bài…"
        aria-label="Tìm theo tên lá bài"
    /></label>
    <div class="library-factions library-availability" aria-label="Lọc theo trạng thái sử dụng">
      <button :aria-pressed="availability === 'all'" @click="availability = 'all'">
        Tất cả ({{ characters.length }})
      </button>
      <button :aria-pressed="availability === 'enabled'" @click="availability = 'enabled'">
        Đang sử dụng ({{ enabledCount }})
      </button>
      <button :aria-pressed="availability === 'disabled'" @click="availability = 'disabled'">
        Chưa sử dụng ({{ disabledCount }})
      </button>
    </div>
    <p class="fineprint">
      Thống kê theo role đã có hoặc chưa có logic tự động, không theo bộ bài của ván.
    </p>
    <div class="library-factions" aria-label="Lọc theo phe">
      <button :aria-pressed="!faction" @click="faction = ''">Tất cả</button>
      <button
        v-for="team in factions"
        :key="team"
        :aria-pressed="faction === team"
        @click="faction = team"
      >
        {{ teamNames[team] || team }}
      </button>
    </div>
    <div class="library-navigation">
      <span>{{ filtered.length }}/{{ characters.length }} loại bài</span>
    </div>
    <div v-if="filtered.length" class="library-list">
      <article
        v-for="role in filtered"
        :key="role.id"
        class="library-card"
        :class="{ unavailable: !role.enabled }"
      >
        <div class="library-art" :style="artStyle(role.id)" role="img" :aria-label="role.name_vi" />
        <div class="library-caption">
          <span class="eyebrow">{{ teamNames[role.team] }} · {{ role.quantity }} lá</span>
          <h3>{{ role.name_vi }}</h3>
          <span class="library-score"
            >Điểm cân bằng:
            <strong>{{
              role.balance_points === null
                ? 'Không cố định'
                : `${role.balance_points > 0 ? '+' : ''}${role.balance_points}`
            }}</strong></span
          >
          <small>{{ role.enabled ? 'Có logic tự động' : 'Chỉ dùng trong chế độ bộ bài' }}</small>
          <p>{{ role.guide_vi || role.ability_vi }}</p>
          <p v-if="role.win_condition_vi">
            <strong>Thắng khi:</strong> {{ role.win_condition_vi }}
          </p>
        </div>
      </article>
    </div>
    <p v-else class="fineprint" role="status">Không tìm thấy lá bài phù hợp.</p>
  </section>
</template>

<style scoped>
.library-search {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--color-border-default);
  padding: 0 12px;
}
.library-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  padding: 12px 0;
  background: transparent;
  color: var(--color-text-primary);
}
.library-factions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.library-factions button {
  font-size: 12px;
  padding: 8px 10px;
}
.library-factions button[aria-pressed='true'] {
  background: var(--color-accent-coral);
  color: var(--color-bg-surface);
  border-color: var(--color-accent-coral);
}
.library-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-text-dim);
  font-size: 12px;
}
.library-list {
  display: grid;
  gap: 16px;
  margin-top: 18px;
}
.library-card {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: start;
  gap: 18px;
  padding: 16px;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-deep);
  overflow: hidden;
}
.library-card.unavailable {
  opacity: 0.55;
}
.library-card.unavailable .library-art {
  filter: grayscale(0.7);
}
.library-score {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-accent-amber);
}
.library-art {
  aspect-ratio: 1;
  background-repeat: no-repeat;
  pointer-events: none;
}
.library-caption {
  min-width: 0;
}
.library-caption h3 {
  font-family: var(--font-display);
  font-size: 20px;
  margin: 10px 0 6px;
}
@media (max-width: 540px) {
  .library-card {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }
  .library-caption h3 {
    font-size: 17px;
  }
}
.library-caption small {
  color: var(--color-text-dim);
  font-size: 11px;
}
.library-caption p {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.75;
  margin-top: 12px;
}
</style>
