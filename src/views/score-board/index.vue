<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useLocalStorage } from '@vueuse/core'
import { toPng } from 'html-to-image'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string
  name: string
  color: string
}

interface GameConfig {
  autoSort: boolean
  balanceCheck: boolean
}

interface GameSession {
  name: string
  players: Player[]
  rounds: Record<string, number>[]
  config: GameConfig
  phase: 'setup' | 'playing' | 'ended'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE: readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
] = [
  '#d9654f', // coral
  '#c88b18', // amber
  '#3f7ea6', // sky
  '#0f766e', // teal
  '#7c3aed', // violet
  '#e11d48', // rose
  '#65a30d', // lime
  '#ea580c', // orange
  '#0891b2', // cyan
  '#4338ca', // indigo
]

const DEFAULT_SESSION: GameSession = {
  name: '',
  players: [],
  rounds: [],
  config: { autoSort: false, balanceCheck: false },
  phase: 'setup',
}

// ─── Persistent state ─────────────────────────────────────────────────────────

const session = useLocalStorage<GameSession>(
  'hachitu-score-board',
  structuredClone(DEFAULT_SESSION),
)

// ─── Setup screen state ───────────────────────────────────────────────────────

const setupName = ref(session.value.phase === 'setup' ? session.value.name : '')
const setupConfig = ref<GameConfig>({ autoSort: false, balanceCheck: false })

function nextColor(usedColors: string[]): string {
  return PALETTE.find((c) => !usedColors.includes(c)) ?? PALETTE[0]
}

const setupPlayers = ref<Player[]>(
  session.value.phase === 'setup' && session.value.players.length >= 2
    ? session.value.players
    : [
        { id: crypto.randomUUID(), name: '', color: PALETTE[0] },
        { id: crypto.randomUUID(), name: '', color: PALETTE[1] },
      ],
)

// sync setup state back to session while still in setup
watch(
  [setupName, setupPlayers, setupConfig],
  () => {
    if (session.value.phase !== 'setup') return
    session.value.name = setupName.value
    session.value.players = setupPlayers.value
    session.value.config = { ...setupConfig.value }
  },
  { deep: true },
)

function addSetupPlayer() {
  if (setupPlayers.value.length >= 10) return
  const used = setupPlayers.value.map((p) => p.color)
  setupPlayers.value.push({ id: crypto.randomUUID(), name: '', color: nextColor(used) })
}

function removeSetupPlayer(id: string) {
  if (setupPlayers.value.length <= 2) return
  setupPlayers.value = setupPlayers.value.filter((p) => p.id !== id)
}

function setSetupColor(id: string, hex: string) {
  const p = setupPlayers.value.find((p) => p.id === id)
  if (p) p.color = hex
}

function selectSetupColor(id: string, hex: string) {
  setSetupColor(id, hex)
  colorPickerOpen.value = null
}

function closeConfigAndEndGame() {
  showConfigSheet.value = false
  endGame()
}

function selectNewPlayerColor(hex: string) {
  newPlayerColor.value = hex
  colorPickerOpen.value = null
}

const canStart = computed(() => setupPlayers.value.filter((p) => p.name.trim()).length >= 2)

function startGame() {
  if (!canStart.value) return
  const validPlayers = setupPlayers.value
    .filter((p) => p.name.trim())
    .map((p) => ({ ...p, name: p.name.trim() }))
  session.value = {
    name: setupName.value.trim() || 'Bảng điểm',
    players: validPlayers,
    rounds: [],
    config: { ...setupConfig.value },
    phase: 'playing',
  }
  initInputs()
}

// ─── Play screen state ────────────────────────────────────────────────────────

const currentInputs = ref<Record<string, number>>({})
const deltaFlash = ref<Record<string, number>>({})
const showHistory = ref(false)
const showConfigSheet = ref(false)
const showManagePlayers = ref(false)

// inline color picker per player
const colorPickerOpen = ref<string | null>(null)

// inline name editor per player (during game)
const editingPlayerId = ref<string | null>(null)
const editingPlayerName = ref('')

// add player during game
const newPlayerName = ref('')
const newPlayerColor = ref('')

function initInputs() {
  const inputs: Record<string, number> = {}
  session.value.players.forEach((p) => {
    inputs[p.id] = 0
  })
  currentInputs.value = inputs
}

// ensure inputs are in sync when players change during game
watch(
  () => session.value.players.map((p) => p.id).join(','),
  () => {
    session.value.players.forEach((p) => {
      if (!(p.id in currentInputs.value)) currentInputs.value[p.id] = 0
    })
  },
)

// init inputs when entering play from a fresh start
watch(
  () => session.value.phase,
  (phase) => {
    if (phase === 'playing' && Object.keys(currentInputs.value).length === 0) initInputs()
  },
  { immediate: true },
)

const totalScore = (playerId: string) =>
  session.value.rounds.reduce((s, r) => s + (r[playerId] ?? 0), 0)

const displayPlayers = computed(() => {
  const ps = [...session.value.players]
  if (session.value.config.autoSort) {
    ps.sort((a, b) => totalScore(b.id) - totalScore(a.id))
  }
  return ps
})

const roundSum = computed(() =>
  session.value.players.reduce((s, p) => s + (currentInputs.value[p.id] ?? 0), 0),
)

const isBalanced = computed(() => !session.value.config.balanceCheck || roundSum.value === 0)

const allInputsZero = computed(() =>
  session.value.players.every((p) => (currentInputs.value[p.id] ?? 0) === 0),
)

const canConfirm = computed(() => isBalanced.value && !allInputsZero.value)

function changeInput(playerId: string, delta: number) {
  currentInputs.value[playerId] = (currentInputs.value[playerId] ?? 0) + delta
}

function setInput(playerId: string, val: string) {
  const n = parseInt(val, 10)
  currentInputs.value[playerId] = isNaN(n) ? 0 : n
}

function confirmRound() {
  if (!canConfirm.value) return
  const round: Record<string, number> = {}
  session.value.players.forEach((p) => {
    round[p.id] = currentInputs.value[p.id] ?? 0
  })
  session.value.rounds.push(round)
  deltaFlash.value = { ...round }
  setTimeout(() => {
    deltaFlash.value = {}
  }, 1600)
  initInputs()
}

function undoLastRound() {
  if (session.value.rounds.length === 0) return
  session.value.rounds.pop()
}

// ─── Player management during game ───────────────────────────────────────────

function openEditPlayer(p: Player) {
  editingPlayerId.value = p.id
  editingPlayerName.value = p.name
}

function saveEditPlayer() {
  const id = editingPlayerId.value
  if (!id || !editingPlayerName.value.trim()) return
  const p = session.value.players.find((p) => p.id === id)
  if (p) p.name = editingPlayerName.value.trim()
  editingPlayerId.value = null
}

function setPlayerColor(id: string, hex: string) {
  const p = session.value.players.find((p) => p.id === id)
  if (p) p.color = hex
  colorPickerOpen.value = null
}

function removePlayer(id: string) {
  if (session.value.players.length <= 2) return
  session.value.players = session.value.players.filter((p) => p.id !== id)
  session.value.rounds.forEach((r) => delete r[id])
  delete currentInputs.value[id]
}

function openAddPlayer() {
  const used = session.value.players.map((p) => p.color)
  newPlayerColor.value = nextColor(used)
  newPlayerName.value = ''
  showManagePlayers.value = true
}

function addPlayerDuringGame() {
  if (!newPlayerName.value.trim() || session.value.players.length >= 10) return
  const p: Player = {
    id: crypto.randomUUID(),
    name: newPlayerName.value.trim(),
    color: newPlayerColor.value,
  }
  session.value.players.push(p)
  session.value.rounds.forEach((r) => {
    r[p.id] = 0
  })
  currentInputs.value[p.id] = 0
  newPlayerName.value = ''
}

// ─── End screen ───────────────────────────────────────────────────────────────

const endCardRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

const finalRanking = computed(() =>
  [...session.value.players].sort((a, b) => totalScore(b.id) - totalScore(a.id)),
)

function endGame() {
  session.value.phase = 'ended'
}

function playAgain() {
  session.value.rounds = []
  session.value.phase = 'playing'
  initInputs()
}

function newGame() {
  session.value = structuredClone(DEFAULT_SESSION)
  setupName.value = ''
  setupConfig.value = { autoSort: false, balanceCheck: false }
  setupPlayers.value = [
    { id: crypto.randomUUID(), name: '', color: PALETTE[0] },
    { id: crypto.randomUUID(), name: '', color: PALETTE[1] },
  ]
}

async function exportImage() {
  if (!endCardRef.value) return
  exporting.value = true
  try {
    const dataUrl = await toPng(endCardRef.value, {
      cacheBust: true,
      backgroundColor: '#f6efe6',
      pixelRatio: 2,
    })
    const link = document.createElement('a')
    link.download = `${session.value.name || 'bang-diem'}.png`
    link.href = dataUrl
    link.click()
  } finally {
    exporting.value = false
  }
}

// ─── Grid layout & responsive sizing ─────────────────────────────────────────

const playerCount = computed(() => session.value.players.length)

// tier 0 = 2–3p (largest) → tier 3 = 9–10p (smallest)
const sizeTier = computed(() => {
  const n = playerCount.value
  if (n <= 3) return 0
  if (n <= 5) return 1
  if (n <= 7) return 2
  return 3
})

const nameSizeClass = computed(
  () => ['text-2xl', 'text-xl', 'text-base', 'text-sm'][sizeTier.value],
)
const scoreSizeClass = computed(
  () => ['text-4xl', 'text-3xl', 'text-2xl', 'text-xl'][sizeTier.value],
)
const deltaSizeClass = computed(
  () => ['text-sm', 'text-xs', 'text-xs', 'text-[10px]'][sizeTier.value],
)
const btnSizeClass = computed(() => ['size-10', 'size-9', 'size-8', 'size-7'][sizeTier.value])
const iconSizeClass = computed(() => ['size-5', 'size-4', 'size-3.5', 'size-3'][sizeTier.value])
const inputWidthClass = computed(
  () => ['w-16 text-base', 'w-14 text-sm', 'w-12 text-sm', 'w-10 text-xs'][sizeTier.value],
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colorHex(hex: string, alpha = 1) {
  // convert #rrggbb to rgba for bg tints
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function deltaValue(playerId: string): number {
  return deltaFlash.value[playerId] ?? 0
}

const MEDAL = ['🥇', '🥈', '🥉']
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <!-- ══════════════════════════════════════════════════════════════
         SETUP SCREEN
    ════════════════════════════════════════════════════════════════ -->
    <div v-if="session.phase === 'setup'" class="max-w-lg mx-auto px-4 py-10">
      <h1 class="font-display text-3xl font-bold text-accent-coral mb-1">Bảng Điểm Nhóm</h1>
      <p class="text-text-dim text-sm mb-8">Tính điểm theo ván cho mọi trò chơi</p>

      <!-- Session name -->
      <div class="mb-6">
        <label class="block text-text-dim text-xs mb-1 font-display tracking-wide"
          >TÊN PHIÊN (tùy chọn)</label
        >
        <input
          v-model="setupName"
          type="text"
          placeholder="VD: Tiến Lên tối thứ 6..."
          class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
        />
      </div>

      <!-- Players -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <label class="text-text-dim text-xs font-display tracking-wide"
            >NGƯỜI CHƠI ({{ setupPlayers.length }}/10)</label
          >
          <button
            v-if="setupPlayers.length < 10"
            class="flex items-center gap-1 text-xs text-accent-sky hover:text-text-primary transition"
            @click="addSetupPlayer"
          >
            <Icon icon="lucide:plus" class="size-3.5" />
            Thêm
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="p in setupPlayers"
            :key="p.id"
            class="border border-border-default bg-bg-surface"
            :class="colorPickerOpen === p.id ? 'border-accent-coral' : ''"
          >
            <!-- Main row -->
            <div class="flex items-center gap-2 px-3 py-2">
              <button
                class="size-7 rounded-full border-2 border-white shadow-sm shrink-0 transition hover:scale-110 ring-offset-1"
                :class="colorPickerOpen === p.id ? 'ring-2 ring-accent-coral' : ''"
                :style="{ backgroundColor: p.color }"
                @click="colorPickerOpen = colorPickerOpen === p.id ? null : p.id"
              />
              <input
                v-model="p.name"
                type="text"
                :placeholder="`Người chơi ${setupPlayers.indexOf(p) + 1}`"
                class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-dim focus:outline-none"
              />
              <button
                v-if="setupPlayers.length > 2"
                class="text-text-dim hover:text-accent-coral transition shrink-0"
                @click="removeSetupPlayer(p.id)"
              >
                <Icon icon="lucide:x" class="size-4" />
              </button>
            </div>
            <!-- Inline color palette -->
            <div
              v-if="colorPickerOpen === p.id"
              class="flex flex-wrap gap-2 px-3 py-2.5 border-t border-border-default bg-bg-elevated"
            >
              <button
                v-for="hex in PALETTE"
                :key="hex"
                class="size-7 rounded-full border-2 transition hover:scale-110 focus:outline-none"
                :class="
                  setupPlayers.some((sp) => sp.id !== p.id && sp.color === hex)
                    ? 'opacity-25 cursor-not-allowed'
                    : 'cursor-pointer hover:scale-125'
                "
                :style="{
                  backgroundColor: hex,
                  borderColor: p.color === hex ? '#2f241f' : 'white',
                }"
                :disabled="setupPlayers.some((sp) => sp.id !== p.id && sp.color === hex)"
                @click="selectSetupColor(p.id, hex)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Config -->
      <div class="mb-8 border border-border-default bg-bg-surface p-4">
        <p class="text-text-dim text-xs font-display tracking-wide mb-3">CẤU HÌNH</p>
        <label class="flex items-center gap-3 cursor-pointer mb-2.5">
          <div
            class="w-10 h-5 rounded-full transition-colors relative"
            :class="setupConfig.autoSort ? 'bg-accent-coral' : 'bg-border-default'"
            @click="setupConfig.autoSort = !setupConfig.autoSort"
          >
            <span
              class="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
              :class="setupConfig.autoSort ? 'translate-x-5' : 'translate-x-0.5'"
            />
          </div>
          <span class="text-sm text-text-secondary">Tự động sắp xếp theo hạng</span>
        </label>
        <label class="flex items-center gap-3 cursor-pointer">
          <div
            class="w-10 h-5 rounded-full transition-colors relative"
            :class="setupConfig.balanceCheck ? 'bg-accent-coral' : 'bg-border-default'"
            @click="setupConfig.balanceCheck = !setupConfig.balanceCheck"
          >
            <span
              class="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
              :class="setupConfig.balanceCheck ? 'translate-x-5' : 'translate-x-0.5'"
            />
          </div>
          <span class="text-sm text-text-secondary">Kiểm tra cân bằng điểm (tổng = 0)</span>
        </label>
      </div>

      <button
        class="w-full border border-accent-coral bg-accent-coral py-3.5 font-display font-semibold text-bg-surface transition hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!canStart"
        @click="startGame"
      >
        BẮT ĐẦU CHƠI
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         PLAY SCREEN
    ════════════════════════════════════════════════════════════════ -->
    <div v-else-if="session.phase === 'playing'" class="flex flex-col h-dvh max-w-lg mx-auto">
      <!-- Header -->
      <header
        class="flex items-center justify-between px-4 py-3 border-b border-border-default bg-bg-surface shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          <RouterLink
            to="/"
            class="size-8 shrink-0 flex items-center justify-center text-text-dim hover:text-accent-coral transition border border-border-default bg-bg-surface"
            title="Về trang chủ"
          >
            <Icon icon="lucide:home" class="size-4" />
          </RouterLink>
          <div class="min-w-0">
            <h1 class="font-display font-bold text-text-primary leading-tight truncate">
              {{ session.name }}
            </h1>
            <p class="text-text-dim text-xs">Ván {{ session.rounds.length + 1 }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="size-8 flex items-center justify-center text-text-dim hover:text-accent-sky transition border border-border-default bg-bg-surface"
            title="Lịch sử ván"
            @click="showHistory = true"
          >
            <Icon icon="lucide:clock" class="size-4" />
          </button>
          <button
            class="size-8 flex items-center justify-center text-text-dim hover:text-accent-amber transition border border-border-default bg-bg-surface"
            title="Quản lý người chơi"
            @click="openAddPlayer"
          >
            <Icon icon="lucide:users" class="size-4" />
          </button>
          <button
            class="size-8 flex items-center justify-center text-text-dim hover:text-text-primary transition border border-border-default bg-bg-surface"
            title="Cài đặt"
            @click="showConfigSheet = true"
          >
            <Icon icon="lucide:settings" class="size-4" />
          </button>
        </div>
      </header>

      <!-- Player rows: mỗi người một hàng ngang full width, chia đều chiều cao -->
      <div class="flex-1 overflow-y-auto flex flex-col">
        <div
          v-for="p in displayPlayers"
          :key="p.id"
          class="flex flex-col border-b border-border-default"
          :style="{
            borderLeftColor: p.color,
            borderLeftWidth: '4px',
            backgroundColor: colorHex(p.color, 0.05),
            flex: '1 1 0',
            minHeight: '72px',
          }"
        >
          <!-- Hàng trên: tên | điểm | [-/input/+] -->
          <div class="flex flex-row items-stretch flex-1 min-h-0">
            <!-- Trái: tên -->
            <div class="flex-1 min-w-0 flex flex-col justify-center px-3 py-2">
              <span
                class="font-display font-bold leading-tight truncate"
                :class="nameSizeClass"
                :style="{ color: p.color }"
              >
                {{ p.name }}
              </span>
            </div>

            <!-- Giữa: điểm + delta -->
            <div class="flex-1 flex flex-col items-center justify-center px-1 shrink-0">
              <span
                class="font-display font-black tabular-nums leading-none"
                :class="scoreSizeClass"
                :style="{ color: p.color }"
              >
                {{ totalScore(p.id).toLocaleString('vi-VN') }}
              </span>
              <Transition name="delta">
                <span
                  v-if="deltaValue(p.id) !== 0"
                  class="font-display font-semibold px-1 rounded mt-0.5"
                  :class="[
                    deltaSizeClass,
                    deltaValue(p.id) > 0
                      ? 'text-green-600 bg-green-100'
                      : 'text-red-600 bg-red-100',
                  ]"
                >
                  {{ deltaValue(p.id) > 0 ? '+' : '' }}{{ deltaValue(p.id) }}
                </span>
              </Transition>
            </div>

            <!-- Phải: [-] input [+] -->
            <div class="flex items-center gap-1 shrink-0 px-3">
              <button
                class="border border-border-default bg-bg-surface flex items-center justify-center text-text-secondary hover:border-accent-coral hover:text-accent-coral transition active:scale-95 select-none"
                :class="btnSizeClass"
                @click="changeInput(p.id, -1)"
              >
                <Icon icon="lucide:minus" :class="iconSizeClass" />
              </button>
              <input
                type="number"
                inputmode="numeric"
                :value="currentInputs[p.id] ?? 0"
                class="border border-border-default bg-bg-elevated text-center font-display font-semibold text-text-primary focus:border-accent-coral focus:outline-none py-1 transition"
                :class="inputWidthClass"
                @input="(e) => setInput(p.id, (e.target as HTMLInputElement).value)"
              />
              <button
                class="border border-border-default bg-bg-surface flex items-center justify-center text-text-secondary hover:border-accent-sky hover:text-accent-sky transition active:scale-95 select-none"
                :class="btnSizeClass"
                @click="changeInput(p.id, 1)"
              >
                <Icon icon="lucide:plus" :class="iconSizeClass" />
              </button>
            </div>
          </div>

          <!-- Hàng dưới: quick buttons full-width -->
          <div class="grid grid-cols-6 gap-1.5 px-3 pb-2.5 pt-0.5">
            <button
              v-for="delta in [-10, -5, -3, 3, 5, 10]"
              :key="delta"
              class="py-1.5 font-display font-bold text-xs tracking-wide border bg-bg-surface transition active:scale-95 select-none"
              :class="
                delta < 0
                  ? 'border-border-default text-accent-coral hover:border-accent-coral hover:bg-accent-coral/5'
                  : 'border-border-default text-accent-sky hover:border-accent-sky hover:bg-accent-sky/5'
              "
              @click="changeInput(p.id, delta)"
            >
              {{ delta > 0 ? '+' : '' }}{{ delta }}
            </button>
          </div>
        </div>
      </div>

      <!-- Balance indicator -->
      <div
        v-if="session.config.balanceCheck"
        class="px-4 py-2 border-t text-xs font-display flex items-center gap-2 shrink-0"
        :class="
          isBalanced
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-amber-300 bg-amber-50 text-amber-700'
        "
      >
        <Icon
          :icon="isBalanced ? 'lucide:check-circle' : 'lucide:alert-circle'"
          class="size-4 shrink-0"
        />
        <span v-if="isBalanced">Điểm cân bằng</span>
        <span v-else
          >Chưa cân bằng — tổng hiện tại:
          <strong>{{ roundSum > 0 ? '+' : '' }}{{ roundSum }}</strong> (cần = 0)</span
        >
      </div>

      <!-- Footer actions -->
      <div
        class="flex items-center gap-2 px-4 py-3 border-t border-border-default bg-bg-surface shrink-0"
      >
        <button
          class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-secondary hover:border-accent-amber hover:text-accent-amber transition disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="session.rounds.length === 0"
          @click="undoLastRound"
        >
          <Icon icon="lucide:undo-2" class="size-4" />
          Undo
        </button>

        <button
          class="flex-1 border py-2.5 font-display font-semibold text-sm transition"
          :class="
            canConfirm
              ? 'border-accent-coral bg-accent-coral text-bg-surface hover:brightness-95'
              : 'border-border-default bg-bg-elevated text-text-dim cursor-not-allowed'
          "
          :disabled="!canConfirm"
          @click="confirmRound"
        >
          XÁC NHẬN VÁN {{ session.rounds.length + 1 }}
        </button>

        <button
          class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-secondary hover:border-accent-sky hover:text-accent-sky transition"
          @click="endGame"
        >
          <Icon icon="lucide:flag" class="size-4" />
          Kết thúc
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         END SCREEN
    ════════════════════════════════════════════════════════════════ -->
    <div v-else-if="session.phase === 'ended'" class="max-w-lg mx-auto px-4 py-10">
      <!-- Exportable card -->
      <div ref="endCardRef" class="bg-bg-surface border border-border-default p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="font-display text-2xl font-bold text-text-primary">{{ session.name }}</h2>
            <p class="text-text-dim text-xs">{{ session.rounds.length }} ván · HACHITU</p>
          </div>
          <span class="text-accent-coral font-display text-sm tracking-widest">//</span>
        </div>

        <!-- Podium top 3 -->
        <div class="flex items-end justify-center gap-3 mb-6" v-if="finalRanking.length >= 2">
          <!-- 2nd -->
          <div class="flex flex-col items-center gap-1" v-if="finalRanking[1]">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-lg text-white"
              :style="{ backgroundColor: finalRanking[1].color }"
            >
              {{ finalRanking[1].name.charAt(0).toUpperCase() }}
            </div>
            <span
              class="font-display text-xs font-semibold truncate max-w-16 text-center"
              :style="{ color: finalRanking[1].color }"
              >{{ finalRanking[1].name }}</span
            >
            <span class="font-display font-bold text-sm text-text-primary">{{
              totalScore(finalRanking[1].id).toLocaleString('vi-VN')
            }}</span>
            <div
              class="w-14 h-12 flex items-center justify-center text-2xl border-t-4"
              :style="{ borderColor: finalRanking[1].color }"
            >
              🥈
            </div>
          </div>
          <!-- 1st -->
          <div class="flex flex-col items-center gap-1" v-if="finalRanking[0]">
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-xl text-white"
              :style="{ backgroundColor: finalRanking[0].color }"
            >
              {{ finalRanking[0].name.charAt(0).toUpperCase() }}
            </div>
            <span
              class="font-display text-xs font-semibold truncate max-w-20 text-center"
              :style="{ color: finalRanking[0].color }"
              >{{ finalRanking[0].name }}</span
            >
            <span class="font-display font-bold text-base text-text-primary">{{
              totalScore(finalRanking[0].id).toLocaleString('vi-VN')
            }}</span>
            <div
              class="w-16 h-16 flex items-center justify-center text-3xl border-t-4"
              :style="{ borderColor: finalRanking[0].color }"
            >
              🥇
            </div>
          </div>
          <!-- 3rd -->
          <div class="flex flex-col items-center gap-1" v-if="finalRanking[2]">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-lg text-white"
              :style="{ backgroundColor: finalRanking[2].color }"
            >
              {{ finalRanking[2].name.charAt(0).toUpperCase() }}
            </div>
            <span
              class="font-display text-xs font-semibold truncate max-w-16 text-center"
              :style="{ color: finalRanking[2].color }"
              >{{ finalRanking[2].name }}</span
            >
            <span class="font-display font-bold text-sm text-text-primary">{{
              totalScore(finalRanking[2].id).toLocaleString('vi-VN')
            }}</span>
            <div
              class="w-14 h-10 flex items-center justify-center text-2xl border-t-4"
              :style="{ borderColor: finalRanking[2].color }"
            >
              🥉
            </div>
          </div>
        </div>

        <!-- Full ranking table -->
        <div class="border border-border-default">
          <div
            v-for="(p, i) in finalRanking"
            :key="p.id"
            class="flex items-center gap-3 px-3 py-2.5 border-b border-border-default last:border-b-0"
            :style="{ borderLeftColor: p.color, borderLeftWidth: '3px' }"
          >
            <span class="font-display text-sm w-6 text-center shrink-0" :style="{ color: p.color }">
              {{ i < 3 ? MEDAL[i] : i + 1 }}
            </span>
            <span
              class="flex-1 font-display font-semibold text-sm truncate"
              :style="{ color: p.color }"
              >{{ p.name }}</span
            >
            <span class="font-display font-bold text-base" :style="{ color: p.color }">
              {{ totalScore(p.id).toLocaleString('vi-VN') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col gap-3">
        <button
          class="w-full flex items-center justify-center gap-2 border border-accent-coral bg-accent-coral py-3 font-display font-semibold text-bg-surface transition hover:brightness-95 disabled:opacity-50"
          :disabled="exporting"
          @click="exportImage"
        >
          <Icon
            :icon="exporting ? 'lucide:loader-circle' : 'lucide:image'"
            class="size-4"
            :class="exporting ? 'animate-spin' : ''"
          />
          {{ exporting ? 'Đang xuất...' : 'Xuất ảnh bảng điểm' }}
        </button>
        <div class="flex gap-3">
          <button
            class="flex-1 border border-border-default bg-bg-surface py-3 font-display font-semibold text-sm text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
            @click="playAgain"
          >
            Chơi lại
          </button>
          <button
            class="flex-1 border border-border-default bg-bg-surface py-3 font-display font-semibold text-sm text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
            @click="newGame"
          >
            Phiên mới
          </button>
        </div>
        <button
          class="w-full flex items-center justify-center gap-2 text-sm text-text-dim hover:text-accent-sky transition py-1"
          @click="showHistory = true"
        >
          <Icon icon="lucide:clock" class="size-3.5" />
          Xem lịch sử các ván
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         HISTORY DRAWER
    ════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showHistory"
          class="fixed inset-0 z-50 flex flex-col justify-end"
          @click.self="showHistory = false"
        >
          <div
            class="bg-bg-deep border-t border-border-default max-h-[85vh] flex flex-col max-w-lg mx-auto w-full"
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0"
            >
              <h2 class="font-display font-bold text-text-primary">Lịch sử ván</h2>
              <button
                class="text-text-dim hover:text-text-primary transition"
                @click="showHistory = false"
              >
                <Icon icon="lucide:x" class="size-5" />
              </button>
            </div>
            <div class="overflow-auto flex-1">
              <div
                v-if="session.rounds.length === 0"
                class="py-12 text-center text-text-dim text-sm"
              >
                Chưa có ván nào được ghi nhận
              </div>
              <table v-else class="w-full text-sm border-collapse">
                <thead>
                  <tr class="border-b border-border-default bg-bg-surface sticky top-0">
                    <th class="px-3 py-2 text-left text-text-dim font-display text-xs w-14">VÁN</th>
                    <th
                      v-for="p in session.players"
                      :key="p.id"
                      class="px-3 py-2 text-right font-display text-xs font-semibold"
                      :style="{ color: p.color }"
                    >
                      {{ p.name }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(round, i) in session.rounds"
                    :key="i"
                    class="border-b border-border-default hover:bg-bg-elevated transition"
                  >
                    <td class="px-3 py-2.5 text-text-dim font-display text-xs">{{ i + 1 }}</td>
                    <td
                      v-for="p in session.players"
                      :key="p.id"
                      class="px-3 py-2.5 text-right font-display font-semibold text-sm"
                      :class="
                        (round[p.id] ?? 0) > 0
                          ? 'text-green-600'
                          : (round[p.id] ?? 0) < 0
                            ? 'text-red-600'
                            : 'text-text-dim'
                      "
                    >
                      {{ (round[p.id] ?? 0) > 0 ? '+' : '' }}{{ round[p.id] ?? 0 }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="border-t-2 border-border-default bg-bg-surface sticky bottom-0">
                    <td class="px-3 py-2.5 text-text-dim font-display text-xs font-semibold">
                      TỔNG
                    </td>
                    <td
                      v-for="p in session.players"
                      :key="p.id"
                      class="px-3 py-2.5 text-right font-display font-bold text-base"
                      :style="{ color: p.color }"
                    >
                      {{ totalScore(p.id).toLocaleString('vi-VN') }}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════
         CONFIG SHEET (during game)
    ════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showConfigSheet"
          class="fixed inset-0 z-50 flex flex-col justify-end"
          @click.self="showConfigSheet = false"
        >
          <div class="bg-bg-deep border-t border-border-default max-w-lg mx-auto w-full">
            <div class="flex items-center justify-between px-4 py-3 border-b border-border-default">
              <h2 class="font-display font-bold text-text-primary">Cài đặt</h2>
              <button
                class="text-text-dim hover:text-text-primary transition"
                @click="showConfigSheet = false"
              >
                <Icon icon="lucide:x" class="size-5" />
              </button>
            </div>
            <div class="px-4 py-4 space-y-4">
              <label class="flex items-center justify-between cursor-pointer">
                <div>
                  <p class="text-sm font-semibold text-text-primary">Tự động sắp xếp theo hạng</p>
                  <p class="text-xs text-text-dim mt-0.5">Người dẫn đầu sẽ luôn ở trên cùng</p>
                </div>
                <div
                  class="w-10 h-5 rounded-full transition-colors relative shrink-0"
                  :class="session.config.autoSort ? 'bg-accent-coral' : 'bg-border-default'"
                  @click="session.config.autoSort = !session.config.autoSort"
                >
                  <span
                    class="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
                    :class="session.config.autoSort ? 'translate-x-5' : 'translate-x-0.5'"
                  />
                </div>
              </label>
              <label class="flex items-center justify-between cursor-pointer">
                <div>
                  <p class="text-sm font-semibold text-text-primary">Kiểm tra cân bằng điểm</p>
                  <p class="text-xs text-text-dim mt-0.5">Tổng điểm mỗi ván phải bằng 0</p>
                </div>
                <div
                  class="w-10 h-5 rounded-full transition-colors relative shrink-0"
                  :class="session.config.balanceCheck ? 'bg-accent-coral' : 'bg-border-default'"
                  @click="session.config.balanceCheck = !session.config.balanceCheck"
                >
                  <span
                    class="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
                    :class="session.config.balanceCheck ? 'translate-x-5' : 'translate-x-0.5'"
                  />
                </div>
              </label>
              <div class="pt-2 border-t border-border-default">
                <button
                  class="w-full border border-border-default py-2.5 text-sm text-text-secondary font-display hover:border-accent-coral hover:text-accent-coral transition"
                  @click="closeConfigAndEndGame"
                >
                  Kết thúc phiên chơi
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════
         MANAGE PLAYERS SHEET (during game)
    ════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showManagePlayers"
          class="fixed inset-0 z-50 flex flex-col justify-end"
          @click.self="showManagePlayers = false"
        >
          <div
            class="bg-bg-deep border-t border-border-default max-h-[80vh] flex flex-col max-w-lg mx-auto w-full"
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0"
            >
              <h2 class="font-display font-bold text-text-primary">Quản lý người chơi</h2>
              <button
                class="text-text-dim hover:text-text-primary transition"
                @click="showManagePlayers = false"
              >
                <Icon icon="lucide:x" class="size-5" />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              <div
                v-for="p in session.players"
                :key="p.id"
                class="border border-border-default bg-bg-surface"
                :class="colorPickerOpen === p.id ? 'border-accent-coral' : ''"
              >
                <!-- Main row -->
                <div class="flex items-center gap-2 px-3 py-2">
                  <button
                    class="size-7 rounded-full border-2 border-white shadow-sm shrink-0 transition hover:scale-110 ring-offset-1"
                    :class="colorPickerOpen === p.id ? 'ring-2 ring-accent-coral' : ''"
                    :style="{ backgroundColor: p.color }"
                    @click="colorPickerOpen = colorPickerOpen === p.id ? null : p.id"
                  />

                  <!-- Name (editable) -->
                  <div v-if="editingPlayerId === p.id" class="flex-1 flex items-center gap-1">
                    <input
                      v-model="editingPlayerName"
                      type="text"
                      class="flex-1 bg-bg-elevated border border-accent-coral px-2 py-1 text-sm text-text-primary focus:outline-none"
                      @keyup.enter="saveEditPlayer"
                      @keyup.escape="editingPlayerId = null"
                    />
                    <button
                      class="text-accent-coral hover:text-text-primary transition shrink-0"
                      @click="saveEditPlayer"
                    >
                      <Icon icon="lucide:check" class="size-4" />
                    </button>
                  </div>
                  <span
                    v-else
                    class="flex-1 font-display font-semibold text-sm cursor-pointer hover:underline"
                    :style="{ color: p.color }"
                    @click="openEditPlayer(p)"
                  >
                    {{ p.name }}
                  </span>

                  <span class="text-text-dim text-xs font-display w-10 text-right shrink-0">
                    {{ totalScore(p.id) }}
                  </span>

                  <button
                    v-if="session.players.length > 2"
                    class="text-text-dim hover:text-accent-coral transition shrink-0"
                    @click="removePlayer(p.id)"
                  >
                    <Icon icon="lucide:user-minus" class="size-4" />
                  </button>
                </div>
                <!-- Inline color palette -->
                <div
                  v-if="colorPickerOpen === p.id"
                  class="flex flex-wrap gap-2 px-3 py-2.5 border-t border-border-default bg-bg-elevated"
                >
                  <button
                    v-for="hex in PALETTE"
                    :key="hex"
                    class="size-7 rounded-full border-2 transition focus:outline-none"
                    :class="
                      session.players.some((sp) => sp.id !== p.id && sp.color === hex)
                        ? 'opacity-25 cursor-not-allowed'
                        : 'cursor-pointer hover:scale-125'
                    "
                    :style="{
                      backgroundColor: hex,
                      borderColor: p.color === hex ? '#2f241f' : 'white',
                    }"
                    :disabled="session.players.some((sp) => sp.id !== p.id && sp.color === hex)"
                    @click="setPlayerColor(p.id, hex)"
                  />
                </div>
              </div>
            </div>

            <!-- Add new player -->
            <div
              v-if="session.players.length < 10"
              class="px-4 py-3 border-t border-border-default shrink-0"
            >
              <p class="text-text-dim text-xs font-display tracking-wide mb-2">
                THÊM NGƯỜI CHƠI MỚI
              </p>
              <!-- Color picker for new player -->
              <div class="mb-2">
                <div class="flex items-center gap-2 mb-1.5">
                  <button
                    class="size-7 rounded-full border-2 border-white shadow-sm shrink-0 transition hover:scale-110 ring-offset-1"
                    :class="colorPickerOpen === 'new' ? 'ring-2 ring-accent-coral' : ''"
                    :style="{ backgroundColor: newPlayerColor }"
                    @click="colorPickerOpen = colorPickerOpen === 'new' ? null : 'new'"
                  />
                  <span class="text-text-dim text-xs">Chọn màu</span>
                </div>
                <div
                  v-if="colorPickerOpen === 'new'"
                  class="flex flex-wrap gap-2 p-2.5 border border-border-default bg-bg-elevated mb-2"
                >
                  <button
                    v-for="hex in PALETTE"
                    :key="hex"
                    class="size-7 rounded-full border-2 transition focus:outline-none"
                    :class="
                      session.players.some((sp) => sp.color === hex)
                        ? 'opacity-25 cursor-not-allowed'
                        : 'cursor-pointer hover:scale-125'
                    "
                    :style="{
                      backgroundColor: hex,
                      borderColor: newPlayerColor === hex ? '#2f241f' : 'white',
                    }"
                    :disabled="session.players.some((sp) => sp.color === hex)"
                    @click="selectNewPlayerColor(hex)"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="newPlayerName"
                  type="text"
                  placeholder="Tên người chơi mới..."
                  class="flex-1 border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
                  @keyup.enter="addPlayerDuringGame"
                />
                <button
                  class="border border-accent-coral bg-accent-coral px-3 py-2 text-sm font-display font-semibold text-bg-surface transition hover:brightness-95 disabled:opacity-40"
                  :disabled="!newPlayerName.trim()"
                  @click="addPlayerDuringGame"
                >
                  <Icon icon="lucide:user-plus" class="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.delta-enter-active,
.delta-leave-active {
  transition: all 0.3s ease;
}
.delta-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.8);
}
.delta-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.8);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

/* Hide number input arrows */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
