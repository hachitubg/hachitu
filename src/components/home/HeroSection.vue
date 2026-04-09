<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { REPO_URL } from '@/data/constants'
</script>

<template>
  <header class="relative max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-14">
    <div
      class="absolute top-20 right-4 sm:right-6 bg-accent-coral text-bg-surface font-display font-bold text-xs tracking-widest px-3 py-1.5 rotate-2 animate-fade-up animate-delay-2"
    >
      PERSONAL / 2026
    </div>

    <h1
      class="font-display text-[2.4rem] min-[375px]:text-[2.8rem] min-[425px]:text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-text-primary -rotate-1 animate-fade-up"
    >
      HACHITU
    </h1>

    <div class="mt-8 border-l-4 border-accent-coral pl-5 max-w-2xl animate-fade-up animate-delay-3">
      <p class="text-base sm:text-lg text-text-secondary leading-relaxed">
        Không gian mini-app cá nhân để gom các tool, playground và project realtime của riêng bạn
        trên
        <span class="text-accent-coral">Vue 3</span>,
        <span class="text-accent-amber">TypeScript</span> và
        <span class="text-accent-sky">Tailwind CSS v4</span>.
      </p>
      <p class="mt-2 text-sm text-text-dim">
        Tập trung vào việc duyệt nhanh app của bạn, giữ danh sách đã lưu và mở rộng dần từng app
        theo cùng một stack.
      </p>
    </div>

    <div class="mt-8 flex flex-wrap items-center gap-4 animate-fade-up animate-delay-4">
      <a
        href="#apps"
        class="inline-flex items-center justify-center gap-2 w-full sm:w-auto border border-accent-coral bg-accent-coral px-6 py-3 font-display font-semibold text-bg-surface tracking-wide transition-all duration-300 hover:brightness-95"
      >
        <Icon icon="lucide:rocket" class="w-4 h-4 shrink-0" />
        <span class="translate-y-px">Khám phá app</span>
      </a>
      <RouterLink
        to="/bookmarks"
        class="inline-flex items-center justify-center gap-2 w-full sm:w-auto border border-accent-sky bg-accent-sky/10 px-6 py-3 font-display font-semibold text-accent-sky tracking-wide transition-all duration-300 hover:bg-accent-sky hover:text-bg-surface"
      >
        <Icon icon="lucide:heart" class="w-4 h-4 shrink-0" />
        <span class="translate-y-px">Danh sách đã lưu</span>
      </RouterLink>
      <a
        :href="REPO_URL"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="inline-flex items-center justify-center gap-2 w-full sm:w-auto border border-border-default bg-bg-surface px-6 py-3 font-display font-semibold text-text-secondary tracking-wide transition-all duration-300 hover:border-accent-coral hover:text-accent-coral"
      >
        <Icon icon="lucide:github" class="w-4 h-4 shrink-0" />
        <span class="translate-y-px">Source</span>
      </a>
    </div>

    <div class="mt-12 grid gap-3 sm:grid-cols-3 animate-fade-up animate-delay-5">
      <div class="border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-secondary">
        Launcher cá nhân
      </div>
      <div class="border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-secondary">
        Realtime room apps
      </div>
      <div class="border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-secondary">
        Light theme mặc định
      </div>
    </div>
  </header>
</template>
