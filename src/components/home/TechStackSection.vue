<script setup lang="ts">
import { computed } from 'vue'
import { homepageTechItems } from '@/data/homepage'

const toneClasses = {
  coral: 'border-accent-coral bg-[rgba(231,111,81,0.08)]',
  amber: 'border-accent-amber bg-[rgba(216,155,29,0.08)]',
  sky: 'border-accent-sky bg-[rgba(58,124,165,0.08)]',
} as const

const techCards = computed(() =>
  homepageTechItems.map((item) => ({
    ...item,
    toneClass: toneClasses[item.tone],
  })),
)
</script>

<template>
  <section class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <div class="flex items-center gap-3">
      <span class="font-display text-accent-coral text-sm tracking-[0.24em]">//</span>
      <h2 class="font-display text-2xl sm:text-3xl text-text-primary">Tech Stack</h2>
    </div>

    <div class="mt-6 grid gap-3 lg:grid-cols-3">
      <article
        v-for="item in techCards"
        :key="item.title"
        class="border px-4 py-4 bg-bg-surface"
        :class="item.toneClass"
      >
        <p class="text-[11px] uppercase tracking-[0.2em] text-text-dim">{{ item.title }}</p>
        <p class="mt-3 text-sm leading-7 text-text-primary">{{ item.value }}</p>
      </article>
    </div>
  </section>
</template>
