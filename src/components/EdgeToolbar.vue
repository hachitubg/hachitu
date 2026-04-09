<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useClipboard, useShare, useTimeoutFn } from '@vueuse/core'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { REPO_URL } from '@/data/constants'
import { useFavoritesStore } from '@/stores/useFavoritesStore'
import { usePagesStore } from '@/stores/usePagesStore'

const props = defineProps<{
  pagePath: string
}>()

const route = useRoute()
const router = useRouter()
const { toggleFavorite, isFavorite } = useFavoritesStore()

const isDismissed = ref(false)
const isOpen = ref(false)
const isAnimating = ref(false)

const { start: startHideTimer, stop: stopHideTimer } = useTimeoutFn(
  () => {
    isOpen.value = false
  },
  300,
  { immediate: false },
)

const { start: startAnimatingTimer, stop: stopAnimatingTimer } = useTimeoutFn(
  () => {
    isAnimating.value = false
  },
  500,
  { immediate: false },
)

const sourceUrl = computed(() => `${REPO_URL}/tree/main/src/views${props.pagePath}`)
const favorited = computed(() => isFavorite(props.pagePath))

function show() {
  stopHideTimer()
  isOpen.value = true
}

function scheduleHide() {
  startHideTimer()
}

function toggle() {
  isOpen.value = !isOpen.value
}

function handleFavorite() {
  const willBeFavorite = !favorited.value
  toggleFavorite(props.pagePath)
  if (willBeFavorite) {
    stopAnimatingTimer()
    isAnimating.value = true
    startAnimatingTimer()
  }
}

function dismiss() {
  isDismissed.value = true
  isOpen.value = false
}

const pagesStore = usePagesStore()

function goToRandom() {
  const others = pagesStore.pages.filter((p) => p.path !== props.pagePath)
  if (others.length === 0) return
  const randomPage = others[Math.floor(Math.random() * others.length)]!
  router.push(randomPage.path)
}

const { copy, copied } = useClipboard({ copiedDuring: 1500 })

const shareOptions = computed(() => ({
  title: (route.meta.title as string) || document.title,
  url: window.location.href,
}))

const { share, isSupported: isShareSupported } = useShare(shareOptions)

async function sharePage() {
  if (isShareSupported.value) {
    await share().catch(() => {})
    return
  }

  await copy(window.location.href)
}
</script>

<template>
  <div
    v-if="!isDismissed"
    class="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center transition-opacity duration-300"
    :class="isOpen ? 'opacity-100' : 'opacity-50 hover:opacity-100'"
    @mouseenter="show"
    @mouseleave="scheduleHide"
  >
    <button
      class="flex-shrink-0 flex items-center justify-center w-6 h-14 transition-all duration-300 cursor-pointer"
      :class="
        isOpen ? 'bg-bg-elevated/90 backdrop-blur-sm' : 'bg-bg-elevated/70 hover:bg-bg-elevated/90'
      "
      :aria-label="isOpen ? 'Ẩn toolbar' : 'Hiện toolbar'"
      @click="toggle"
    >
      <Icon
        :icon="isOpen ? 'lucide:chevron-right' : 'lucide:chevron-left'"
        class="w-4 h-4 text-text-secondary"
      />
    </button>

    <div class="overflow-hidden transition-all duration-300" :class="isOpen ? 'max-w-xs' : 'max-w-0'">
      <div
        class="flex flex-col gap-2 p-2 bg-bg-surface/95 backdrop-blur-sm border border-r-0 border-border-default shadow-lg"
      >
        <a
          :href="sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="toolbar-btn group"
          title="Xem mã nguồn"
        >
          <Icon icon="lucide:code-2" class="w-5 h-5" />
          <span class="toolbar-label font-display tracking-wide">Mã nguồn</span>
        </a>

        <button
          class="toolbar-btn group"
          :class="favorited && 'text-accent-coral'"
          :title="favorited ? 'Bỏ yêu thích' : 'Thêm yêu thích'"
          @click="handleFavorite"
        >
          <span class="relative" :class="isAnimating && 'is-animating'">
            <Icon icon="lucide:heart" class="w-5 h-5" :class="favorited && 'icon-filled'" />
          </span>
          <span class="toolbar-label font-display tracking-wide">
            {{ favorited ? 'Đã thích' : 'Yêu thích' }}
          </span>
        </button>

        <button class="toolbar-btn group" title="Chia sẻ trang này" @click="sharePage">
          <Icon icon="lucide:share-2" class="w-5 h-5" />
          <span class="toolbar-label font-display tracking-wide">
            {{ copied ? 'Đã copy!' : 'Chia sẻ' }}
          </span>
        </button>

        <RouterLink to="/" class="toolbar-btn group" title="Về trang chủ">
          <Icon icon="lucide:home" class="w-5 h-5" />
          <span class="toolbar-label font-display tracking-wide">Trang chủ</span>
        </RouterLink>

        <button class="toolbar-btn group" title="Xem trang ngẫu nhiên" @click="goToRandom">
          <Icon icon="lucide:shuffle" class="w-5 h-5" />
          <span class="toolbar-label font-display tracking-wide">Ngẫu nhiên</span>
        </button>

        <hr class="border-border-default">

        <button class="toolbar-btn group text-text-dim" title="Tắt toolbar" @click="dismiss">
          <Icon icon="lucide:x" class="w-5 h-5" />
          <span class="toolbar-label font-display tracking-wide">Tắt</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  color: var(--color-text-secondary);
  transition: all 0.2s;
  cursor: pointer;
  white-space: nowrap;
}

.toolbar-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-elevated);
}

.toolbar-label {
  font-size: 0.75rem;
}
</style>
