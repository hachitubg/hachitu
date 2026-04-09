<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { PERSONAL_FULL_NAME, PERSONAL_ROLE, REPO_URL } from '@/data/constants'
</script>

<template>
  <header class="relative max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-14">
    <div
      class="absolute top-20 right-4 sm:right-6 bg-accent-coral text-bg-surface font-display font-bold text-xs tracking-widest px-3 py-1.5 rotate-2 animate-fade-up animate-delay-2"
    >
      PERSONAL / 2026
    </div>

    <h1
      class="font-display text-[2.4rem] min-[375px]:text-[2.8rem] min-[425px]:text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight -rotate-1 animate-fade-up"
    >
      <span class="text-accent-coral">HACHI</span><span class="text-text-primary">TU</span>
    </h1>

    <div class="mt-8 border-l-4 border-accent-coral pl-5 max-w-3xl animate-fade-up animate-delay-3">
      <p class="text-sm sm:text-base font-display tracking-[0.14em] uppercase text-accent-sky">
        {{ PERSONAL_FULL_NAME }} - {{ PERSONAL_ROLE }}
      </p>
      <p class="text-base sm:text-lg text-text-secondary leading-relaxed">
        Không gian cá nhân để gom các mini-app, playground, tool nhỏ và các sản phẩm realtime tôi
        đang xây dựng bằng cùng một stack hiện đại.
      </p>
      <p class="mt-2 text-sm text-text-dim">
        Frontend, backend call API và lớp lưu dữ liệu đều được công khai ngay trên trang chủ để
        bạn nhìn vào là hiểu cách dự án đang chạy.
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
        <span class="translate-y-px">Source code</span>
      </a>
    </div>

  </header>
</template>
