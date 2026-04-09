<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { useLocalStorage } from '@vueuse/core'
import { toPng } from 'html-to-image'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  name: string
  color: string
  /** base64 data URL (photo) or single emoji character */
  avatar?: string
}

interface Expense {
  id: string
  title: string
  amount: number
  paidBy: string
  splitAmong: string[]
  createdAt: number
}

interface Loan {
  id: string
  lender: string
  borrower: string
  amount: number
  note: string
}

interface BillSession {
  name: string
  members: Member[]
  fundAmount: number
  fundContributors: string[]
  expenses: Expense[]
  loans: Loan[]
  phase: 'setup' | 'active'
  qrDataUrl: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#d9654f',
  '#c88b18',
  '#3f7ea6',
  '#0f766e',
  '#7c3aed',
  '#e11d48',
  '#65a30d',
  '#ea580c',
  '#0891b2',
  '#4338ca',
]

const DEFAULT_MEMBER_COLORS = [PALETTE[0] ?? '#d9654f', PALETTE[1] ?? '#c88b18'] as const

const AVATAR_EMOJIS = [
  '😀',
  '😎',
  '🤩',
  '🥳',
  '😍',
  '🤓',
  '🧑',
  '👦',
  '👧',
  '🧔',
  '💁',
  '🙋',
  '🤷',
  '💪',
  '🦸',
  '🦊',
  '🐯',
  '🐻',
  '🐼',
  '🦁',
  '🐸',
  '🐧',
  '🦋',
  '🌟',
  '⚡',
  '🎉',
  '🎮',
  '🎨',
  '🏆',
  '🍀',
  '🌈',
  '🔥',
  '🌙',
  '👑',
  '🎸',
  '🚀',
  '🦄',
  '🌸',
  '🍣',
  '🧋',
]

const DEFAULT_SESSION: BillSession = {
  name: '',
  members: [],
  fundAmount: 0,
  fundContributors: [],
  expenses: [],
  loans: [],
  phase: 'setup',
  qrDataUrl: '',
}

// ─── VND number formatting ────────────────────────────────────────────────────

/** Strip formatting → raw number string (digits only) */
function parseVNDInput(s: string): number {
  const digits = s.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

/** Format raw number → "1.000.000" (vi-VN dot thousands) */
function formatVND(n: number): string {
  if (!n) return ''
  return n.toLocaleString('vi-VN')
}

/** Handle keystrokes on a VND text input — returns new display string */
function handleVNDInput(e: Event): string {
  const raw = (e.target as HTMLInputElement).value
  const n = parseVNDInput(raw)
  const formatted = n ? n.toLocaleString('vi-VN') : ''
  ;(e.target as HTMLInputElement).value = formatted
  return formatted
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const session = useLocalStorage<BillSession>(
  'hachitu-bill-splitter',
  structuredClone(DEFAULT_SESSION),
)

// ─── Setup ────────────────────────────────────────────────────────────────────

const setupName = ref(session.value.phase === 'setup' ? session.value.name : '')
const setupFundEnabled = ref(session.value.fundAmount > 0)
const setupFundDisplay = ref(
  session.value.fundAmount > 0 ? formatVND(session.value.fundAmount) : '',
)
const colorPickerOpen = ref<string | null>(null)
const avatarPickerOpen = ref<string | null>(null)
const avatarFileInputs = ref<Record<string, HTMLInputElement | null>>({})

function nextColor(used: string[]) {
  return PALETTE.find((c) => !used.includes(c)) ?? DEFAULT_MEMBER_COLORS[0]
}

const setupMembers = ref<Member[]>(
  session.value.phase === 'setup' && session.value.members.length >= 2
    ? session.value.members
    : [
        { id: crypto.randomUUID(), name: '', color: DEFAULT_MEMBER_COLORS[0] },
        { id: crypto.randomUUID(), name: '', color: DEFAULT_MEMBER_COLORS[1] },
      ],
)

watch(
  [setupName, setupMembers, setupFundEnabled, setupFundDisplay],
  () => {
    if (session.value.phase !== 'setup') return
    session.value.name = setupName.value
    session.value.members = setupMembers.value
    session.value.fundAmount = setupFundEnabled.value ? parseVNDInput(setupFundDisplay.value) : 0
  },
  { deep: true },
)

function addSetupMember() {
  if (setupMembers.value.length >= 20) return
  const used = setupMembers.value.map((m) => m.color)
  setupMembers.value.push({ id: crypto.randomUUID(), name: '', color: nextColor(used) })
}

function removeSetupMember(id: string) {
  if (setupMembers.value.length <= 2) return
  setupMembers.value = setupMembers.value.filter((m) => m.id !== id)
}

function setSetupColor(id: string, hex: string) {
  const m = setupMembers.value.find((m) => m.id === id)
  if (m) m.color = hex
}

function toggleSetupAvatarPicker(id: string) {
  avatarPickerOpen.value = avatarPickerOpen.value === id ? null : id
  colorPickerOpen.value = null
}

function toggleSetupColorPicker(id: string) {
  colorPickerOpen.value = colorPickerOpen.value === id ? null : id
  avatarPickerOpen.value = null
}

function selectSetupColor(id: string, hex: string) {
  setSetupColor(id, hex)
  colorPickerOpen.value = null
}

function setSetupEmoji(id: string, emoji: string) {
  const m = setupMembers.value.find((m) => m.id === id)
  if (m) {
    m.avatar = emoji
    avatarPickerOpen.value = null
  }
}

function uploadSetupAvatar(id: string, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const m = setupMembers.value.find((m) => m.id === id)
    if (m) {
      m.avatar = ev.target?.result as string
      avatarPickerOpen.value = null
    }
  }
  reader.readAsDataURL(file)
}

function removeSetupAvatar(id: string) {
  const m = setupMembers.value.find((m) => m.id === id)
  if (m) m.avatar = undefined
}

const canStart = computed(() => setupMembers.value.filter((m) => m.name.trim()).length >= 2)

function startSession() {
  if (!canStart.value) return
  const members = setupMembers.value
    .filter((m) => m.name.trim())
    .map((m) => ({ ...m, name: m.name.trim() }))
  session.value = {
    name: setupName.value.trim() || 'Chi phí nhóm',
    members,
    fundAmount: setupFundEnabled.value ? parseVNDInput(setupFundDisplay.value) : 0,
    fundContributors: setupFundEnabled.value ? members.map((m) => m.id) : [],
    expenses: [],
    loans: [],
    phase: 'active',
    qrDataUrl: '',
  }
  activeTab.value = 'expenses'
}

// ─── Avatar management during active session ──────────────────────────────────

const editAvatarId = ref<string | null>(null)
const activeAvatarFileInputs = ref<Record<string, HTMLInputElement | null>>({})

function setActiveEmoji(id: string, emoji: string) {
  const m = session.value.members.find((m) => m.id === id)
  if (m) {
    m.avatar = emoji
    editAvatarId.value = null
  }
}

function uploadActiveAvatar(id: string, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const m = session.value.members.find((m) => m.id === id)
    if (m) {
      m.avatar = ev.target?.result as string
      editAvatarId.value = null
    }
  }
  reader.readAsDataURL(file)
}

function removeActiveAvatar(id: string) {
  const m = session.value.members.find((m) => m.id === id)
  if (m) m.avatar = undefined
}

// ─── Active — tabs ────────────────────────────────────────────────────────────

const activeTab = ref<'expenses' | 'loans' | 'settlement'>('expenses')

// ─── Balance calculation ──────────────────────────────────────────────────────

const balances = computed(() => {
  const bal: Record<string, number> = {}
  session.value.members.forEach((m) => {
    bal[m.id] = 0
  })

  if (session.value.fundAmount > 0 && session.value.fundContributors.length > 0) {
    const total = session.value.fundContributors.length * session.value.fundAmount
    const share = total / session.value.members.length
    session.value.fundContributors.forEach((id) => {
      bal[id] = (bal[id] ?? 0) + session.value.fundAmount
    })
    session.value.members.forEach((m) => {
      bal[m.id] = (bal[m.id] ?? 0) - share
    })
  }

  session.value.expenses.forEach((exp) => {
    if (!exp.splitAmong.length) return
    const share = exp.amount / exp.splitAmong.length
    bal[exp.paidBy] = (bal[exp.paidBy] ?? 0) + exp.amount
    exp.splitAmong.forEach((id) => {
      bal[id] = (bal[id] ?? 0) - share
    })
  })

  session.value.loans.forEach((loan) => {
    bal[loan.lender] = (bal[loan.lender] ?? 0) + loan.amount
    bal[loan.borrower] = (bal[loan.borrower] ?? 0) - loan.amount
  })

  return bal
})

// ─── Settlement algorithm (minimize transactions — greedy) ────────────────────

interface Transfer {
  from: string
  to: string
  amount: number
}

const transfers = computed((): Transfer[] => {
  const debtors: { id: string; amount: number }[] = []
  const creditors: { id: string; amount: number }[] = []

  Object.entries(balances.value).forEach(([id, bal]) => {
    if (bal < -1) debtors.push({ id, amount: -bal })
    else if (bal > 1) creditors.push({ id, amount: bal })
  })

  const result: Transfer[] = []
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.amount - a.amount)
    creditors.sort((a, b) => b.amount - a.amount)
    const debtor = debtors[0]!
    const creditor = creditors[0]!
    const amount = Math.min(debtor.amount, creditor.amount)
    result.push({ from: debtor.id, to: creditor.id, amount: Math.round(amount) })
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount < 1) debtors.shift()
    if (creditor.amount < 1) creditors.shift()
  }
  return result
})

const totalExpenses = computed(() => session.value.expenses.reduce((s, e) => s + e.amount, 0))
const totalFund = computed(() => session.value.fundContributors.length * session.value.fundAmount)

// ─── Expenses CRUD ────────────────────────────────────────────────────────────

const showExpenseSheet = ref(false)
const editingExpense = ref<Expense | null>(null)
const expForm = ref({ title: '', amountDisplay: '', paidBy: '', splitAmong: [] as string[] })

function openAddExpense() {
  editingExpense.value = null
  expForm.value = {
    title: '',
    amountDisplay: '',
    paidBy: session.value.members[0]?.id ?? '',
    splitAmong: session.value.members.map((m) => m.id),
  }
  showExpenseSheet.value = true
}

function openEditExpense(exp: Expense) {
  editingExpense.value = exp
  expForm.value = {
    title: exp.title,
    amountDisplay: formatVND(exp.amount),
    paidBy: exp.paidBy,
    splitAmong: [...exp.splitAmong],
  }
  showExpenseSheet.value = true
}

function toggleSplitMember(id: string) {
  const idx = expForm.value.splitAmong.indexOf(id)
  if (idx === -1) expForm.value.splitAmong.push(id)
  else if (expForm.value.splitAmong.length > 1) expForm.value.splitAmong.splice(idx, 1)
}

const expAmount = computed(() => parseVNDInput(expForm.value.amountDisplay))

const expSharePerPerson = computed(() => {
  if (!expAmount.value || expForm.value.splitAmong.length === 0) return 0
  return expAmount.value / expForm.value.splitAmong.length
})

const canSaveExpense = computed(
  () =>
    expForm.value.title.trim() &&
    expAmount.value > 0 &&
    expForm.value.paidBy &&
    expForm.value.splitAmong.length > 0,
)

function saveExpense() {
  if (!canSaveExpense.value) return
  if (editingExpense.value) {
    const idx = session.value.expenses.findIndex((e) => e.id === editingExpense.value!.id)
    if (idx !== -1)
      session.value.expenses[idx] = {
        ...editingExpense.value,
        title: expForm.value.title.trim(),
        amount: expAmount.value,
        paidBy: expForm.value.paidBy,
        splitAmong: expForm.value.splitAmong,
      }
  } else {
    session.value.expenses.push({
      id: crypto.randomUUID(),
      title: expForm.value.title.trim(),
      amount: expAmount.value,
      paidBy: expForm.value.paidBy,
      splitAmong: expForm.value.splitAmong,
      createdAt: Date.now(),
    })
  }
  showExpenseSheet.value = false
}

function deleteExpense(id: string) {
  session.value.expenses = session.value.expenses.filter((e) => e.id !== id)
}

// ─── Loans CRUD ───────────────────────────────────────────────────────────────

const showLoanSheet = ref(false)
const editingLoan = ref<Loan | null>(null)
const loanForm = ref({ lender: '', borrower: '', amountDisplay: '', note: '' })

function openAddLoan() {
  editingLoan.value = null
  loanForm.value = {
    lender: session.value.members[0]?.id ?? '',
    borrower: session.value.members[1]?.id ?? '',
    amountDisplay: '',
    note: '',
  }
  showLoanSheet.value = true
}

function openEditLoan(loan: Loan) {
  editingLoan.value = loan
  loanForm.value = {
    lender: loan.lender,
    borrower: loan.borrower,
    amountDisplay: formatVND(loan.amount),
    note: loan.note,
  }
  showLoanSheet.value = true
}

const loanAmount = computed(() => parseVNDInput(loanForm.value.amountDisplay))

const canSaveLoan = computed(
  () =>
    loanAmount.value > 0 &&
    loanForm.value.lender &&
    loanForm.value.borrower &&
    loanForm.value.lender !== loanForm.value.borrower,
)

function saveLoan() {
  if (!canSaveLoan.value) return
  if (editingLoan.value) {
    const idx = session.value.loans.findIndex((l) => l.id === editingLoan.value!.id)
    if (idx !== -1)
      session.value.loans[idx] = {
        ...editingLoan.value,
        lender: loanForm.value.lender,
        borrower: loanForm.value.borrower,
        amount: loanAmount.value,
        note: loanForm.value.note.trim(),
      }
  } else {
    session.value.loans.push({
      id: crypto.randomUUID(),
      lender: loanForm.value.lender,
      borrower: loanForm.value.borrower,
      amount: loanAmount.value,
      note: loanForm.value.note.trim(),
    })
  }
  showLoanSheet.value = false
}

function deleteLoan(id: string) {
  session.value.loans = session.value.loans.filter((l) => l.id !== id)
}

// ─── Fund contributors toggle ─────────────────────────────────────────────────

function toggleFundContributor(id: string) {
  const idx = session.value.fundContributors.indexOf(id)
  if (idx === -1) session.value.fundContributors.push(id)
  else session.value.fundContributors.splice(idx, 1)
}

// ─── QR code ─────────────────────────────────────────────────────────────────

const qrInputRef = ref<HTMLInputElement | null>(null)

function uploadQR(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    session.value.qrDataUrl = ev.target?.result as string
  }
  reader.readAsDataURL(file)
}

function removeQR() {
  session.value.qrDataUrl = ''
  if (qrInputRef.value) qrInputRef.value.value = ''
}

// ─── Export ───────────────────────────────────────────────────────────────────

const settlementCardRef = ref<HTMLElement | null>(null)
const exporting = ref(false)

async function exportImage() {
  if (!settlementCardRef.value) return
  exporting.value = true
  try {
    const dataUrl = await toPng(settlementCardRef.value, {
      cacheBust: true,
      backgroundColor: '#f6efe6',
      pixelRatio: 2,
    })
    const a = document.createElement('a')
    a.download = `${session.value.name || 'chi-phi-nhom'}.png`
    a.href = dataUrl
    a.click()
  } finally {
    exporting.value = false
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newSession() {
  session.value = structuredClone(DEFAULT_SESSION)
  setupName.value = ''
  setupFundEnabled.value = false
  setupFundDisplay.value = ''
  setupMembers.value = [
    { id: crypto.randomUUID(), name: '', color: DEFAULT_MEMBER_COLORS[0] },
    { id: crypto.randomUUID(), name: '', color: DEFAULT_MEMBER_COLORS[1] },
  ]
}

function memberById(id: string) {
  return session.value.members.find((m) => m.id === id)
}

function fmtVND(n: number) {
  return Math.round(n).toLocaleString('vi-VN') + '₫'
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

/** True if avatar is a photo (data URL), false if emoji or undefined */
function isPhoto(avatar?: string) {
  return avatar?.startsWith('data:') ?? false
}
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <!-- ══════════════════════════════════════════════════════════════
         SETUP SCREEN
    ════════════════════════════════════════════════════════════════ -->
    <div v-if="session.phase === 'setup'" class="max-w-lg mx-auto px-4 py-10">
      <RouterLink
        to="/"
        class="mb-6 inline-flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
      >
        <Icon icon="lucide:arrow-left" class="size-4" />
        Quay lại trang chủ
      </RouterLink>

      <h1 class="font-display text-3xl font-bold text-accent-coral mb-1">Tính Tiền Nhóm</h1>
      <p class="text-text-dim text-sm mb-8">Chia chi phí chuyến đi, du lịch, tiệc tùng</p>

      <!-- Session name -->
      <div class="mb-6">
        <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
          >TÊN CHUYẾN / SỰ KIỆN</label
        >
        <input
          v-model="setupName"
          type="text"
          placeholder="VD: Du lịch Đà Lạt tháng 5..."
          class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
        />
      </div>

      <!-- Fund -->
      <div class="mb-6 border border-border-default bg-bg-surface">
        <div class="flex items-center justify-between px-4 py-3">
          <div>
            <p class="font-semibold text-sm text-text-primary">Đóng quỹ chung</p>
            <p class="text-text-dim text-xs mt-0.5">Mỗi người đóng một khoản vào quỹ trước</p>
          </div>
          <div
            class="w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0"
            :class="setupFundEnabled ? 'bg-accent-coral' : 'bg-border-default'"
            @click="setupFundEnabled = !setupFundEnabled"
          >
            <span
              class="absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform"
              :class="setupFundEnabled ? 'translate-x-5' : 'translate-x-0.5'"
            />
          </div>
        </div>
        <div v-if="setupFundEnabled" class="border-t border-border-default px-4 py-3">
          <label class="block text-text-dim text-xs mb-1.5">SỐ TIỀN MỖI NGƯỜI ĐÓNG</label>
          <div class="relative">
            <input
              type="text"
              inputmode="numeric"
              placeholder="100.000"
              :value="setupFundDisplay"
              class="w-full border border-border-default bg-bg-elevated px-3 py-2 pr-6 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-coral focus:outline-none transition"
              @input="setupFundDisplay = handleVNDInput($event)"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim text-xs">₫</span>
          </div>
          <p
            v-if="
              parseVNDInput(setupFundDisplay) > 0 &&
              setupMembers.filter((m) => m.name.trim()).length >= 2
            "
            class="text-text-dim text-xs mt-1.5"
          >
            Tổng quỹ dự kiến:
            <span class="text-accent-amber font-semibold">{{
              fmtVND(
                parseVNDInput(setupFundDisplay) * setupMembers.filter((m) => m.name.trim()).length,
              )
            }}</span>
          </p>
        </div>
      </div>

      <!-- Members -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <label class="text-text-dim text-xs font-display tracking-wide"
            >THÀNH VIÊN ({{ setupMembers.length }}/20)</label
          >
          <button
            class="flex items-center gap-1 text-xs text-accent-sky hover:text-text-primary transition"
            @click="addSetupMember"
          >
            <Icon icon="lucide:plus" class="size-3.5" />Thêm
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="m in setupMembers"
            :key="m.id"
            class="border border-border-default bg-bg-surface"
            :class="
              colorPickerOpen === m.id || avatarPickerOpen === m.id ? 'border-accent-coral' : ''
            "
          >
            <!-- Main row -->
            <div class="flex items-center gap-2 px-3 py-2">
              <!-- Avatar trigger -->
              <button
                class="size-9 rounded-full shrink-0 overflow-hidden border-2 border-white shadow-sm transition hover:scale-110 ring-offset-1 relative"
                :class="avatarPickerOpen === m.id ? 'ring-2 ring-accent-coral' : ''"
                :style="!m.avatar || !isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
                @click="toggleSetupAvatarPicker(m.id)"
              >
                <img
                  v-if="isPhoto(m.avatar)"
                  :src="m.avatar"
                  alt=""
                  class="size-full object-cover"
                />
                <span v-else-if="m.avatar" class="text-lg leading-none">{{ m.avatar }}</span>
                <span v-else class="text-sm font-bold text-white">{{
                  m.name.charAt(0).toUpperCase() || '?'
                }}</span>
              </button>

              <!-- Color dot -->
              <button
                class="size-4 rounded-full shrink-0 border border-white shadow-sm transition hover:scale-110 ring-offset-1"
                :class="colorPickerOpen === m.id ? 'ring-2 ring-accent-coral' : ''"
                :style="{ backgroundColor: m.color }"
                @click="toggleSetupColorPicker(m.id)"
              />

              <input
                v-model="m.name"
                type="text"
                placeholder="Hãy điền tên người chơi"
                class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-dim focus:outline-none"
              />
              <button
                v-if="setupMembers.length > 2"
                class="text-text-dim hover:text-accent-coral transition shrink-0"
                @click="removeSetupMember(m.id)"
              >
                <Icon icon="lucide:x" class="size-4" />
              </button>
            </div>

            <!-- Avatar picker -->
            <div
              v-if="avatarPickerOpen === m.id"
              class="border-t border-border-default bg-bg-elevated px-3 py-3"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-text-dim text-xs font-display tracking-wide">CHỌN AVATAR</span>
                <div class="flex items-center gap-2">
                  <button
                    v-if="m.avatar"
                    class="text-xs text-text-dim hover:text-accent-coral transition flex items-center gap-1"
                    @click="removeSetupAvatar(m.id)"
                  >
                    <Icon icon="lucide:trash-2" class="size-3" />Xóa
                  </button>
                  <label
                    class="cursor-pointer text-xs text-accent-sky hover:text-text-primary transition flex items-center gap-1"
                  >
                    <Icon icon="lucide:upload" class="size-3" />Tải ảnh
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      :ref="
                        (el) => {
                          avatarFileInputs[m.id] = el as HTMLInputElement
                        }
                      "
                      @change="uploadSetupAvatar(m.id, $event)"
                    />
                  </label>
                </div>
              </div>
              <div class="grid grid-cols-10 gap-1">
                <button
                  v-for="emoji in AVATAR_EMOJIS"
                  :key="emoji"
                  class="text-xl leading-none size-8 flex items-center justify-center rounded hover:bg-bg-surface transition border-2"
                  :class="
                    m.avatar === emoji ? 'border-accent-coral bg-bg-surface' : 'border-transparent'
                  "
                  @click="setSetupEmoji(m.id, emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>

            <!-- Color palette -->
            <div
              v-if="colorPickerOpen === m.id"
              class="flex flex-wrap gap-2 px-3 py-2.5 border-t border-border-default bg-bg-elevated"
            >
              <button
                v-for="hex in PALETTE"
                :key="hex"
                class="size-7 rounded-full border-2 transition focus:outline-none"
                :class="
                  setupMembers.some((sp) => sp.id !== m.id && sp.color === hex)
                    ? 'opacity-25 cursor-not-allowed'
                    : 'cursor-pointer hover:scale-125'
                "
                :style="{
                  backgroundColor: hex,
                  borderColor: m.color === hex ? '#2f241f' : 'white',
                }"
                :disabled="setupMembers.some((sp) => sp.id !== m.id && sp.color === hex)"
                @click="selectSetupColor(m.id, hex)"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        class="w-full border border-accent-coral bg-accent-coral py-3.5 font-display font-semibold text-bg-surface transition hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!canStart"
        @click="startSession"
      >
        BẮT ĐẦU TÍNH TIỀN
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         ACTIVE SCREEN
    ════════════════════════════════════════════════════════════════ -->
    <div v-else class="flex flex-col h-dvh max-w-2xl mx-auto">
      <!-- Header -->
      <header
        class="shrink-0 border-b border-border-default bg-bg-surface px-4 py-3 flex items-center gap-3"
      >
        <RouterLink
          to="/"
          class="inline-flex shrink-0 items-center gap-2 border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-secondary transition hover:border-accent-coral hover:text-accent-coral"
        >
          <Icon icon="lucide:home" class="size-4" />
          <span class="hidden sm:inline">Trang chủ</span>
        </RouterLink>
        <div class="flex-1 min-w-0">
          <h1 class="font-display font-bold text-text-primary leading-tight truncate">
            {{ session.name }}
          </h1>
          <p class="text-text-dim text-xs">
            {{ session.members.length }} người ·
            <span class="text-accent-amber font-semibold">{{ fmtVND(totalExpenses) }}</span>
            <span v-if="totalFund > 0">
              · Quỹ <span class="text-accent-sky font-semibold">{{ fmtVND(totalFund) }}</span></span
            >
          </p>
        </div>
        <button
          class="size-8 shrink-0 flex items-center justify-center text-text-dim hover:text-accent-coral transition border border-border-default bg-bg-surface"
          @click="newSession"
        >
          <Icon icon="lucide:refresh-cw" class="size-4" />
        </button>
      </header>

      <!-- Fund contributors row -->
      <div
        v-if="session.fundAmount > 0"
        class="shrink-0 border-b border-border-default bg-bg-elevated px-4 py-2.5"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-text-dim text-xs font-display tracking-wide shrink-0"
            >QUỸ {{ fmtVND(session.fundAmount) }}/người:</span
          >
          <button
            v-for="m in session.members"
            :key="m.id"
            class="flex items-center gap-1.5 px-2 py-0.5 border text-xs font-display font-semibold transition"
            :class="
              session.fundContributors.includes(m.id)
                ? 'text-white'
                : 'border-border-default text-text-dim bg-bg-surface'
            "
            :style="
              session.fundContributors.includes(m.id)
                ? { backgroundColor: m.color, borderColor: m.color }
                : {}
            "
            @click="toggleFundContributor(m.id)"
          >
            <!-- mini avatar -->
            <span
              class="size-4 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
              :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
            >
              <img v-if="isPhoto(m.avatar)" :src="m.avatar" alt="" class="size-full object-cover" />
              <span v-else-if="m.avatar" class="text-[10px] leading-none">{{ m.avatar }}</span>
              <span v-else class="text-[9px] font-bold text-white">{{ m.name.charAt(0) }}</span>
            </span>
            {{ m.name }}
          </button>
        </div>
        <p class="text-text-dim text-xs mt-1">
          Đã đóng:
          <span class="font-semibold text-accent-sky"
            >{{ session.fundContributors.length }}/{{ session.members.length }}</span
          >
          · Tổng <span class="font-semibold text-accent-amber">{{ fmtVND(totalFund) }}</span>
        </p>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto">
        <!-- ── EXPENSES TAB ── -->
        <div v-if="activeTab === 'expenses'">
          <div
            v-if="session.expenses.length === 0"
            class="flex flex-col items-center justify-center gap-4 py-20 text-center px-4"
          >
            <div class="size-16 rounded-full bg-bg-elevated flex items-center justify-center">
              <Icon icon="lucide:receipt" class="size-8 text-accent-coral/50" />
            </div>
            <p class="font-display text-lg font-semibold text-text-primary">
              Chưa có khoản chi nào
            </p>
            <p class="text-text-dim text-sm">Thêm khoản chi đầu tiên để bắt đầu tính tiền</p>
          </div>
          <div v-else class="divide-y divide-border-default">
            <div
              v-for="exp in [...session.expenses].reverse()"
              :key="exp.id"
              class="flex items-start gap-3 px-4 py-3.5 hover:bg-bg-elevated transition"
              :style="{ borderLeftColor: memberById(exp.paidBy)?.color, borderLeftWidth: '3px' }"
            >
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-sm text-text-primary truncate">{{ exp.title }}</p>
                <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span
                    class="size-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                    :style="
                      !isPhoto(memberById(exp.paidBy)?.avatar)
                        ? { backgroundColor: memberById(exp.paidBy)?.color }
                        : {}
                    "
                  >
                    <img
                      v-if="isPhoto(memberById(exp.paidBy)?.avatar)"
                      :src="memberById(exp.paidBy)?.avatar"
                      alt=""
                      class="size-full object-cover"
                    />
                    <span
                      v-else-if="memberById(exp.paidBy)?.avatar"
                      class="text-[10px] leading-none"
                      >{{ memberById(exp.paidBy)?.avatar }}</span
                    >
                    <span v-else class="text-[9px] font-bold text-white">{{
                      memberById(exp.paidBy)?.name.charAt(0)
                    }}</span>
                  </span>
                  <span
                    class="text-xs font-display font-semibold"
                    :style="{ color: memberById(exp.paidBy)?.color }"
                    >{{ memberById(exp.paidBy)?.name }}</span
                  >
                  <span class="text-text-dim text-xs">trả ·</span>
                  <div class="flex items-center -space-x-1">
                    <span
                      v-for="id in exp.splitAmong.slice(0, 5)"
                      :key="id"
                      class="size-5 rounded-full overflow-hidden border border-white flex items-center justify-center"
                      :style="
                        !isPhoto(memberById(id)?.avatar)
                          ? { backgroundColor: memberById(id)?.color }
                          : {}
                      "
                      :title="memberById(id)?.name"
                    >
                      <img
                        v-if="isPhoto(memberById(id)?.avatar)"
                        :src="memberById(id)?.avatar"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span v-else-if="memberById(id)?.avatar" class="text-[10px] leading-none">{{
                        memberById(id)?.avatar
                      }}</span>
                      <span v-else class="text-[9px] font-bold text-white">{{
                        memberById(id)?.name.charAt(0)
                      }}</span>
                    </span>
                    <span
                      v-if="exp.splitAmong.length > 5"
                      class="size-5 rounded-full bg-bg-elevated border border-white flex items-center justify-center text-[9px] text-text-dim font-bold"
                      >+{{ exp.splitAmong.length - 5 }}</span
                    >
                  </div>
                  <span class="text-text-dim text-xs">· {{ fmtDate(exp.createdAt) }}</span>
                </div>
                <p class="text-text-dim text-xs mt-0.5">
                  Mỗi người:
                  <span class="text-text-secondary font-semibold">{{
                    fmtVND(exp.amount / exp.splitAmong.length)
                  }}</span>
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p class="font-display font-bold text-base text-text-primary">
                  {{ fmtVND(exp.amount) }}
                </p>
                <div class="flex items-center gap-1 mt-1 justify-end">
                  <button
                    class="text-text-dim hover:text-accent-amber transition"
                    @click="openEditExpense(exp)"
                  >
                    <Icon icon="lucide:pencil" class="size-3.5" />
                  </button>
                  <button
                    class="text-text-dim hover:text-accent-coral transition"
                    @click="deleteExpense(exp.id)"
                  >
                    <Icon icon="lucide:trash-2" class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="session.expenses.length > 0"
            class="border-t border-border-default bg-bg-surface px-4 py-3 flex items-center justify-between sticky bottom-0"
          >
            <span class="text-text-dim text-sm">{{ session.expenses.length }} khoản chi</span>
            <span class="font-display font-bold text-lg text-accent-coral">{{
              fmtVND(totalExpenses)
            }}</span>
          </div>
        </div>

        <!-- ── LOANS TAB ── -->
        <div v-else-if="activeTab === 'loans'">
          <div
            v-if="session.loans.length === 0"
            class="flex flex-col items-center justify-center gap-4 py-20 text-center px-4"
          >
            <div class="size-16 rounded-full bg-bg-elevated flex items-center justify-center">
              <Icon icon="lucide:handshake" class="size-8 text-accent-sky/50" />
            </div>
            <p class="font-display text-lg font-semibold text-text-primary">
              Chưa có khoản vay nào
            </p>
            <p class="text-text-dim text-sm">Ghi lại khi ai đó cho ai vay tiền mặt</p>
          </div>
          <div v-else class="divide-y divide-border-default">
            <div
              v-for="loan in session.loans"
              :key="loan.id"
              class="flex items-center gap-3 px-4 py-3.5 hover:bg-bg-elevated transition"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    class="inline-flex items-center gap-1 text-xs font-display font-semibold"
                    :style="{ color: memberById(loan.lender)?.color }"
                  >
                    <span
                      class="size-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                      :style="
                        !isPhoto(memberById(loan.lender)?.avatar)
                          ? { backgroundColor: memberById(loan.lender)?.color }
                          : {}
                      "
                    >
                      <img
                        v-if="isPhoto(memberById(loan.lender)?.avatar)"
                        :src="memberById(loan.lender)?.avatar"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span
                        v-else-if="memberById(loan.lender)?.avatar"
                        class="text-[10px] leading-none"
                        >{{ memberById(loan.lender)?.avatar }}</span
                      >
                      <span v-else class="text-[9px] font-bold text-white">{{
                        memberById(loan.lender)?.name.charAt(0)
                      }}</span>
                    </span>
                    {{ memberById(loan.lender)?.name }}
                  </span>
                  <Icon icon="lucide:arrow-right" class="size-3.5 text-text-dim shrink-0" />
                  <span
                    class="inline-flex items-center gap-1 text-xs font-display font-semibold"
                    :style="{ color: memberById(loan.borrower)?.color }"
                  >
                    <span
                      class="size-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                      :style="
                        !isPhoto(memberById(loan.borrower)?.avatar)
                          ? { backgroundColor: memberById(loan.borrower)?.color }
                          : {}
                      "
                    >
                      <img
                        v-if="isPhoto(memberById(loan.borrower)?.avatar)"
                        :src="memberById(loan.borrower)?.avatar"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span
                        v-else-if="memberById(loan.borrower)?.avatar"
                        class="text-[10px] leading-none"
                        >{{ memberById(loan.borrower)?.avatar }}</span
                      >
                      <span v-else class="text-[9px] font-bold text-white">{{
                        memberById(loan.borrower)?.name.charAt(0)
                      }}</span>
                    </span>
                    {{ memberById(loan.borrower)?.name }}
                  </span>
                </div>
                <p v-if="loan.note" class="text-text-dim text-xs mt-0.5 truncate">
                  {{ loan.note }}
                </p>
              </div>
              <div class="shrink-0 text-right">
                <p class="font-display font-bold text-base text-accent-sky">
                  {{ fmtVND(loan.amount) }}
                </p>
                <div class="flex items-center gap-1 mt-1 justify-end">
                  <button
                    class="text-text-dim hover:text-accent-amber transition"
                    @click="openEditLoan(loan)"
                  >
                    <Icon icon="lucide:pencil" class="size-3.5" />
                  </button>
                  <button
                    class="text-text-dim hover:text-accent-coral transition"
                    @click="deleteLoan(loan.id)"
                  >
                    <Icon icon="lucide:trash-2" class="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SETTLEMENT TAB ── -->
        <div v-else-if="activeTab === 'settlement'" class="px-4 py-4 space-y-4">
          <!-- Balance grid -->
          <div>
            <h2 class="font-display text-xs font-semibold text-text-dim tracking-wide mb-2">
              SỐ DƯ MỖI NGƯỜI
            </h2>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div
                v-for="m in session.members"
                :key="m.id"
                class="border border-border-default bg-bg-surface p-3 flex items-center gap-2.5"
                :style="{ borderLeftColor: m.color, borderLeftWidth: '3px' }"
              >
                <!-- Avatar -->
                <div
                  class="size-9 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm flex items-center justify-center"
                  :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
                >
                  <img
                    v-if="isPhoto(m.avatar)"
                    :src="m.avatar"
                    alt=""
                    class="size-full object-cover"
                  />
                  <span v-else-if="m.avatar" class="text-lg leading-none">{{ m.avatar }}</span>
                  <span v-else class="text-sm font-bold text-white">{{ m.name.charAt(0) }}</span>
                </div>
                <div class="min-w-0">
                  <p
                    class="font-display font-semibold text-sm truncate"
                    :style="{ color: m.color }"
                  >
                    {{ m.name }}
                  </p>
                  <p
                    class="font-display font-black text-base leading-tight"
                    :class="(balances[m.id] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'"
                  >
                    {{ (balances[m.id] ?? 0) >= 0 ? '+' : '' }}{{ fmtVND(balances[m.id] ?? 0) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Transfers -->
          <div>
            <h2 class="font-display text-xs font-semibold text-text-dim tracking-wide mb-2">
              CHUYỂN TIỀN TỐI ƯU
            </h2>
            <div
              v-if="transfers.length === 0"
              class="border border-border-default bg-bg-surface p-4 text-center"
            >
              <Icon icon="lucide:check-circle" class="size-8 text-green-500 mx-auto mb-2" />
              <p class="font-display font-semibold text-text-primary text-sm">Tất cả đã hòa!</p>
              <p class="text-text-dim text-xs mt-0.5">Không cần chuyển tiền</p>
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(t, i) in transfers"
                :key="i"
                class="flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-3"
              >
                <div
                  class="size-8 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm flex items-center justify-center"
                  :style="
                    !isPhoto(memberById(t.from)?.avatar)
                      ? { backgroundColor: memberById(t.from)?.color }
                      : {}
                  "
                >
                  <img
                    v-if="isPhoto(memberById(t.from)?.avatar)"
                    :src="memberById(t.from)?.avatar"
                    alt=""
                    class="size-full object-cover"
                  />
                  <span v-else-if="memberById(t.from)?.avatar" class="text-base leading-none">{{
                    memberById(t.from)?.avatar
                  }}</span>
                  <span v-else class="text-xs font-bold text-white">{{
                    memberById(t.from)?.name.charAt(0)
                  }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                      class="font-display font-semibold text-sm"
                      :style="{ color: memberById(t.from)?.color }"
                      >{{ memberById(t.from)?.name }}</span
                    >
                    <span class="text-text-dim text-xs">chuyển cho</span>
                    <span
                      class="font-display font-semibold text-sm"
                      :style="{ color: memberById(t.to)?.color }"
                      >{{ memberById(t.to)?.name }}</span
                    >
                  </div>
                </div>
                <div
                  class="size-8 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm flex items-center justify-center"
                  :style="
                    !isPhoto(memberById(t.to)?.avatar)
                      ? { backgroundColor: memberById(t.to)?.color }
                      : {}
                  "
                >
                  <img
                    v-if="isPhoto(memberById(t.to)?.avatar)"
                    :src="memberById(t.to)?.avatar"
                    alt=""
                    class="size-full object-cover"
                  />
                  <span v-else-if="memberById(t.to)?.avatar" class="text-base leading-none">{{
                    memberById(t.to)?.avatar
                  }}</span>
                  <span v-else class="text-xs font-bold text-white">{{
                    memberById(t.to)?.name.charAt(0)
                  }}</span>
                </div>
                <span class="font-display font-black text-lg text-accent-coral shrink-0 ml-1">{{
                  fmtVND(t.amount)
                }}</span>
              </div>
            </div>
          </div>

          <!-- QR Upload -->
          <div class="border border-border-default bg-bg-surface p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="font-semibold text-sm text-text-primary">Mã QR chuyển khoản</p>
                <p class="text-text-dim text-xs mt-0.5">Thêm QR ngân hàng vào ảnh xuất</p>
              </div>
              <button
                v-if="session.qrDataUrl"
                class="text-text-dim hover:text-accent-coral transition"
                @click="removeQR"
              >
                <Icon icon="lucide:trash-2" class="size-4" />
              </button>
            </div>
            <div v-if="session.qrDataUrl" class="flex justify-center">
              <img
                :src="session.qrDataUrl"
                alt="QR Code"
                class="h-32 w-32 object-contain border border-border-default"
              />
            </div>
            <div v-else>
              <input
                ref="qrInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="uploadQR"
              />
              <button
                class="w-full border border-dashed border-border-default py-3 flex items-center justify-center gap-2 text-sm text-text-dim hover:border-accent-sky hover:text-accent-sky transition"
                @click="qrInputRef?.click()"
              >
                <Icon icon="lucide:qr-code" class="size-4" />Tải lên ảnh QR
              </button>
            </div>
          </div>

          <!-- Edit member avatars during active session -->
          <div class="border border-border-default bg-bg-surface p-4">
            <p class="font-semibold text-sm text-text-primary mb-3">Avatar thành viên</p>
            <div class="flex flex-wrap gap-3">
              <div
                v-for="m in session.members"
                :key="m.id"
                class="flex flex-col items-center gap-1"
              >
                <button
                  class="size-10 rounded-full overflow-hidden border-2 border-white shadow-sm transition hover:scale-110 ring-offset-1"
                  :class="editAvatarId === m.id ? 'ring-2 ring-accent-coral' : ''"
                  :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
                  @click="editAvatarId = editAvatarId === m.id ? null : m.id"
                >
                  <img
                    v-if="isPhoto(m.avatar)"
                    :src="m.avatar"
                    alt=""
                    class="size-full object-cover"
                  />
                  <span
                    v-else-if="m.avatar"
                    class="text-xl leading-none flex items-center justify-center size-full"
                    >{{ m.avatar }}</span
                  >
                  <span
                    v-else
                    class="text-sm font-bold text-white flex items-center justify-center size-full"
                    >{{ m.name.charAt(0) }}</span
                  >
                </button>
                <span class="text-[10px] text-text-dim truncate max-w-12 text-center">{{
                  m.name
                }}</span>
              </div>
            </div>
            <!-- Avatar picker for active member -->
            <div v-if="editAvatarId" class="mt-3 pt-3 border-t border-border-default">
              <div class="flex items-center justify-between mb-2">
                <span class="text-text-dim text-xs"
                  >Chọn cho
                  <strong class="text-text-primary">{{
                    memberById(editAvatarId)?.name
                  }}</strong></span
                >
                <div class="flex items-center gap-2">
                  <button
                    v-if="memberById(editAvatarId)?.avatar"
                    class="text-xs text-text-dim hover:text-accent-coral transition flex items-center gap-1"
                    @click="removeActiveAvatar(editAvatarId!)"
                  >
                    <Icon icon="lucide:trash-2" class="size-3" />Xóa
                  </button>
                  <label
                    class="cursor-pointer text-xs text-accent-sky hover:text-text-primary transition flex items-center gap-1"
                  >
                    <Icon icon="lucide:upload" class="size-3" />Tải ảnh
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      :ref="
                        (el) => {
                          activeAvatarFileInputs[editAvatarId!] = el as HTMLInputElement
                        }
                      "
                      @change="uploadActiveAvatar(editAvatarId!, $event)"
                    />
                  </label>
                </div>
              </div>
              <div class="grid grid-cols-10 gap-1">
                <button
                  v-for="emoji in AVATAR_EMOJIS"
                  :key="emoji"
                  class="text-xl leading-none size-8 flex items-center justify-center rounded hover:bg-bg-elevated transition border-2"
                  :class="
                    memberById(editAvatarId)?.avatar === emoji
                      ? 'border-accent-coral bg-bg-elevated'
                      : 'border-transparent'
                  "
                  @click="setActiveEmoji(editAvatarId!, emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
          </div>

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
            {{ exporting ? 'Đang xuất...' : 'Xuất ảnh kết toán' }}
          </button>
          <div class="h-4" />
        </div>
      </div>

      <!-- FAB -->
      <button
        v-if="activeTab !== 'settlement'"
        class="fixed bottom-20 right-4 z-30 size-12 rounded-full bg-accent-coral text-white shadow-lg flex items-center justify-center hover:brightness-95 transition active:scale-95"
        @click="activeTab === 'expenses' ? openAddExpense() : openAddLoan()"
      >
        <Icon icon="lucide:plus" class="size-6" />
      </button>

      <!-- Bottom tabs -->
      <nav class="shrink-0 border-t border-border-default bg-bg-surface flex">
        <button
          v-for="tab in [
            {
              id: 'expenses',
              icon: 'lucide:receipt',
              label: 'Chi phí',
              count: session.expenses.length,
            },
            {
              id: 'loans',
              icon: 'lucide:handshake',
              label: 'Vay mượn',
              count: session.loans.length,
            },
            { id: 'settlement', icon: 'lucide:calculator', label: 'Kết toán', count: 0 },
          ]"
          :key="tab.id"
          class="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition"
          :class="
            activeTab === tab.id ? 'text-accent-coral' : 'text-text-dim hover:text-text-secondary'
          "
          @click="activeTab = tab.id as typeof activeTab"
        >
          <div class="relative">
            <Icon :icon="tab.icon" class="size-5" />
            <span
              v-if="tab.count > 0"
              class="absolute -top-1.5 -right-2 size-4 rounded-full bg-accent-coral text-white text-[9px] font-bold flex items-center justify-center leading-none"
            >
              {{ tab.count > 9 ? '9+' : tab.count }}
            </span>
          </div>
          <span class="text-[10px] font-display font-semibold tracking-wide">{{ tab.label }}</span>
        </button>
      </nav>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         EXPORT CARD (hidden off-screen)
    ════════════════════════════════════════════════════════════════ -->
    <div class="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
      <div ref="settlementCardRef" class="w-[420px] bg-bg-deep p-6 font-body">
        <div class="flex items-start justify-between mb-5">
          <div>
            <h2 class="font-display text-2xl font-bold text-text-primary leading-tight">
              {{ session.name }}
            </h2>
            <p class="text-text-dim text-xs mt-0.5">
              {{ session.members.length }} người · {{ fmtVND(totalExpenses) }} chi phí<span
                v-if="totalFund > 0"
              >
                · Quỹ {{ fmtVND(totalFund) }}</span
              >
            </p>
          </div>
          <img
            v-if="session.qrDataUrl"
            :src="session.qrDataUrl"
            alt="QR"
            class="size-20 object-contain border border-border-default shrink-0"
          />
          <span v-else class="text-accent-coral font-display text-sm tracking-widest">//</span>
        </div>
        <!-- Members row with avatars -->
        <div class="flex gap-2 flex-wrap mb-4">
          <div
            v-for="m in session.members"
            :key="m.id"
            class="flex items-center gap-1.5 border border-border-default bg-bg-surface px-2 py-1"
            :style="{ borderLeftColor: m.color, borderLeftWidth: '3px' }"
          >
            <div
              class="size-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
              :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
            >
              <img v-if="isPhoto(m.avatar)" :src="m.avatar" alt="" class="size-full object-cover" />
              <span v-else-if="m.avatar" class="text-sm leading-none">{{ m.avatar }}</span>
              <span v-else class="text-[10px] font-bold text-white">{{ m.name.charAt(0) }}</span>
            </div>
            <span class="font-display font-semibold text-xs" :style="{ color: m.color }">{{
              m.name
            }}</span>
            <span
              class="font-display font-bold text-xs"
              :class="(balances[m.id] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'"
              >{{ (balances[m.id] ?? 0) >= 0 ? '+' : '' }}{{ fmtVND(balances[m.id] ?? 0) }}</span
            >
          </div>
        </div>
        <div>
          <p class="text-text-dim text-xs font-display tracking-wide mb-2">CHUYỂN TIỀN</p>
          <div
            v-if="transfers.length === 0"
            class="text-center py-3 text-text-dim text-sm border border-border-default"
          >
            Tất cả đã hòa!
          </div>
          <div v-else class="space-y-1.5">
            <div
              v-for="(t, i) in transfers"
              :key="i"
              class="flex items-center gap-2 border border-border-default bg-bg-surface px-3 py-2"
            >
              <div
                class="size-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                :style="
                  !isPhoto(memberById(t.from)?.avatar)
                    ? { backgroundColor: memberById(t.from)?.color }
                    : {}
                "
              >
                <img
                  v-if="isPhoto(memberById(t.from)?.avatar)"
                  :src="memberById(t.from)?.avatar"
                  alt=""
                  class="size-full object-cover"
                />
                <span v-else-if="memberById(t.from)?.avatar" class="text-sm leading-none">{{
                  memberById(t.from)?.avatar
                }}</span>
                <span v-else class="text-[10px] font-bold text-white">{{
                  memberById(t.from)?.name.charAt(0)
                }}</span>
              </div>
              <span
                class="font-display font-semibold text-sm"
                :style="{ color: memberById(t.from)?.color }"
                >{{ memberById(t.from)?.name }}</span
              >
              <Icon icon="lucide:arrow-right" class="size-3.5 text-text-dim shrink-0" />
              <span
                class="font-display font-semibold text-sm"
                :style="{ color: memberById(t.to)?.color }"
                >{{ memberById(t.to)?.name }}</span
              >
              <div
                class="size-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                :style="
                  !isPhoto(memberById(t.to)?.avatar)
                    ? { backgroundColor: memberById(t.to)?.color }
                    : {}
                "
              >
                <img
                  v-if="isPhoto(memberById(t.to)?.avatar)"
                  :src="memberById(t.to)?.avatar"
                  alt=""
                  class="size-full object-cover"
                />
                <span v-else-if="memberById(t.to)?.avatar" class="text-sm leading-none">{{
                  memberById(t.to)?.avatar
                }}</span>
                <span v-else class="text-[10px] font-bold text-white">{{
                  memberById(t.to)?.name.charAt(0)
                }}</span>
              </div>
              <span class="ml-auto font-display font-black text-base text-accent-coral">{{
                fmtVND(t.amount)
              }}</span>
            </div>
          </div>
        </div>
        <p class="text-right text-text-dim text-[10px] mt-4 font-display tracking-wide">
          HACHITU · Tính Tiền Nhóm
        </p>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════
         EXPENSE SHEET
    ════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showExpenseSheet"
          class="fixed inset-0 z-50 flex flex-col justify-end"
          @click.self="showExpenseSheet = false"
        >
          <div
            class="bg-bg-deep border-t border-border-default max-h-[92vh] flex flex-col max-w-2xl mx-auto w-full"
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0"
            >
              <h2 class="font-display font-bold text-text-primary">
                {{ editingExpense ? 'Sửa khoản chi' : 'Thêm khoản chi' }}
              </h2>
              <button
                class="text-text-dim hover:text-text-primary transition"
                @click="showExpenseSheet = false"
              >
                <Icon icon="lucide:x" class="size-5" />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >TÊN KHOẢN CHI</label
                >
                <input
                  v-model="expForm.title"
                  type="text"
                  placeholder="VD: Ăn tối nhà hàng, Vé vui chơi..."
                  class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm focus:border-accent-coral focus:outline-none transition"
                />
              </div>

              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >SỐ TIỀN</label
                >
                <div class="relative">
                  <input
                    type="text"
                    inputmode="numeric"
                    placeholder="0"
                    :value="expForm.amountDisplay"
                    class="w-full border border-border-default bg-bg-surface px-3 py-2.5 pr-6 text-sm focus:border-accent-coral focus:outline-none transition"
                    @input="expForm.amountDisplay = handleVNDInput($event)"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim text-xs"
                    >₫</span
                  >
                </div>
                <p v-if="expSharePerPerson > 0" class="text-text-dim text-xs mt-1">
                  Mỗi người:
                  <span class="text-accent-amber font-semibold">{{
                    fmtVND(expSharePerPerson)
                  }}</span>
                </p>
              </div>

              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >AI TRẢ?</label
                >
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    v-for="m in session.members"
                    :key="m.id"
                    class="flex items-center gap-2 px-3 py-2 border text-sm font-display font-semibold transition"
                    :class="
                      expForm.paidBy === m.id
                        ? 'text-white'
                        : 'border-border-default text-text-secondary bg-bg-surface hover:bg-bg-elevated'
                    "
                    :style="
                      expForm.paidBy === m.id
                        ? { backgroundColor: m.color, borderColor: m.color }
                        : {}
                    "
                    @click="expForm.paidBy = m.id"
                  >
                    <span
                      class="size-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-white/30"
                      :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
                    >
                      <img
                        v-if="isPhoto(m.avatar)"
                        :src="m.avatar"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span v-else-if="m.avatar" class="text-sm leading-none">{{ m.avatar }}</span>
                      <span v-else class="text-xs font-bold text-white">{{
                        m.name.charAt(0)
                      }}</span>
                    </span>
                    {{ m.name }}
                  </button>
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-text-dim text-xs font-display tracking-wide"
                    >CHIA CHO AI?</label
                  >
                  <span class="text-text-dim text-xs">{{ expForm.splitAmong.length }} người</span>
                </div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    v-for="m in session.members"
                    :key="m.id"
                    class="flex items-center gap-2 px-3 py-2 border text-sm font-display font-semibold transition"
                    :class="
                      expForm.splitAmong.includes(m.id)
                        ? 'text-white'
                        : 'border-border-default text-text-secondary bg-bg-surface hover:bg-bg-elevated'
                    "
                    :style="
                      expForm.splitAmong.includes(m.id)
                        ? { backgroundColor: m.color, borderColor: m.color }
                        : {}
                    "
                    @click="toggleSplitMember(m.id)"
                  >
                    <span
                      class="size-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-white/30"
                      :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
                    >
                      <img
                        v-if="isPhoto(m.avatar)"
                        :src="m.avatar"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span v-else-if="m.avatar" class="text-sm leading-none">{{ m.avatar }}</span>
                      <span v-else class="text-xs font-bold text-white">{{
                        m.name.charAt(0)
                      }}</span>
                    </span>
                    {{ m.name }}
                  </button>
                </div>
              </div>
            </div>
            <div class="px-4 py-3 border-t border-border-default shrink-0">
              <button
                class="w-full border py-3 font-display font-semibold transition"
                :class="
                  canSaveExpense
                    ? 'border-accent-coral bg-accent-coral text-bg-surface hover:brightness-95'
                    : 'border-border-default bg-bg-elevated text-text-dim cursor-not-allowed'
                "
                :disabled="!canSaveExpense"
                @click="saveExpense"
              >
                {{ editingExpense ? 'LƯU THAY ĐỔI' : 'THÊM KHOẢN CHI' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ══════════════════════════════════════════════════════════════
         LOAN SHEET
    ════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="showLoanSheet"
          class="fixed inset-0 z-50 flex flex-col justify-end"
          @click.self="showLoanSheet = false"
        >
          <div
            class="bg-bg-deep border-t border-border-default max-h-[85vh] flex flex-col max-w-2xl mx-auto w-full"
          >
            <div
              class="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0"
            >
              <h2 class="font-display font-bold text-text-primary">
                {{ editingLoan ? 'Sửa khoản vay' : 'Thêm khoản vay' }}
              </h2>
              <button
                class="text-text-dim hover:text-text-primary transition"
                @click="showLoanSheet = false"
              >
                <Icon icon="lucide:x" class="size-5" />
              </button>
            </div>
            <div class="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >SỐ TIỀN</label
                >
                <div class="relative">
                  <input
                    type="text"
                    inputmode="numeric"
                    placeholder="0"
                    :value="loanForm.amountDisplay"
                    class="w-full border border-border-default bg-bg-surface px-3 py-2.5 pr-6 text-sm focus:border-accent-coral focus:outline-none transition"
                    @input="loanForm.amountDisplay = handleVNDInput($event)"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim text-xs"
                    >₫</span
                  >
                </div>
              </div>
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >NGƯỜI CHO VAY</label
                >
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    v-for="m in session.members"
                    :key="m.id"
                    class="flex items-center gap-2 px-3 py-2 border text-sm font-display font-semibold transition"
                    :class="[
                      loanForm.lender === m.id
                        ? 'text-white'
                        : 'border-border-default text-text-secondary bg-bg-surface hover:bg-bg-elevated',
                      loanForm.borrower === m.id ? 'opacity-30 cursor-not-allowed' : '',
                    ]"
                    :style="
                      loanForm.lender === m.id
                        ? { backgroundColor: m.color, borderColor: m.color }
                        : {}
                    "
                    :disabled="loanForm.borrower === m.id"
                    @click="loanForm.lender = m.id"
                  >
                    <span
                      class="size-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-white/30"
                      :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
                    >
                      <img
                        v-if="isPhoto(m.avatar)"
                        :src="m.avatar"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span v-else-if="m.avatar" class="text-sm leading-none">{{ m.avatar }}</span>
                      <span v-else class="text-xs font-bold text-white">{{
                        m.name.charAt(0)
                      }}</span>
                    </span>
                    {{ m.name }}
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >NGƯỜI VAY</label
                >
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <button
                    v-for="m in session.members"
                    :key="m.id"
                    class="flex items-center gap-2 px-3 py-2 border text-sm font-display font-semibold transition"
                    :class="[
                      loanForm.borrower === m.id
                        ? 'text-white'
                        : 'border-border-default text-text-secondary bg-bg-surface hover:bg-bg-elevated',
                      loanForm.lender === m.id ? 'opacity-30 cursor-not-allowed' : '',
                    ]"
                    :style="
                      loanForm.borrower === m.id
                        ? { backgroundColor: m.color, borderColor: m.color }
                        : {}
                    "
                    :disabled="loanForm.lender === m.id"
                    @click="loanForm.borrower = m.id"
                  >
                    <span
                      class="size-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-white/30"
                      :style="!isPhoto(m.avatar) ? { backgroundColor: m.color } : {}"
                    >
                      <img
                        v-if="isPhoto(m.avatar)"
                        :src="m.avatar"
                        alt=""
                        class="size-full object-cover"
                      />
                      <span v-else-if="m.avatar" class="text-sm leading-none">{{ m.avatar }}</span>
                      <span v-else class="text-xs font-bold text-white">{{
                        m.name.charAt(0)
                      }}</span>
                    </span>
                    {{ m.name }}
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-text-dim text-xs font-display tracking-wide mb-1.5"
                  >GHI CHÚ (tùy chọn)</label
                >
                <input
                  v-model="loanForm.note"
                  type="text"
                  placeholder="VD: Mượn mua nước trên đường..."
                  class="w-full border border-border-default bg-bg-surface px-3 py-2.5 text-sm focus:border-accent-coral focus:outline-none transition"
                />
              </div>
            </div>
            <div class="px-4 py-3 border-t border-border-default shrink-0">
              <button
                class="w-full border py-3 font-display font-semibold transition"
                :class="
                  canSaveLoan
                    ? 'border-accent-sky bg-accent-sky text-white hover:brightness-95'
                    : 'border-border-default bg-bg-elevated text-text-dim cursor-not-allowed'
                "
                :disabled="!canSaveLoan"
                @click="saveLoan"
              >
                {{ editingLoan ? 'LƯU THAY ĐỔI' : 'THÊM KHOẢN VAY' }}
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
  transition: all 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
