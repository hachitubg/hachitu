<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  PERSONAL_EMAIL,
  PERSONAL_FACEBOOK_URL,
  PERSONAL_GITHUB_URL,
  PERSONAL_PHONE,
  SITE_OWNER,
  SITE_VERSION,
} from '@/data/constants'
</script>

<template>
  <footer class="border-t-2 border-accent-coral py-8 px-4">
    <div class="max-w-6xl mx-auto flex flex-col items-center gap-4">
      <p class="text-sm text-text-dim font-display tracking-wide text-center">
        <span class="text-text-secondary">//</span>
        Phát triển bởi
        <span class="text-text-primary">{{ SITE_OWNER }}</span>
        <span class="mx-2 text-border-default">•</span>
        <span class="text-text-secondary">{{ SITE_VERSION }}</span>
      </p>

      <div class="flex flex-wrap items-center justify-center gap-3">
        <a
          :href="PERSONAL_GITHUB_URL"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-surface text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
          aria-label="GitHub"
          title="GitHub"
        >
          <Icon icon="lucide:github" class="size-4" />
        </a>

        <a
          :href="`mailto:${PERSONAL_EMAIL}`"
          class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-surface text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
          aria-label="Email"
          title="Email"
        >
          <Icon icon="lucide:mail" class="size-4" />
        </a>

        <a
          :href="`tel:${PERSONAL_PHONE}`"
          class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-surface text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
          aria-label="Phone"
          title="Phone"
        >
          <Icon icon="lucide:phone" class="size-4" />
        </a>

        <a
          :href="PERSONAL_FACEBOOK_URL"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="inline-flex size-10 items-center justify-center border border-border-default bg-bg-surface text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
          aria-label="Facebook"
          title="Facebook"
        >
          <Icon icon="lucide:facebook" class="size-4" />
        </a>
      </div>
    </div>
  </footer>
</template>
