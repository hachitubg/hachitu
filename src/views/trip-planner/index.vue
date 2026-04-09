<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { toPng } from 'html-to-image'

// ─── Types ────────────────────────────────────────────────────────────────────

type TripType = 'friends' | 'family' | 'date' | 'solo' | 'team'

interface Activity {
  id: string
  day: number // 1-based day index
  time: string
  title: string
  location: string
  note: string
  icon: string
  cost: number // 0 = no cost
  done: boolean
}

interface TripPlan {
  id: string
  title: string
  description: string
  type: TripType
  date: string // start date (YYYY-MM-DD)
  days: number // number of days
  coverEmoji: string
  activities: Activity[]
  createdAt: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIP_TYPES: { id: TripType; label: string; icon: string }[] = [
  { id: 'friends', label: 'Bạn bè', icon: 'lucide:users' },
  { id: 'family', label: 'Gia đình', icon: 'lucide:home' },
  { id: 'date', label: 'Hẹn hò', icon: 'lucide:heart' },
  { id: 'solo', label: 'Một mình', icon: 'lucide:user' },
  { id: 'team', label: 'Team', icon: 'lucide:briefcase' },
]

const COVER_EMOJIS = [
  '🏖️',
  '🏕️',
  '🎢',
  '🎭',
  '🍕',
  '☕',
  '🎵',
  '🚗',
  '✈️',
  '🏔️',
  '🎯',
  '🎮',
  '🌸',
  '🌙',
  '🔥',
  '💫',
  '🎉',
  '🏄',
  '🎪',
  '🧳',
]

const ACTIVITY_ICONS = [
  { icon: 'lucide:coffee', label: 'Cafe' },
  { icon: 'lucide:utensils', label: 'Ăn uống' },
  { icon: 'lucide:map-pin', label: 'Địa điểm' },
  { icon: 'lucide:camera', label: 'Chụp ảnh' },
  { icon: 'lucide:shopping-bag', label: 'Mua sắm' },
  { icon: 'lucide:music', label: 'Giải trí' },
  { icon: 'lucide:bike', label: 'Di chuyển' },
  { icon: 'lucide:tent', label: 'Cắm trại' },
  { icon: 'lucide:waves', label: 'Biển' },
  { icon: 'lucide:mountain', label: 'Núi' },
  { icon: 'lucide:gamepad-2', label: 'Chơi game' },
  { icon: 'lucide:sparkles', label: 'Khác' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVND(n: number) {
  return Math.round(n).toLocaleString('vi-VN') + '₫'
}

function parseVNDInput(s: string): number {
  const digits = s.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

function handleVNDInput(e: Event): string {
  const raw = (e.target as HTMLInputElement).value
  const n = parseVNDInput(raw)
  const formatted = n ? n.toLocaleString('vi-VN') : ''
  ;(e.target as HTMLInputElement).value = formatted
  return formatted
}

/** Get date label for a given day (1-based) of a trip */
function dayLabel(startDate: string, day: number, short = false): string {
  const d = new Date(startDate + 'T00:00:00')
  d.setDate(d.getDate() + day - 1)
  if (short) return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatDateRange(startDate: string, days: number): string {
  const start = new Date(startDate + 'T00:00:00')
  if (days === 1)
    return start.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  const end = new Date(startDate + 'T00:00:00')
  end.setDate(end.getDate() + days - 1)
  return `${start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })} – ${end.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })}`
}

function daysUntil(d: string) {
  const diff = Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
  if (diff < 0) return `Đã qua ${Math.abs(diff)} ngày`
  if (diff === 0) return 'Hôm nay!'
  if (diff === 1) return 'Ngày mai!'
  return `Còn ${diff} ngày`
}

function tripTypeInfo(type: TripType) {
  return TRIP_TYPES.find((t) => t.id === type)!
}

function encodeTripToUrl(trip: TripPlan): string {
  const json = JSON.stringify(trip)
  const encoded = btoa(unescape(encodeURIComponent(json)))
  return `${window.location.origin}${window.location.pathname}#trip=${encoded}`
}

function decodeTripFromHash(hash: string): TripPlan | null {
  if (!hash.startsWith('#trip=')) return null
  try {
    return JSON.parse(decodeURIComponent(escape(atob(hash.slice(6))))) as TripPlan
  } catch {
    return null
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const trips = useLocalStorage<TripPlan[]>('hachitu-trip-planner-v2', [])

// ─── Navigation ───────────────────────────────────────────────────────────────

const view = ref<'list' | 'detail'>('list')
const currentTripId = ref<string | null>(null)
const currentTrip = computed(() => trips.value.find((t) => t.id === currentTripId.value) ?? null)
const activeDay = ref(1)

function openTrip(id: string) {
  currentTripId.value = id
  view.value = 'detail'
  activeDay.value = 1
}

function backToList() {
  view.value = 'list'
  currentTripId.value = null
}

// ─── Shared link on mount ─────────────────────────────────────────────────────

onMounted(() => {
  const shared = decodeTripFromHash(window.location.hash)
  if (shared) {
    const idx = trips.value.findIndex((t) => t.id === shared.id)
    if (idx !== -1) trips.value[idx] = shared
    else trips.value.unshift(shared)
    history.replaceState(null, '', window.location.pathname)
    openTrip(shared.id)
  }
})

// ─── Create trip ──────────────────────────────────────────────────────────────

const showCreateSheet = ref(false)
const createForm = ref({
  title: '',
  description: '',
  type: 'friends' as TripType,
  date: '',
  days: 2,
  coverEmoji: '🏖️',
})
const createError = ref('')

function openCreate() {
  createForm.value = {
    title: '',
    description: '',
    type: 'friends',
    date: '',
    days: 2,
    coverEmoji: '🏖️',
  }
  createError.value = ''
  showCreateSheet.value = true
}

function submitCreate() {
  if (!createForm.value.title.trim()) {
    createError.value = 'Tên kế hoạch không được để trống'
    return
  }
  if (!createForm.value.date) {
    createError.value = 'Vui lòng chọn ngày bắt đầu'
    return
  }
  const trip: TripPlan = {
    id: crypto.randomUUID(),
    title: createForm.value.title.trim(),
    description: createForm.value.description.trim(),
    type: createForm.value.type,
    date: createForm.value.date,
    days: Math.max(1, Math.min(14, createForm.value.days)),
    coverEmoji: createForm.value.coverEmoji,
    activities: [],
    createdAt: Date.now(),
  }
  trips.value.unshift(trip)
  showCreateSheet.value = false
  openTrip(trip.id)
}

function confirmDeleteTrip(id: string) {
  if (confirm('Xóa kế hoạch này?')) {
    trips.value = trips.value.filter((t) => t.id !== id)
    if (currentTripId.value === id) backToList()
  }
}

// ─── Activities ───────────────────────────────────────────────────────────────

const showActivitySheet = ref(false)
const actForm = ref({
  day: 1,
  time: '09:00',
  title: '',
  location: '',
  note: '',
  icon: 'lucide:map-pin',
  costDisplay: '',
})

function openAddActivity() {
  actForm.value = {
    day: activeDay.value,
    time: '09:00',
    title: '',
    location: '',
    note: '',
    icon: 'lucide:map-pin',
    costDisplay: '',
  }
  showActivitySheet.value = true
}

const actFormCost = computed(() => parseVNDInput(actForm.value.costDisplay))

function submitActivity() {
  const t = currentTrip.value
  if (!t || !actForm.value.title.trim()) return
  t.activities.push({
    id: crypto.randomUUID(),
    day: actForm.value.day,
    time: actForm.value.time,
    title: actForm.value.title.trim(),
    location: actForm.value.location.trim(),
    note: actForm.value.note.trim(),
    icon: actForm.value.icon,
    cost: actFormCost.value,
    done: false,
  })
  t.activities.sort((a, b) => (a.day !== b.day ? a.day - b.day : a.time.localeCompare(b.time)))
  showActivitySheet.value = false
}

function toggleActivity(id: string) {
  const act = currentTrip.value?.activities.find((a) => a.id === id)
  if (act) act.done = !act.done
}

function removeActivity(id: string) {
  const t = currentTrip.value
  if (t) t.activities = t.activities.filter((a) => a.id !== id)
}

const activitiesForDay = computed(
  () => currentTrip.value?.activities.filter((a) => (a.day ?? 1) === activeDay.value) ?? [],
)

const totalCost = computed(
  () => currentTrip.value?.activities.reduce((s, a) => s + (a.cost ?? 0), 0) ?? 0,
)

const totalCostForDay = computed(() =>
  activitiesForDay.value.reduce((s, a) => s + (a.cost ?? 0), 0),
)

// ─── Export ───────────────────────────────────────────────────────────────────

const exportCardRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

async function exportImage() {
  if (!exportCardRef.value || !currentTrip.value) return
  exporting.value = true
  try {
    const url = await toPng(exportCardRef.value, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: '#f6efe6',
      style: { fontFamily: "'Be Vietnam Pro', sans-serif" },
    })
    const a = document.createElement('a')
    a.download = `${currentTrip.value.title || 'ke-hoach'}.png`
    a.href = url
    a.click()
  } finally {
    exporting.value = false
  }
}

// ─── Share link ───────────────────────────────────────────────────────────────

const shareMsg = ref('')

async function shareLink() {
  if (!currentTrip.value) return
  const url = encodeTripToUrl(currentTrip.value)
  try {
    await navigator.clipboard.writeText(url)
    shareMsg.value = 'Đã sao chép link!'
  } catch {
    shareMsg.value = 'Không sao chép được, thử lại'
  }
  setTimeout(() => {
    shareMsg.value = ''
  }, 3000)
}
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <!-- ══════════════════════════════════════════════════════════════
         LIST VIEW
    ════════════════════════════════════════════════════════════════ -->
    <div v-if="view === 'list'" class="max-w-lg mx-auto px-4 py-10">
      <RouterLink
        to="/"
        class="inline-flex items-center gap-1.5 text-text-dim hover:text-accent-coral text-sm mb-8 transition"
      >
        <Icon icon="lucide:arrow-left" class="size-4" />Trang chủ
      </RouterLink>

      <h1 class="font-display text-3xl font-bold text-accent-coral mb-1">Lập Kế Hoạch</h1>
      <p class="text-text-dim text-sm mb-8">
        Lịch trình theo ngày, chi phí từng hoạt động, xuất ảnh & chia sẻ link
      </p>

      <!-- Empty state -->
      <div
        v-if="trips.length === 0"
        class="flex flex-col items-center justify-center gap-5 py-20 text-center"
      >
        <div class="text-6xl">🗺️</div>
        <div>
          <p class="font-display text-lg font-semibold text-text-primary">Chưa có kế hoạch nào</p>
          <p class="text-text-dim text-sm mt-1">Tạo kế hoạch đầu tiên để bắt đầu</p>
        </div>
        <button
          class="flex items-center gap-2 border border-accent-coral bg-accent-coral px-6 py-3 font-display font-semibold text-bg-surface text-sm transition hover:brightness-95"
          @click="openCreate"
        >
          <Icon icon="lucide:plus" class="size-4" />Tạo kế hoạch mới
        </button>
      </div>

      <!-- Trip list -->
      <div v-else class="space-y-3">
        <div
          v-for="trip in trips"
          :key="trip.id"
          class="group border border-border-default bg-bg-surface hover:border-accent-coral/50 transition cursor-pointer"
          @click="openTrip(trip.id)"
        >
          <div class="flex items-start gap-3 p-4">
            <span class="text-3xl leading-none shrink-0 mt-0.5">{{ trip.coverEmoji }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h2 class="font-display font-bold text-text-primary text-base leading-tight">
                  {{ trip.title }}
                </h2>
                <button
                  class="shrink-0 text-text-dim hover:text-accent-coral transition opacity-0 group-hover:opacity-100 p-0.5"
                  @click.stop="confirmDeleteTrip(trip.id)"
                >
                  <Icon icon="lucide:trash-2" class="size-3.5" />
                </button>
              </div>
              <p v-if="trip.description" class="text-text-dim text-xs mt-0.5 truncate">
                {{ trip.description }}
              </p>
              <div class="flex items-center gap-2 mt-2 flex-wrap">
                <span class="inline-flex items-center gap-1 text-xs text-accent-amber">
                  <Icon icon="lucide:calendar" class="size-3" />{{
                    formatDateRange(trip.date, trip.days ?? 1)
                  }}
                </span>
                <span class="text-xs font-semibold text-accent-coral">{{
                  daysUntil(trip.date)
                }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="inline-flex items-center gap-1 text-xs text-text-dim">
                  <Icon :icon="tripTypeInfo(trip.type).icon" class="size-3" />{{
                    tripTypeInfo(trip.type).label
                  }}
                </span>
                <span class="inline-flex items-center gap-1 text-xs text-text-dim">
                  <Icon icon="lucide:sun" class="size-3" />{{ trip.days ?? 1 }} ngày
                </span>
                <span
                  v-if="trip.activities.length > 0"
                  class="inline-flex items-center gap-1 text-xs text-text-dim"
                >
                  <Icon icon="lucide:map-pin" class="size-3" />{{ trip.activities.length }} địa điểm
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- FAB -->
      <button
        v-if="trips.length > 0"
        class="fixed bottom-4 right-4 z-30 size-12 rounded-full bg-accent-coral text-white shadow-lg flex items-center justify-center hover:brightness-95 transition active:scale-95"
        @click="openCreate"
      >
        <Icon icon="lucide:plus" class="size-6" />
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         DETAIL VIEW
    ════════════════════════════════════════════════════════════════ -->
    <div v-else-if="view === 'detail' && currentTrip" class="flex flex-col h-dvh max-w-2xl mx-auto">
      <!-- Header -->
      <header class="shrink-0 border-b border-border-default bg-bg-surface px-4 py-3">
        <div class="flex items-start gap-3 mb-3">
          <button
            class="size-8 shrink-0 flex items-center justify-center text-text-dim hover:text-accent-coral transition border border-border-default bg-bg-surface mt-0.5"
            @click="backToList"
          >
            <Icon icon="lucide:arrow-left" class="size-4" />
          </button>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-lg leading-none">{{ currentTrip.coverEmoji }}</span>
              <h1 class="font-display font-bold text-text-primary leading-tight truncate">
                {{ currentTrip.title }}
              </h1>
            </div>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs">
              <span class="text-accent-amber">{{
                formatDateRange(currentTrip.date, currentTrip.days ?? 1)
              }}</span>
              <span class="text-accent-coral font-semibold">{{ daysUntil(currentTrip.date) }}</span>
              <span v-if="totalCost > 0" class="text-text-dim">·</span>
              <span v-if="totalCost > 0" class="text-accent-amber font-semibold">{{
                fmtVND(totalCost)
              }}</span>
            </div>
          </div>
        </div>

        <!-- Export + Share — nổi bật -->
        <div class="grid grid-cols-2 gap-2">
          <button
            class="flex items-center justify-center gap-2 border border-accent-coral bg-accent-coral py-2.5 font-display font-semibold text-bg-surface text-sm transition hover:brightness-95 disabled:opacity-50"
            :disabled="exporting"
            @click="exportImage"
          >
            <Icon
              :icon="exporting ? 'lucide:loader-circle' : 'lucide:image-down'"
              class="size-4"
              :class="exporting ? 'animate-spin' : ''"
            />
            {{ exporting ? 'Đang xuất...' : 'Xuất ảnh' }}
          </button>
          <div class="relative">
            <button
              class="w-full flex items-center justify-center gap-2 border border-accent-sky text-accent-sky py-2.5 font-display font-semibold text-sm transition hover:bg-accent-sky/10"
              @click="shareLink"
            >
              <Icon icon="lucide:share-2" class="size-4" />Gửi link
            </button>
            <div
              v-if="shareMsg"
              class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-bg-surface border border-border-default px-2.5 py-1 text-xs font-semibold text-accent-sky shadow-sm"
            >
              {{ shareMsg }}
            </div>
          </div>
        </div>
      </header>

      <!-- Day selector -->
      <div class="shrink-0 border-b border-border-default bg-bg-elevated overflow-x-auto">
        <div class="flex min-w-max">
          <button
            v-for="d in currentTrip.days ?? 1"
            :key="d"
            class="flex flex-col items-center px-4 py-2.5 border-b-2 transition shrink-0"
            :class="
              activeDay === d
                ? 'border-accent-coral text-accent-coral'
                : 'border-transparent text-text-dim hover:text-text-secondary'
            "
            @click="activeDay = d"
          >
            <span class="font-display text-xs font-bold tracking-wide">Ngày {{ d }}</span>
            <span class="text-[10px] mt-0.5 opacity-80">{{
              dayLabel(currentTrip.date, d, true)
            }}</span>
          </button>
        </div>
      </div>

      <!-- Activities for selected day -->
      <div class="flex-1 overflow-y-auto">
        <div class="px-4 py-4">
          <!-- Day header -->
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="font-display font-bold text-text-primary">
                {{ dayLabel(currentTrip.date, activeDay) }}
              </p>
              <p v-if="totalCostForDay > 0" class="text-xs text-accent-amber mt-0.5">
                Chi phí hôm nay: <span class="font-semibold">{{ fmtVND(totalCostForDay) }}</span>
              </p>
            </div>
            <button
              class="flex items-center gap-1.5 text-xs text-accent-sky hover:text-text-primary transition font-display font-semibold"
              @click="openAddActivity"
            >
              <Icon icon="lucide:plus" class="size-3.5" />Thêm
            </button>
          </div>

          <!-- Empty state for this day -->
          <div
            v-if="activitiesForDay.length === 0"
            class="flex flex-col items-center justify-center gap-3 py-16 text-center border border-dashed border-border-default"
          >
            <Icon icon="lucide:calendar-clock" class="size-9 text-text-dim/30" />
            <p class="text-text-dim text-sm">Ngày {{ activeDay }} chưa có hoạt động</p>
            <button
              class="flex items-center gap-1.5 border border-accent-sky text-accent-sky px-4 py-2 text-xs font-display font-semibold transition hover:bg-accent-sky/10"
              @click="openAddActivity"
            >
              <Icon icon="lucide:plus" class="size-3.5" />Thêm hoạt động
            </button>
          </div>

          <!-- Timeline -->
          <div v-else class="relative">
            <div
              v-if="activitiesForDay.length > 1"
              class="absolute top-[18px] bottom-[18px] left-[18px] w-px bg-border-default"
            />
            <div
              v-for="act in activitiesForDay"
              :key="act.id"
              class="group relative flex gap-3 py-1.5"
              :class="act.done ? 'opacity-55' : ''"
            >
              <!-- Icon dot -->
              <button
                class="relative z-10 size-9 shrink-0 flex items-center justify-center border transition"
                :class="
                  act.done
                    ? 'border-accent-sky/50 bg-accent-sky/10 text-accent-sky'
                    : 'border-border-default bg-bg-surface text-text-dim hover:border-accent-coral hover:text-accent-coral'
                "
                @click="toggleActivity(act.id)"
              >
                <Icon v-if="act.done" icon="lucide:check" class="size-4" />
                <Icon v-else :icon="act.icon" class="size-4" />
              </button>
              <!-- Card -->
              <div
                class="flex-1 border border-border-default bg-bg-surface px-3 py-2.5 hover:bg-bg-elevated transition"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-display text-xs font-semibold text-accent-amber shrink-0">{{
                        act.time
                      }}</span>
                      <span
                        class="text-sm font-semibold"
                        :class="act.done ? 'line-through text-text-dim' : 'text-text-primary'"
                        >{{ act.title }}</span
                      >
                      <span
                        v-if="act.cost > 0"
                        class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber text-[10px] font-display font-bold shrink-0"
                      >
                        {{ fmtVND(act.cost) }}
                      </span>
                    </div>
                    <p
                      v-if="act.location"
                      class="inline-flex items-center gap-1 text-xs text-text-dim mt-0.5"
                    >
                      <Icon icon="lucide:map-pin" class="size-3 shrink-0" />{{ act.location }}
                    </p>
                    <p v-if="act.note" class="text-xs text-text-dim/70 italic mt-0.5">
                      {{ act.note }}
                    </p>
                  </div>
                  <button
                    class="shrink-0 text-text-dim hover:text-accent-coral transition opacity-0 group-hover:opacity-100 p-0.5"
                    @click="removeActivity(act.id)"
                  >
                    <Icon icon="lucide:trash-2" class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Day total cost (shown at bottom of timeline) -->
          <div
            v-if="totalCostForDay > 0 && activitiesForDay.length > 1"
            class="mt-3 flex items-center justify-end gap-2 text-xs text-text-dim border-t border-border-default pt-3"
          >
            Tổng ngày {{ activeDay }}:
            <span class="font-display font-bold text-accent-amber text-sm">{{
              fmtVND(totalCostForDay)
            }}</span>
          </div>

          <!-- Bottom padding -->
          <div class="h-20" />
        </div>
      </div>

      <!-- FAB -->
      <button
        class="fixed bottom-6 right-4 z-30 size-12 rounded-full bg-accent-coral text-white shadow-lg flex items-center justify-center hover:brightness-95 transition active:scale-95"
        @click="openAddActivity"
      >
        <Icon icon="lucide:plus" class="size-6" />
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         EXPORT CARD — full inline styles, renders mọi ngày
    ════════════════════════════════════════════════════════════════ -->
    <div style="position: fixed; top: 0; left: -9999px; z-index: -1" aria-hidden="true">
      <div
        v-if="currentTrip"
        ref="exportCardRef"
        style="
          width: 500px;
          background: #f6efe6;
          padding: 28px;
          font-family: 'Be Vietnam Pro', sans-serif;
          color: #2f241f;
        "
      >
        <!-- Trip header -->
        <div
          style="
            display: flex;
            align-items: flex-start;
            gap: 14px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e8ddd2;
          "
        >
          <span style="font-size: 44px; line-height: 1; flex-shrink: 0">{{
            currentTrip.coverEmoji
          }}</span>
          <div style="flex: 1">
            <div
              style="
                font-size: 22px;
                font-weight: 800;
                color: #2f241f;
                line-height: 1.2;
                margin-bottom: 6px;
              "
            >
              {{ currentTrip.title }}
            </div>
            <div
              v-if="currentTrip.description"
              style="font-size: 12px; color: #8a7060; margin-bottom: 6px"
            >
              {{ currentTrip.description }}
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
              <span style="font-size: 12px; color: #c88b18; font-weight: 600">
                📅 {{ formatDateRange(currentTrip.date, currentTrip.days ?? 1) }}
              </span>
              <span style="font-size: 11px; color: #8a7060; font-weight: 600">
                {{ tripTypeInfo(currentTrip.type).label }}
                · {{ currentTrip.days ?? 1 }} ngày
              </span>
              <span v-if="totalCost > 0" style="font-size: 13px; color: #d9654f; font-weight: 800">
                💰 {{ fmtVND(totalCost) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Each day -->
        <div v-for="d in currentTrip.days ?? 1" :key="d" style="margin-bottom: 16px">
          <!-- Day header -->
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 8px;
            "
          >
            <div style="display: flex; align-items: center; gap: 8px">
              <div
                style="
                  background: #d9654f;
                  color: #fff;
                  font-size: 10px;
                  font-weight: 800;
                  padding: 2px 8px;
                  letter-spacing: 0.06em;
                "
              >
                NGÀY {{ d }}
              </div>
              <span style="font-size: 12px; color: #8a7060; font-weight: 600">{{
                dayLabel(currentTrip.date, d)
              }}</span>
            </div>
            <span
              v-if="
                currentTrip.activities
                  .filter((a) => (a.day ?? 1) === d)
                  .reduce((s, a) => s + (a.cost ?? 0), 0) > 0
              "
              style="font-size: 12px; color: #c88b18; font-weight: 700"
            >
              {{
                fmtVND(
                  currentTrip.activities
                    .filter((a) => (a.day ?? 1) === d)
                    .reduce((s, a) => s + (a.cost ?? 0), 0),
                )
              }}
            </span>
          </div>

          <!-- Activities for this day -->
          <div
            v-if="currentTrip.activities.filter((a) => (a.day ?? 1) === d).length === 0"
            style="padding: 10px 12px; border: 1px dashed #e8ddd2; font-size: 12px; color: #b0a090"
          >
            Chưa có hoạt động nào
          </div>
          <div v-else style="border: 1px solid #e8ddd2; background: #fdf8f2">
            <div
              v-for="(act, idx) in currentTrip.activities.filter((a) => (a.day ?? 1) === d)"
              :key="act.id"
              :style="`display:flex;align-items:flex-start;gap:10px;padding:9px 12px;${idx > 0 ? 'border-top:1px solid #f0e8df;' : ''}${act.done ? 'opacity:0.55;' : ''}`"
            >
              <span
                style="
                  font-size: 11px;
                  font-weight: 700;
                  color: #c88b18;
                  flex-shrink: 0;
                  width: 36px;
                  padding-top: 1px;
                "
                >{{ act.time }}</span
              >
              <div style="flex: 1; min-width: 0">
                <span
                  style="font-size: 13px; font-weight: 600; color: #2f241f"
                  :style="act.done ? 'text-decoration:line-through;' : ''"
                  >{{ act.title }}</span
                >
                <span v-if="act.location" style="font-size: 11px; color: #8a7060; margin-left: 6px"
                  >— {{ act.location }}</span
                >
                <div
                  v-if="act.note"
                  style="font-size: 11px; color: #b0a090; font-style: italic; margin-top: 2px"
                >
                  {{ act.note }}
                </div>
              </div>
              <span
                v-if="act.cost > 0"
                style="
                  font-size: 12px;
                  font-weight: 700;
                  color: #c88b18;
                  flex-shrink: 0;
                  white-space: nowrap;
                "
              >
                {{ fmtVND(act.cost) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 12px;
            border-top: 1px solid #e8ddd2;
            margin-top: 4px;
          "
        >
          <span style="font-size: 10px; color: #8a7060; letter-spacing: 0.08em"
            >HACHITU · Lập Kế Hoạch Đi Chơi</span
          >
          <span v-if="totalCost > 0" style="font-size: 14px; font-weight: 900; color: #d9654f">
            Tổng: {{ fmtVND(totalCost) }}
          </span>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         CREATE SHEET
    ════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showCreateSheet"
          class="fixed inset-0 z-50 flex flex-col justify-end"
          @click.self="showCreateSheet = false"
        >
          <div
            class="bg-bg-deep border-t border-border-default max-h-[92vh] flex flex-col max-w-2xl mx-auto w-full"
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0"
            >
              <h2 class="font-display font-bold text-text-primary">Kế hoạch mới</h2>
              <button
                class="text-text-dim hover:text-text-primary transition"
                @click="showCreateSheet = false"
              >
                <Icon icon="lucide:x" class="size-5" />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 px-4 py-4 space-y-5">
              <!-- Cover emoji -->
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-2"
                  >BIỂU TƯỢNG</label
                >
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="e in COVER_EMOJIS"
                    :key="e"
                    class="size-10 flex items-center justify-center text-xl border transition"
                    :class="
                      createForm.coverEmoji === e
                        ? 'border-accent-coral bg-accent-coral/10 scale-110'
                        : 'border-border-default bg-bg-surface hover:border-accent-coral/50'
                    "
                    @click="createForm.coverEmoji = e"
                  >
                    {{ e }}
                  </button>
                </div>
              </div>

              <!-- Title -->
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >TÊN KẾ HOẠCH *</label
                >
                <input
                  v-model="createForm.title"
                  type="text"
                  placeholder="VD: Đà Lạt 4 ngày 3 đêm, Phú Quốc tháng 7..."
                  class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
                />
              </div>

              <!-- Description -->
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >MÔ TẢ</label
                >
                <textarea
                  v-model="createForm.description"
                  rows="2"
                  placeholder="Ghi chú thêm..."
                  class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition resize-none"
                />
              </div>

              <!-- Start date + Number of days -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                    >NGÀY BẮT ĐẦU *</label
                  >
                  <input
                    v-model="createForm.date"
                    type="date"
                    class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-accent-coral focus:outline-none transition"
                  />
                </div>
                <div>
                  <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                    >SỐ NGÀY</label
                  >
                  <div class="flex items-center gap-2">
                    <button
                      class="size-10 shrink-0 border border-border-default bg-bg-surface flex items-center justify-center text-text-dim hover:text-accent-coral transition"
                      @click="createForm.days = Math.max(1, createForm.days - 1)"
                    >
                      <Icon icon="lucide:minus" class="size-3.5" />
                    </button>
                    <span
                      class="flex-1 text-center font-display font-bold text-text-primary text-lg"
                      >{{ createForm.days }}</span
                    >
                    <button
                      class="size-10 shrink-0 border border-border-default bg-bg-surface flex items-center justify-center text-text-dim hover:text-accent-coral transition"
                      @click="createForm.days = Math.min(14, createForm.days + 1)"
                    >
                      <Icon icon="lucide:plus" class="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Trip type -->
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-2"
                  >ĐI CÙNG AI?</label
                >
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="t in TRIP_TYPES"
                    :key="t.id"
                    class="inline-flex items-center gap-1.5 border px-3 py-2 text-sm transition"
                    :class="
                      createForm.type === t.id
                        ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                        : 'border-border-default text-text-dim hover:bg-bg-elevated'
                    "
                    @click="createForm.type = t.id"
                  >
                    <Icon :icon="t.icon" class="size-4" />{{ t.label }}
                  </button>
                </div>
              </div>

              <p v-if="createError" class="text-xs text-accent-coral">{{ createError }}</p>
            </div>

            <div class="px-4 py-3 border-t border-border-default shrink-0">
              <button
                class="w-full flex items-center justify-center gap-2 border border-accent-coral bg-accent-coral py-3 font-display font-semibold text-bg-surface transition hover:brightness-95"
                @click="submitCreate"
              >
                <Icon icon="lucide:rocket" class="size-4" />TẠO KẾ HOẠCH
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════
         ADD ACTIVITY SHEET
    ════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showActivitySheet"
          class="fixed inset-0 z-50 flex flex-col justify-end"
          @click.self="showActivitySheet = false"
        >
          <div
            class="bg-bg-deep border-t border-border-default max-h-[90vh] flex flex-col max-w-2xl mx-auto w-full"
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0"
            >
              <h2 class="font-display font-bold text-text-primary">Thêm hoạt động</h2>
              <button
                class="text-text-dim hover:text-text-primary transition"
                @click="showActivitySheet = false"
              >
                <Icon icon="lucide:x" class="size-5" />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <!-- Day + Time -->
              <div class="flex gap-3">
                <div class="flex-1">
                  <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                    >NGÀY</label
                  >
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="d in currentTrip?.days ?? 1"
                      :key="d"
                      class="border px-3 py-2 text-xs font-display font-semibold transition"
                      :class="
                        actForm.day === d
                          ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                          : 'border-border-default text-text-dim hover:bg-bg-elevated'
                      "
                      @click="actForm.day = d"
                    >
                      Ngày {{ d }}
                    </button>
                  </div>
                </div>
                <div class="w-24 shrink-0">
                  <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                    >GIỜ</label
                  >
                  <input
                    v-model="actForm.time"
                    type="time"
                    class="w-full border border-border-default bg-bg-surface px-2 py-2.5 text-sm text-text-primary focus:border-accent-coral focus:outline-none transition"
                  />
                </div>
              </div>

              <!-- Title -->
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >HOẠT ĐỘNG *</label
                >
                <input
                  v-model="actForm.title"
                  type="text"
                  placeholder="VD: Ăn sáng, Check-in khách sạn, Tắm biển..."
                  class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
                />
              </div>

              <!-- Location + Cost -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                    >ĐỊA ĐIỂM</label
                  >
                  <input
                    v-model="actForm.location"
                    type="text"
                    placeholder="VD: Hồ Xuân Hương..."
                    class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
                  />
                </div>
                <div>
                  <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                    >CHI PHÍ</label
                  >
                  <div class="relative">
                    <input
                      type="text"
                      inputmode="numeric"
                      placeholder="0"
                      :value="actForm.costDisplay"
                      class="w-full border border-border-default bg-bg-surface px-3 py-2.5 pr-5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
                      @input="actForm.costDisplay = handleVNDInput($event)"
                    />
                    <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim text-xs"
                      >₫</span
                    >
                  </div>
                </div>
              </div>

              <!-- Note -->
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >GHI CHÚ</label
                >
                <input
                  v-model="actForm.note"
                  type="text"
                  placeholder="Nhớ mang kem chống nắng, đặt bàn trước..."
                  class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
                />
              </div>

              <!-- Icon -->
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-2"
                  >BIỂU TƯỢNG</label
                >
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="ai in ACTIVITY_ICONS"
                    :key="ai.icon"
                    :title="ai.label"
                    class="size-9 flex items-center justify-center border transition"
                    :class="
                      actForm.icon === ai.icon
                        ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                        : 'border-border-default text-text-dim hover:bg-bg-elevated'
                    "
                    @click="actForm.icon = ai.icon"
                  >
                    <Icon :icon="ai.icon" class="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <div class="px-4 py-3 border-t border-border-default shrink-0">
              <button
                class="w-full flex items-center justify-center gap-2 border py-3 font-display font-semibold transition"
                :class="
                  actForm.title.trim()
                    ? 'border-accent-coral bg-accent-coral text-bg-surface hover:brightness-95'
                    : 'border-border-default bg-bg-elevated text-text-dim cursor-not-allowed'
                "
                :disabled="!actForm.title.trim()"
                @click="submitActivity"
              >
                <Icon icon="lucide:plus" class="size-4" />THÊM VÀO LỊCH TRÌNH
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}
</style>
