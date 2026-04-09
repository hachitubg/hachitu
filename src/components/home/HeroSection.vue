<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { REPO_URL } from '@/data/constants'
import { homepageTechItems } from '@/data/homepage'

const toneClasses = {
  coral: 'border-accent-coral text-accent-coral bg-[rgba(231,111,81,0.08)]',
  amber: 'border-accent-amber text-accent-amber bg-[rgba(216,155,29,0.08)]',
  sky: 'border-accent-sky text-accent-sky bg-[rgba(58,124,165,0.08)]',
} as const

const techCards = computed(() =>
  homepageTechItems.map((item) => ({
    ...item,
    toneClass: toneClasses[item.tone],
  })),
)
</script>

<template>
  <header class="relative max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-14">
    <div
      class="absolute top-18 right-4 sm:right-6 bg-accent-coral text-bg-surface font-display font-bold text-xs tracking-widest px-3 py-1.5 rotate-2 animate-fade-up animate-delay-2"
    >
      PERSONAL / 2026
    </div>

    <div class="animate-fade-up">
      <p class="text-[11px] uppercase tracking-[0.32em] text-text-dim">Personal Launcher</p>
      <h1
        class="mt-3 font-display text-[2.4rem] min-[375px]:text-[2.9rem] min-[425px]:text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-text-primary leading-[0.92]"
      >
        <span class="text-accent-sky">HACHI</span><span class="text-accent-coral">TU</span>
      </h1>
    </div>

    <div class="mt-8 max-w-3xl border-l-4 border-accent-coral pl-5 animate-fade-up animate-delay-3">
      <p class="text-base sm:text-lg text-text-secondary leading-relaxed">
        Không gian cá nhân để gom các mini-app, playground, tool nhỏ và các sản phẩm realtime
        tôi đang xây dựng bằng cùng một stack hiện đại.
      </p>
      <p class="mt-3 text-sm text-text-dim leading-7">
        Trang chủ này đóng vai trò như một launcher gọn, đi thẳng vào app, đồng thời giới thiệu
        rõ frontend đang dùng gì, backend call API bằng gì và dữ liệu realtime đang được lưu bằng
        tech nào.
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

    <div class="mt-12 grid gap-3 animate-fade-up animate-delay-5 lg:grid-cols-3">
      <article
        v-for="item in techCards"
        :key="item.title"
        class="border px-4 py-4 bg-bg-surface"
        :class="item.toneClass"
      >
        <p class="text-[11px] uppercase tracking-[0.2em]">{{ item.title }}</p>
        <p class="mt-3 text-sm leading-7 text-text-primary">{{ item.value }}</p>
      </article>
    </div>
  </header>
</template>
