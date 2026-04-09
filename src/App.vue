<script setup lang="ts">
import { computed } from 'vue'
import { useHead, useSeoMeta } from '@unhead/vue'
import { RouterView, useRoute } from 'vue-router'
import AppNavbar from '@/components/AppNavbar.vue'
import BackToTop from '@/components/BackToTop.vue'
import EdgeToolbar from '@/components/EdgeToolbar.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

const route = useRoute()
const isCorePage = computed(() => !route.meta.pagePath)

const SITE_NAME = 'HACHITU'
const SITE_URL = 'https://hachitu.example'
const DEFAULT_TITLE = `${SITE_NAME} - Personal Mini-App Launcher`
const DEFAULT_DESCRIPTION =
  'HACHITU là starter launcher cá nhân cho nhiều mini-app, giữ lại stack hiện đại và auto-routing để bạn mở rộng nhanh.'

const title = computed(() => route.meta.title || DEFAULT_TITLE)
const description = computed(() => route.meta.description || DEFAULT_DESCRIPTION)
const canonicalUrl = computed(() => `${SITE_URL}${route.path}`)

useHead({
  title,
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

useSeoMeta({
  description,
  author: computed(() => route.meta.author as string | undefined),
  ogTitle: title,
  ogDescription: description,
  ogUrl: canonicalUrl,
  ogType: 'website',
  ogSiteName: SITE_NAME,
  twitterCard: 'summary',
  twitterTitle: title,
  twitterDescription: description,
})
</script>

<template>
  <AppNavbar v-if="isCorePage" />
  <RouterView v-slot="{ Component }">
    <ErrorBoundary>
      <component :is="Component" />
    </ErrorBoundary>
  </RouterView>
  <EdgeToolbar
    v-if="route.meta.pagePath && route.meta.showToolbar !== false"
    :page-path="route.meta.pagePath as string"
  />
  <BackToTop v-if="isCorePage" />
</template>
