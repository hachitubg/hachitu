<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore'
import PageCard from '@/components/PageCard.vue'

const recentlyViewedStore = useRecentlyViewedStore()
const { recentPages } = storeToRefs(recentlyViewedStore)
const { clearHistory } = recentlyViewedStore
</script>

<template>
  <section v-if="recentPages.length > 0" class="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
    <div class="flex items-center justify-between mb-5">
      <h2
        class="font-display text-lg sm:text-xl font-semibold text-text-primary flex items-center gap-3"
      >
        <span class="text-accent-coral font-display text-sm tracking-widest">//</span>
        Xem gần đây
        <span
          class="ml-1 inline-flex items-center justify-center rounded-full bg-accent-coral/10 px-2.5 py-0.5 text-xs font-medium text-accent-coral"
        >
          {{ recentPages.length }}
        </span>
      </h2>
      <button
        class="flex items-center gap-1.5 text-xs font-display tracking-wide text-text-dim hover:text-accent-coral transition-colors duration-200"
        @click="clearHistory"
      >
        <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
        Xóa
      </button>
    </div>

    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <PageCard
        v-for="page in recentPages"
        :key="page.path"
        :page="page"
        class="min-h-[9rem]"
      />
    </div>
  </section>
</template>
