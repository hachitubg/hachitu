<script setup lang="ts">
import { REPO_URL } from '@/data/constants'
</script>

<template>
  <footer class="border-t-2 border-accent-coral py-8 text-center">
    <p class="text-sm text-text-dim font-display tracking-wide">
      <span class="text-text-secondary">//</span>
      Mã nguồn của
      <a
        :href="REPO_URL"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="text-text-primary link-underline"
      >
        HACHITU
      </a>
    </p>
    <p class="mt-3 text-xs text-text-dim">
      Một repo cá nhân để gom mini-app, tool nhỏ và các thử nghiệm realtime.
    </p>
  </footer>
</template>
