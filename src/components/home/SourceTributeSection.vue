<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { homepageSourceTribute } from '@/data/homepage'
</script>

<template>
  <section class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <div class="border border-border-default bg-bg-surface px-5 py-6 sm:px-6">
      <p class="text-[11px] uppercase tracking-[0.22em] text-accent-amber">Nguồn cảm hứng</p>
      <div class="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div class="max-w-3xl">
          <h2 class="font-display text-2xl sm:text-3xl text-text-primary">
            Tri ân source code chính: J2TEAM vibe
          </h2>
          <p class="mt-3 text-sm leading-7 text-text-dim">
            {{ homepageSourceTribute.description }}
          </p>
        </div>

        <a
          :href="homepageSourceTribute.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center justify-center gap-2 border border-accent-amber bg-accent-amber/10 px-5 py-3 font-display font-semibold text-accent-amber transition hover:bg-accent-amber hover:text-bg-surface"
        >
          <Icon icon="lucide:github" class="size-4" />
          <span>{{ homepageSourceTribute.name }}</span>
        </a>
      </div>
    </div>
  </section>
</template>
