<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHead, useSeoMeta } from '@unhead/vue'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import PageCard from '@/components/PageCard.vue'
import { categories } from '@/data/categories'
import { useFilteredList } from '@/composables/useFilteredList'
import { useSearchShortcut } from '@/composables/useSearchShortcut'
import { usePagesStore } from '@/stores/usePagesStore'

const route = useRoute()
const pagesStore = usePagesStore()

const categoryId = computed(() => route.params.id as string)
const category = computed(() => categories.find((c) => c.id === categoryId.value) ?? null)
const isValidCategory = computed(() => category.value !== null)

const pageTitle = computed(() =>
  category.value ? `${category.value.label} - HACHITU` : 'Danh mục không tồn tại - HACHITU',
)

const pageDescription = computed(() =>
  category.value
    ? `${category.value.description} - Khám phá các mini-app ${category.value.label} trong HACHITU.`
    : 'Danh mục bạn tìm không tồn tại.',
)

useHead({ title: pageTitle })
useSeoMeta({
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
})

const categoryPages = computed(() => pagesStore.pages.filter((p) => p.category === categoryId.value))

const { searchQuery, filteredList: filteredPages } = useFilteredList({
  items: categoryPages,
  searchFields: ['name'],
})

const searchInputRef = ref<HTMLInputElement | null>(null)
useSearchShortcut(searchInputRef)
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 sm:pb-24">
      <template v-if="isValidCategory && category">
        <AppBreadcrumb :items="[{ label: category.label }]" />

        <div class="mt-8 flex items-start gap-4">
          <div
            class="flex items-center justify-center w-12 h-12 border border-accent-coral/30 bg-accent-coral/10 text-accent-coral shrink-0"
          >
            <Icon :icon="category.icon" class="w-6 h-6" />
          </div>
          <div>
            <h1
              class="font-display text-3xl sm:text-4xl font-bold text-text-primary flex items-center gap-3"
            >
              {{ category.label }}
              <span
                class="inline-flex items-center justify-center rounded-full bg-accent-coral/10 px-3 py-0.5 text-sm font-medium text-accent-coral"
              >
                {{ categoryPages.length }}
              </span>
            </h1>
            <p class="mt-2 text-text-secondary">
              {{ category.description }}
            </p>
          </div>
        </div>

        <div class="mt-8">
          <div class="relative w-full sm:w-96">
            <Icon
              icon="lucide:search"
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim"
            />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="search"
              placeholder="Tìm theo tên app..."
              class="w-full pl-10 pr-12 py-2.5 bg-bg-surface border border-border-default text-text-primary text-sm font-display tracking-wide placeholder:text-text-dim focus:outline-none focus:border-accent-coral transition-colors"
            >
            <kbd
              class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-text-dim border border-border-default rounded bg-bg-elevated"
            >
              /
            </kbd>
          </div>
        </div>

        <div v-if="filteredPages.length" class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PageCard v-for="page in filteredPages" :key="page.path" :page="page" />
        </div>

        <div
          v-else-if="searchQuery.trim()"
          class="mt-16 flex flex-col items-center justify-center text-center"
        >
          <Icon icon="lucide:search-x" class="w-12 h-12 text-text-dim mb-4" />
          <p class="text-text-secondary">
            Không tìm thấy ứng dụng nào với từ khóa
            <span class="text-accent-coral">"{{ searchQuery }}"</span>
          </p>
        </div>

        <div
          v-else
          class="mt-16 flex flex-col items-center justify-center gap-6 py-20 text-center border border-dashed border-border-default bg-bg-surface"
        >
          <Icon :icon="category.icon" class="w-12 h-12 text-accent-coral/40" />
          <div class="space-y-2">
            <p class="font-display text-lg font-semibold text-text-primary">
              Chưa có app nào trong
              <span class="text-accent-coral">{{ category.label }}</span>
            </p>
          </div>
        </div>
      </template>

      <template v-else>
        <AppBreadcrumb :items="[{ label: 'Danh mục không tồn tại' }]" />
        <div class="mt-16 flex flex-col items-center justify-center text-center">
          <Icon icon="lucide:folder-x" class="w-16 h-16 text-text-dim mb-6" />
          <h1 class="font-display text-2xl font-bold text-text-primary">Danh mục không tồn tại</h1>
          <p class="mt-3 text-text-secondary">
            Danh mục <span class="text-accent-coral">"{{ categoryId }}"</span> không có trong hệ
            thống.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
