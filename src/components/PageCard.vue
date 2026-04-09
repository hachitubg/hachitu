<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { PageInfo } from '@/types/page'
import FavoriteButton from '@/components/FavoriteButton.vue'

defineProps<{
  page: PageInfo
  alwaysVisibleFavorite?: boolean
  compact?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <component
    :is="disabled ? 'div' : RouterLink"
    v-bind="disabled ? {} : { to: page.path }"
    class="group relative flex flex-col border border-border-default bg-bg-surface transition-all duration-300"
    :class="[
      compact ? 'p-4' : 'p-6',
      disabled
        ? 'select-none'
        : 'hover:-translate-y-1 hover:border-l-4 hover:border-l-accent-coral hover:bg-bg-elevated hover:shadow-lg hover:shadow-accent-coral/10',
    ]"
  >
    <FavoriteButton
      v-if="!disabled"
      :path="page.path"
      :class="compact ? 'top-2 right-2' : 'top-2 right-3'"
      :always-visible="alwaysVisibleFavorite"
    />

    <slot name="background" />

    <h3
      class="font-display font-semibold text-text-primary transition-colors"
      :class="[compact ? 'text-sm line-clamp-1' : 'text-lg', !disabled && 'group-hover:text-accent-coral']"
    >
      {{ page.name }}
    </h3>
    <p
      class="text-text-secondary line-clamp-2"
      :class="compact ? 'mt-1.5 text-xs' : 'mt-2 text-sm'"
      :title="page.description"
    >
      {{ page.description }}
    </p>
    <slot name="footer" />
  </component>
</template>
