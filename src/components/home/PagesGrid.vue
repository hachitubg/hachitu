<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Directive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { categories } from '@/data/categories'
import PageCard from '@/components/PageCard.vue'
import CategoryFilter from '@/components/CategoryFilter.vue'
import { useFilteredList } from '@/composables/useFilteredList'
import { useSearchShortcut } from '@/composables/useSearchShortcut'
import { usePagesStore } from '@/stores/usePagesStore'
import { useFavoritesStore } from '@/stores/useFavoritesStore'

const pagesStore = usePagesStore()
const { isFavorite } = useFavoritesStore()

const sharedObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        ;(entry.target as HTMLElement).classList.add('animate-fade-up')
        sharedObserver.unobserve(entry.target)
      }
    }
  },
  { threshold: 0.1 },
)

onBeforeUnmount(() => {
  sharedObserver.disconnect()
})

const vAnimate: Directive<HTMLElement, string | undefined> = {
  mounted(el, binding) {
    if (binding.value) el.style.animationDelay = binding.value
    el.style.opacity = '0'
    sharedObserver.observe(el)
  },
  unmounted(el) {
    sharedObserver.unobserve(el)
  },
}

const { searchQuery, activeCategory, isFiltering, filteredList, categoryCounts } = useFilteredList(
  {
    items: () => pagesStore.pages,
    searchFields: ['name'],
    categoryField: 'category',
  },
)

const filteredPages = computed(() => filteredList.value)

const visibleCategories = computed(() =>
  categories.filter((category) => (categoryCounts.value[category.id] ?? 0) > 0),
)

const activeCategoryObj = computed(
  () => categories.find((c) => c.id === activeCategory.value) ?? null,
)

const isEmptyCategory = computed(
  () => activeCategory.value !== null && !categoryCounts.value[activeCategory.value],
)

const router = useRouter()

function goToRandom() {
  const list = filteredPages.value
  if (list.length === 0) return
  const randomPage = list[Math.floor(Math.random() * list.length)]
  if (randomPage) router.push(randomPage.path)
}

function padIndex(i: number): string {
  return String(i + 1).padStart(2, '0')
}

const categoryFilterRef = ref<InstanceType<typeof CategoryFilter> | null>(null)
const searchInputRef = computed(() => categoryFilterRef.value?.searchInputRef ?? null)

useSearchShortcut(searchInputRef)
</script>

<template>
  <main id="apps" class="max-w-5xl mx-auto px-4 sm:px-6 pb-16 scroll-reveal">
    <h2
      v-animate
      class="font-display text-xl sm:text-2xl font-semibold text-text-primary mb-8 flex items-center gap-3"
    >
      <span class="text-accent-coral font-display text-sm tracking-widest">//</span>
      Ứng dụng của tôi
      <span
        class="ml-2 inline-flex items-center justify-center rounded-full bg-accent-coral/10 px-3 py-0.5 text-sm font-medium text-accent-coral"
      >
        {{ pagesStore.pages.length }}
      </span>
    </h2>

    <CategoryFilter
      v-animate="'100ms'"
      ref="categoryFilterRef"
      v-model:search="searchQuery"
      v-model:category="activeCategory"
      :total-count="pagesStore.pages.length"
      :category-counts="categoryCounts"
      :result-count="filteredPages.length"
      :available-categories="visibleCategories"
      :hide-result-when="isEmptyCategory"
      class="mb-6"
    >
      <template #actions>
        <div class="grid grid-cols-2 sm:flex gap-3">
          <button
            :disabled="filteredPages.length === 0"
            class="flex items-center justify-center gap-2 px-4 py-3 text-sm font-display tracking-wide border border-accent-coral text-accent-coral bg-accent-coral/10 transition-colors duration-200 hover:bg-accent-coral hover:text-bg-surface disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            @click="goToRandom"
          >
            <Icon icon="lucide:shuffle" aria-hidden="true" class="w-4 h-4" />
            Ngẫu nhiên
          </button>
          <RouterLink
            to="/bookmarks"
            class="flex items-center justify-center gap-2 px-4 py-3 text-sm font-display tracking-wide border border-accent-coral text-accent-coral bg-accent-coral/10 transition-colors duration-200 hover:bg-accent-coral hover:text-bg-surface whitespace-nowrap"
          >
            <Icon icon="lucide:heart" class="w-4 h-4 icon-filled" />
            Yêu thích
          </RouterLink>
        </div>
      </template>
    </CategoryFilter>

    <div
      v-if="isEmptyCategory && activeCategoryObj"
      class="flex flex-col items-center justify-center gap-6 py-20 text-center border border-dashed border-border-default bg-bg-surface"
    >
      <Icon
        :icon="activeCategoryObj.icon"
        class="w-12 h-12 text-accent-coral/40"
        aria-hidden="true"
      />
      <div class="space-y-2">
        <p class="font-display text-lg font-semibold text-text-primary">
          Chưa có app nào trong <span class="text-accent-coral">{{ activeCategoryObj.label }}</span>
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-display tracking-wide border border-accent-coral text-accent-coral bg-accent-coral/10 transition-colors duration-200 hover:bg-accent-coral hover:text-bg-surface"
        @click="activeCategory = null"
      >
        <Icon icon="lucide:plus" class="w-4 h-4" aria-hidden="true" />
        Quay lại tất cả app
      </button>
    </div>

    <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <PageCard
        v-for="(page, index) in filteredPages"
        :key="page.path"
        v-memo="[page.path, isFavorite(page.path), index]"
        :page="page"
        v-animate="`${(index % 6) * 50}ms`"
      >
        <template #background>
          <span
            class="absolute top-3 right-4 font-display text-6xl font-bold text-accent-amber/5 select-none pointer-events-none"
          >
            {{ padIndex(index) }}
          </span>
        </template>
      </PageCard>

      <div
        v-if="!isFiltering"
        class="flex items-center justify-center border border-dashed border-border-default p-6 text-text-dim animate-pulse-border transition-colors duration-300 hover:border-accent-coral hover:text-accent-coral"
      >
        <span class="text-sm font-display tracking-wide">Mini-app tiếp theo của bạn sẽ ở đây</span>
      </div>
    </div>
  </main>
</template>

<style scoped>
.icon-filled :deep(path) {
  fill: currentColor;
}
</style>
