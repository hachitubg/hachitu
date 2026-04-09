<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { homepageProjectLinks } from '@/data/homepage'
</script>

<template>
  <section class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
    <div class="flex items-center gap-3">
      <span class="font-display text-accent-coral text-sm tracking-[0.24em]">//</span>
      <h2 class="font-display text-2xl sm:text-3xl text-text-primary">Website Tôi Đã Làm</h2>
    </div>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <a
        v-for="project in homepageProjectLinks"
        :key="project.url"
        :href="project.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group border border-border-default bg-bg-surface px-5 py-5 transition hover:border-accent-sky hover:bg-bg-elevated"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[11px] uppercase tracking-[0.18em] text-text-dim">Website</p>
            <h3 class="mt-2 font-display text-xl text-text-primary break-all">
              {{ project.name }}
            </h3>
          </div>
          <Icon
            icon="lucide:arrow-up-right"
            class="size-4 shrink-0 text-text-dim transition group-hover:text-accent-sky"
          />
        </div>
        <p class="mt-4 text-sm text-accent-sky break-all">{{ project.url }}</p>
      </a>
    </div>
  </section>
</template>
