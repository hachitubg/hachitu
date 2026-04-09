<script setup lang="ts">
import { REPO_URL } from '@/data/constants'
</script>

<template>
  <footer class="border-t-2 border-accent-coral py-8 text-center px-4">
    <p class="text-sm text-text-dim font-display tracking-wide">
      <span class="text-text-secondary">//</span>
      Mã nguồn hiện tại của
      <a
        :href="REPO_URL"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="text-text-primary link-underline"
      >
        HACHITU
      </a>
      đang được phát triển như một repo riêng.
    </p>
    <p class="mt-3 text-xs text-text-dim">
      Frontend chạy theo mô hình launcher mini-app; backend realtime hiện dùng Cloudflare Workers,
      Durable Objects và SQLite-backed storage cho room state.
    </p>
  </footer>
</template>
