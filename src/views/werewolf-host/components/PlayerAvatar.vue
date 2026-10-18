<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { avatarUrl } from '../utils/avatars'
const props = withDefaults(defineProps<{ value: string; name?: string }>(), { name: '' })
const failed = ref(false)
const loaded = ref(false)
const src = computed(() => avatarUrl(props.value))
const initials = computed(() =>
  props.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase(),
)
watch(src, () => {
  failed.value = false
  loaded.value = false
})
</script>
<template>
  <span class="player-avatar" :aria-label="name ? `Ảnh đại diện ${name}` : undefined">
    <span v-if="failed || !src || !loaded" class="avatar-fallback" aria-hidden="true"
      ><b v-if="initials">{{ initials }}</b
      ><Icon v-else icon="lucide:user-round"
    /></span>
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      :class="{ loaded }"
      @load="loaded = true"
      @error="failed = true"
    />
  </span>
</template>
<style scoped>
.player-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--color-bg-elevated);
  flex-shrink: 0;
  isolation: isolate;
}
.player-avatar > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
}
.player-avatar > img.loaded {
  opacity: 1;
}
.avatar-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
}
.avatar-fallback b {
  font-family: var(--font-display);
  font-size: 1em;
}
.avatar-fallback svg {
  width: 40%;
  height: 40%;
}
</style>
