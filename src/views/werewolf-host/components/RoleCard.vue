<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { Role } from '../types'
import { artStyle, teamNames } from '../types'
defineProps<{ role?: Role; concealed?: boolean; compact?: boolean }>()
</script>
<template>
  <article class="role-card" :class="{ concealed, compact }">
    <div class="card-inside">
      <div class="card-front" :aria-hidden="concealed">
        <div class="portrait" :style="artStyle(role?.id || 'villager')" />
        <div class="card-caption">
          <span
            >{{ (teamNames[role?.team || 'village'] || 'Vai trò').toLocaleUpperCase('vi') }}
            <b>{{ (role?.balance_points || 0) > 0 ? '+' : '' }}{{ role?.balance_points }}</b></span
          >
          <h3>{{ role?.name_vi || 'Lá bài bí mật' }}</h3>
          <p v-if="!compact">{{ role?.guide_vi || role?.ability_vi }}</p>
        </div>
      </div>
      <div class="card-back" :aria-hidden="!concealed">
        <span>HACHITU · WEREWOLF</span><Icon icon="lucide:moon-star" /><strong
          >Bí mật<br />dưới trăng</strong
        ><small>Chạm hoặc vuốt để lật bài</small>
      </div>
    </div>
  </article>
</template>
<style scoped>
.role-card {
  perspective: 1100px;
  width: 100%;
  aspect-ratio: 3/4.6;
}
.card-inside {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.concealed .card-inside {
  transform: rotateY(180deg);
}
.card-front,
.card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  overflow: hidden;
  border: 1px solid var(--color-border-default);
  box-shadow: 0 10px 28px #2f241f18;
  background: var(--color-bg-surface);
}
.portrait {
  height: 56%;
  background-repeat: no-repeat;
}
.card-caption {
  padding: 14px;
}
.card-caption > span {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--color-accent-amber);
  display: flex;
  justify-content: space-between;
}
.card-caption h3 {
  font-family: var(--font-display);
  font-size: 18px;
  margin: 8px 0;
}
.card-caption p {
  font-size: 11px;
  line-height: 1.65;
  color: var(--color-text-secondary);
}
.card-back {
  transform: rotateY(180deg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  text-align: center;
  background:
    repeating-linear-gradient(45deg, #ffffff06 0 1px, transparent 1px 15px),
    var(--color-text-primary);
  color: var(--color-bg-surface);
  border: 6px double var(--color-accent-amber);
}
.card-back > svg {
  width: 68px;
  height: 68px;
  color: var(--color-accent-amber);
}
.card-back > span {
  font-size: 9px;
  letter-spacing: 0.2em;
}
.card-back strong {
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 1.1;
}
.card-back small {
  font-size: 10px;
  opacity: 0.7;
}
.compact {
  aspect-ratio: 3/4.2;
}
.compact .portrait {
  height: 68%;
}
.compact .card-caption {
  padding: 9px;
}
.compact h3 {
  font-size: 13px;
  margin: 5px 0;
}
.compact .card-caption > span {
  font-size: 8px;
}
@media (prefers-reduced-motion: reduce) {
  .card-inside {
    transition: none;
  }
}
</style>
