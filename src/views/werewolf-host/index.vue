<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import {
  useClipboard,
  useEventListener,
  useScriptTag,
  useSwipe,
  useWindowScroll,
} from '@vueuse/core'
import { useRoom } from './composables/useRoom'
import RoleCard from './components/RoleCard.vue'
import DeckEditor from './components/DeckEditor.vue'
import AvatarPicker from './components/AvatarPicker.vue'
import PlayerAvatar from './components/PlayerAvatar.vue'
import NightJournal from './components/NightJournal.vue'
import CardLibrary from './components/CardLibrary.vue'
import TargetPicker from './components/TargetPicker.vue'
import { useTargetDraft } from './composables/useTargetDraft'
import { randomAvatar } from './utils/avatars'
import { sessionStandings } from './utils/journal'
import { artStyle, phaseNames, winnerTitle } from './types'
import type { Input } from './types'
import './styles.css'

const { state, catalog, connected, busy, error, countdown, send, reconnect } = useRoom()
const targetDraft = useTargetDraft(send)
const confirmingChoice = ref(false)
let submission = 0
onScopeDispose(() => {
  submission++
})
const { copy, copied } = useClipboard()
const { y: scrollY } = useWindowScroll()
const mode = ref<'create' | 'join'>('create')
const cardsOnly = ref(false)
const manualNewGame = ref(false)
const code = ref(new URLSearchParams(location.search).get('room') || '')
if (code.value) mode.value = 'join'
const name = ref('')
const avatar = ref(randomAvatar())
const avatarPicker = ref<HTMLInputElement>()
const imageBusy = ref(false)
const revealed = ref(false)
const revealButton = ref<HTMLElement>()
const targets = ref<string[]>([])
const savePotion = ref(false)
const saveTarget = ref<string | null>(null)
const redirectFrom = ref<string | null>(null)
const ghostLetter = ref('')
const activateSkill = ref(false)
const seatDraft = ref<string[]>([])
const vote = ref<string | boolean | null>(null)
const voteChosen = ref(false)
const modal = ref<
  | 'people'
  | 'deck'
  | 'help'
  | 'history'
  | 'stats'
  | 'journal'
  | 'seats'
  | 'catalog'
  | 'qr'
  | 'reset-night'
  | 'finish-manual'
  | 'my-role'
  | null
>(null)
const confirmingAbort = ref(false)
const dialog = ref<HTMLDialogElement>()
const historyGame = ref<number | null>(null)
const people = computed(() => state.value?.members.filter((p) => !p.host) || [])
const targetCandidates = computed(() => {
  const options = new Set(state.value?.action?.options || [])
  return people.value.filter((p) => options.has(p.id))
})
const nominationCandidates = computed(() => {
  const eligible = new Set(state.value?.eligible || [])
  return people.value.filter((p) => eligible.has(p.id))
})
const me = computed(() => people.value.find((p) => p.id === state.value?.myId))
const roleById = (id: string | null | undefined) => catalog.value.find((r) => r.id === id)
const myRole = computed(() => roleById(state.value?.myRole))
const selectedRoleCounts = computed(() => {
  const counts = new Map<string, number>()
  state.value?.deck.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1))
  return [...counts].map(([id, count]) => ({ id, count, role: roleById(id) }))
})
const readyCount = computed(() => people.value.filter((p) => p.ready && p.connected).length)
const personName = (id: string | null | undefined) =>
  state.value?.members.find((p) => p.id === id)?.name || 'Không chọn'
const roleName = (id: string | null | undefined) =>
  id === 'wolves'
    ? 'Bầy Sói'
    : id === 'vampires'
      ? 'Ma cà rồng'
      : roleById(id)?.name_vi || 'Hoàn thành đêm'
const standings = computed(() =>
  sessionStandings(state.value?.members || [], state.value?.history || []),
)
const invite = computed(() =>
  state.value ? `${location.origin}/werewolf-host?room=${state.value.code}` : '',
)
const qr = ref('')
interface QrCode {
  addData(value: string): void
  make(): void
  createDataURL(size: number, margin: number): string
}
function renderQr() {
  const factory = (window as Window & { qrcode?: (version: number, level: string) => QrCode })
    .qrcode
  if (!factory || !invite.value) return
  const instance = factory(0, 'M')
  instance.addData(invite.value)
  instance.make()
  qr.value = instance.createDataURL(6, 16)
}
useScriptTag('/werewolf-host/vendor/qrcode.js', renderQr)
watch(invite, renderQr)
watch(
  () => state.value?.code,
  (value) => {
    scrollY.value = 0
    if (!value) modal.value = null
  },
)
watch(modal, async (value) => {
  confirmingAbort.value = false
  if (value === 'seats')
    seatDraft.value = [...(state.value?.seatOrder || people.value.map((p) => p.id))]
  await nextTick()
  if (value && !dialog.value?.open) dialog.value?.showModal()
  else if (!value && dialog.value?.open) dialog.value.close()
})
watch(
  [
    () => state.value?.code,
    () => state.value?.game,
    () => state.value?.revision,
    () => state.value?.action?.key,
  ],
  () => {
    targetDraft.reset()
    if (modal.value === 'my-role') modal.value = null
    submission++
    confirmingChoice.value = false
    targets.value = [...(state.value?.action?.targets || [])]
    savePotion.value = state.value?.action?.save || false
    saveTarget.value =
      state.value?.action?.saveTarget ||
      (state.value?.action?.wolfTargets?.length === 1 ? state.value.action.wolfTargets[0]! : null)
    ghostLetter.value = state.value?.action?.text || ''
    redirectFrom.value =
      state.value?.action?.redirectFrom ||
      (state.value?.action?.key === 'leprechaun' && state.value.action.wolfTargets?.length === 1
        ? state.value.action.wolfTargets[0]!
        : null)
    activateSkill.value = state.value?.action?.activate || false
    voteChosen.value = false
    vote.value = null
    revealed.value = false
  },
  { immediate: true },
)
watch(connected, (value) => {
  if (!value) {
    targetDraft.reset()
    submission++
    confirmingChoice.value = false
  }
})
let suppressRevealClickUntil = 0
function toggleReveal() {
  if (Date.now() >= suppressRevealClickUntil) revealed.value = !revealed.value
}
useSwipe(revealButton, {
  onSwipeEnd: (_event, direction) => {
    if (myRole.value && direction !== 'none') {
      revealed.value = !revealed.value
      suppressRevealClickUntil = Date.now() + 400
    }
  },
})
useEventListener(window, 'blur', () => {
  revealed.value = false
  if (modal.value === 'my-role') modal.value = null
})
const locked = computed(() => busy.value || !connected.value || !!state.value?.paused)
const nextLabel = computed(() => {
  switch (state.value?.phase) {
    case 'dealt':
      return 'Bắt đầu đêm đầu tiên'
    case 'night':
      return state.value.current ? 'Hoàn thành lượt · Gọi vai tiếp theo' : 'Cả làng thức dậy'
    case 'death-action':
      return 'Hoàn thành phát bắn'
    case 'martyr':
      return 'Chốt quyết định hy sinh'
    case 'teen-review':
      return 'Chốt kiểm tra cuối ngày'
    case 'day-extra':
      return 'Mở phiên biểu quyết thứ hai'
    case 'day':
      return 'Bắt đầu vote giải thích'
    case 'nominate':
      return 'Chốt phiếu đề cử'
    case 'defense':
      return 'Kết thúc giải thích · Vote treo cổ'
    case 'verdict':
      return 'Chốt phiếu Có / Không'
    case 'day-end':
      return 'Bắt đầu đêm tiếp theo'
    default:
      return ''
  }
})
const canNext = computed(() => {
  if (locked.value || !nextLabel.value) return false
  const s = state.value!
  if (['night', 'death-action', 'martyr'].includes(s.phase) && s.current)
    return s.current.confirmed === s.current.total
  if (['nominate', 'verdict'].includes(s.phase)) return s.voteCount === s.voterCount
  if (s.phase === 'teen-review')
    return !!s.teenChecks?.length && s.teenChecks.every((p) => p.spoken !== null)
  return true
})
const actionMax = computed(() => {
  const a = state.value?.action
  if (!a) return 0
  return a.max
})
const optionalAction = computed(() => !!state.value?.action?.optional)
const actionMin = computed(() => state.value?.action?.min ?? actionMax.value)
const validTargets = computed(() => {
  const action = state.value?.action
  if (action?.key === 'leprechaun' && targets.value.length) {
    const ring = (state.value?.seatOrder || []).filter((id) =>
      people.value.some((p) => p.id === id && p.alive),
    )
    const a = ring.indexOf(redirectFrom.value || ''),
      b = ring.indexOf(targets.value[0] || '')
    return (
      a >= 0 &&
      b >= 0 &&
      a !== b &&
      (Math.abs(a - b) === 1 || Math.abs(a - b) === ring.length - 1) &&
      !action.wolfTargets.includes(targets.value[0]!)
    )
  }
  return (
    !action?.adjacentPair ||
    targets.value.length < 2 ||
    !!action.pairs?.some((pair) => targets.value.every((id) => pair.includes(id)))
  )
})
const canConfirm = computed(
  () =>
    !locked.value &&
    !confirmingChoice.value &&
    !!state.value?.action &&
    !state.value.action.confirmed &&
    (optionalAction.value ||
      (targets.value.length >= actionMin.value && targets.value.length <= actionMax.value)) &&
    validTargets.value &&
    (!savePotion.value || !!saveTarget.value),
)
const deathWaiting = computed(
  () =>
    state.value &&
    !state.value.host &&
    !state.value.alive &&
    !state.value.action &&
    state.value.phase !== 'ended',
)
const shownHistory = computed(() => state.value?.history.find((h) => h.game === historyGame.value))
const targetSelectionActive = computed(
  () =>
    !!state.value?.action &&
    !state.value.action.confirmed &&
    state.value.action.kind === 'targets' &&
    actionMax.value > 0,
)
function choiceInput(): Input {
  return {
    revision: state.value?.revision,
    targets: [...targets.value],
    save: savePotion.value,
    saveTarget: saveTarget.value,
    redirectFrom: redirectFrom.value,
    text: ghostLetter.value,
    activate: activateSkill.value,
  }
}
async function enter() {
  await send(mode.value === 'create' ? 'create' : 'join', {
    name: name.value,
    avatar: avatar.value,
    code: code.value.trim().toUpperCase(),
    ...(mode.value === 'create' ? { cardsOnly: cardsOnly.value } : {}),
  })
}
async function avatarFile(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 15 * 1024 * 1024) {
    error.value = 'Chọn ảnh nhỏ hơn 15 MB.'
    return
  }
  imageBusy.value = true
  try {
    const image = await createImageBitmap(file)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 128
      const side = Math.min(image.width, image.height)
      canvas
        .getContext('2d')!
        .drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          128,
          128,
        )
      avatar.value = canvas.toDataURL('image/jpeg', 0.8)
    } finally {
      image.close()
    }
  } catch {
    error.value = 'Không đọc được ảnh. Hãy thử JPEG hoặc PNG.'
  } finally {
    imageBusy.value = false
  }
}
function openDeck() {
  modal.value = 'deck'
}
function openManualFinish(newGame: boolean) {
  manualNewGame.value = newGame
  modal.value = 'finish-manual'
}
async function finishManual() {
  if (await send('finish-manual')) {
    closeModal()
    if (manualNewGame.value) await send('rematch')
  }
}
async function resetNight() {
  if (await send('reset-night')) closeModal()
}
async function saveDeck(deck: string[], drunkRole?: string) {
  if (await send('deck', { deck, drunkRole })) modal.value = null
}
async function suggest() {
  await send('suggest')
}
function selectTarget(id: string) {
  if (
    locked.value ||
    confirmingChoice.value ||
    state.value?.action?.confirmed ||
    actionMax.value === 0
  )
    return
  if (targets.value.includes(id)) targets.value = targets.value.filter((key) => key !== id)
  else
    targets.value =
      actionMax.value === 1 ? [id] : [...targets.value.slice(-(actionMax.value - 1)), id]
  if (validTargets.value && (targets.value.length >= actionMin.value || optionalAction.value)) {
    targetDraft.queue(choiceInput())
  } else targetDraft.reset()
}
function chooseVote(value: string | boolean | null) {
  if (locked.value || confirmingChoice.value) return
  vote.value = value
  voteChosen.value = true
}
async function confirmNight() {
  if (!canConfirm.value) return
  confirmingChoice.value = true
  const ticket = ++submission
  const input = choiceInput()
  targetDraft.queue(input)
  try {
    if (
      (await targetDraft.flush()) &&
      ticket === submission &&
      connected.value &&
      !state.value?.paused
    )
      await send('confirm', input)
  } finally {
    if (ticket === submission) confirmingChoice.value = false
  }
}
function moveSeat(index: number, direction: number) {
  const next = index + direction
  if (next < 0 || next >= seatDraft.value.length) return
  const copy = [...seatDraft.value]
  ;[copy[index], copy[next]] = [copy[next]!, copy[index]!]
  seatDraft.value = copy
}
async function saveSeats() {
  if (await send('seats', { order: seatDraft.value })) modal.value = null
}
async function voteNow() {
  if (voteChosen.value) await send('vote', { vote: vote.value })
}
async function run(action: string, data: Input = {}) {
  await send(action, data)
}
async function abortGame() {
  if (await send('abort')) {
    confirmingAbort.value = false
    closeModal()
  }
}
function openHistory(game: number | null = null) {
  const history = state.value?.history || []
  historyGame.value = game ?? history[history.length - 1]?.game ?? null
  modal.value = 'history'
}
function closeModal() {
  modal.value = null
}
function handleDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) closeModal()
}
</script>

<template>
  <div class="ww-app" :class="{ 'ww-night': state?.phase === 'night', 'ww-dark': deathWaiting }">
    <header class="ww-header">
      <RouterLink to="/" aria-label="Về trang chủ"><Icon icon="lucide:arrow-left" /></RouterLink
      ><span class="ww-brand">HACHI<span>WEREWOLF</span></span>
      <div class="ww-header-actions">
        <span
          class="connection"
          :class="{ online: connected }"
          :title="connected ? 'Đã kết nối' : 'Mất kết nối'"
        /><button
          v-if="state"
          aria-label="Thư viện bộ bài"
          title="Thư viện bộ bài"
          @click="modal = 'catalog'"
        >
          <Icon icon="lucide:gallery-vertical-end" /></button
        ><button v-if="state" aria-label="Người chơi" @click="modal = 'people'">
          <Icon icon="lucide:users" /></button
        ><button
          v-if="state?.host && state.round > 0"
          aria-label="Nhật ký từng đêm"
          title="Nhật ký từng đêm"
          @click="modal = 'journal'"
        >
          <Icon icon="lucide:notebook-text" /></button
        ><button aria-label="Hướng dẫn chơi" @click="modal = 'help'">
          <Icon icon="lucide:book-open" />
        </button>
      </div>
    </header>
    <div v-if="error" class="ww-alert" role="alert">
      {{ error }}<button v-if="!connected" @click="reconnect">Kết nối lại</button
      ><button aria-label="Đóng thông báo" @click="error = ''"><Icon icon="lucide:x" /></button>
    </div>
    <div v-if="state && (!connected || state.paused)" class="ww-alert" role="status">
      <Icon icon="lucide:pause" />Ván tạm dừng. Đang chờ
      {{
        state.members
          .filter((p) => !p.connected)
          .map((p) => p.name)
          .join(', ') || 'kết nối của bạn'
      }}
      quay lại.
    </div>

    <main v-if="!state" class="ww-entry">
      <section class="entry-story">
        <span class="eyebrow">MỘT NGÔI LÀNG · NHIỀU BÍ MẬT</span>
        <h1>Đêm xuống.<br /><em>Ai là Sói?</em></h1>
        <p>
          Gặp nhau quanh một bàn. Giữ bí mật trên một lá bài. Một người quản trò dẫn cả làng qua
          đêm.
        </p>
        <div class="card-fan">
          <RoleCard :role="roleById('seer')" compact /><RoleCard
            :role="roleById('werewolf')"
            compact
          /><RoleCard :role="roleById('villager')" compact />
        </div>
      </section>
      <form class="entry-form" @submit.prevent="enter">
        <div class="segmented">
          <button type="button" :aria-pressed="mode === 'create'" @click="mode = 'create'">
            Làm quản trò</button
          ><button type="button" :aria-pressed="mode === 'join'" @click="mode = 'join'">
            Vào làng
          </button>
        </div>
        <span class="eyebrow">{{
          mode === 'create' ? 'BẠN DẪN DẮT CÂU CHUYỆN' : 'MỖI NGƯỜI MỘT ĐIỆN THOẠI'
        }}</span>
        <h2>{{ mode === 'create' ? 'Mở một buổi chơi' : 'Một chỗ quanh bàn' }}</h2>
        <label for="ww-name">Tên của bạn</label
        ><input
          id="ww-name"
          v-model="name"
          maxlength="24"
          placeholder="Hãy nhập tên"
          autocomplete="nickname"
          required
        /><template v-if="mode === 'join'"
          ><label for="ww-code">Mã phòng</label
          ><input
            id="ww-code"
            v-model="code"
            maxlength="6"
            placeholder="6 ký tự trên máy quản trò"
            autocapitalize="characters"
            required
        /></template>
        <AvatarPicker v-model="avatar" :busy="imageBusy || busy" @upload="avatarPicker?.click()" />
        <label v-if="mode === 'create'" class="cards-only-config">
          <input v-model="cardsOnly" type="checkbox" aria-label="Chỉ dùng bộ bài" />
          <span
            ><strong>Chỉ dùng bộ bài</strong
            ><small
              >Chọn đủ 67 vai. App chỉ chia bài bí mật, quản trò tự điều hành ván chơi.</small
            ></span
          >
        </label>
        <input ref="avatarPicker" type="file" accept="image/*" hidden @change="avatarFile" /><button
          class="ww-primary"
          :disabled="busy || !connected || imageBusy || !name.trim()"
        >
          {{ busy ? 'Đang mở cửa…' : mode === 'create' ? 'Tạo phòng chơi' : 'Vào phòng'
          }}<Icon icon="lucide:arrow-right" />
        </button>
        <p class="fineprint">
          Từ 5–24 người chơi và 1 quản trò. Lịch sử chỉ giữ trong buổi chơi, tối đa 24 giờ.
        </p>
      </form>
    </main>

    <main v-else-if="state.phase === 'lobby'" class="ww-lobby">
      <section class="lobby-intro">
        <span class="eyebrow">{{ state.host ? 'BẠN LÀ QUẢN TRÒ' : 'BẠN LÀ NGƯỜI CHƠI' }}</span>
        <h1>Chào mừng<br /><em>về làng.</em></h1>
        <p>{{ readyCount }}/{{ people.length }} người đã sẵn sàng · quản trò không nhận bài</p>
        <p v-if="state.cardsOnly" class="fineprint">
          Chỉ dùng bộ bài · Quản trò điều hành trực tiếp.
        </p>
        <div class="room-ticket">
          <button
            v-if="qr"
            class="qr-preview"
            aria-label="Phóng to mã QR phòng"
            @click="modal = 'qr'"
          >
            <img :src="qr" alt="Quét QR để vào phòng chơi" />
          </button>
          <div>
            <small>MÃ PHÒNG</small><strong>{{ state.code }}</strong
            ><button @click="copy(invite)">
              <Icon icon="lucide:copy" />{{ copied ? 'Đã sao chép' : 'Chép lời mời' }}
            </button>
          </div>
        </div>
        <p class="fineprint">Quét QR bằng camera điện thoại hoặc nhập mã phòng.</p>
        <div class="lobby-controls" v-if="state.host">
          <button class="ww-primary" :disabled="locked || people.length < 5" @click="suggest">
            <Icon icon="lucide:shuffle" />Gợi ý bộ bài cân bằng</button
          ><button :disabled="locked" @click="openDeck">
            <Icon icon="lucide:layers" />Xem và thay đổi bộ bài ({{ state.deck.length }}/{{
              people.length
            }})</button
          ><button
            class="ww-primary"
            :disabled="
              locked ||
              people.length < 5 ||
              state.deck.length !== people.length ||
              readyCount !== people.length
            "
            @click="run('start')"
          >
            Chốt bộ bài · Bắt đầu<Icon icon="lucide:play" /></button
          ><button :disabled="locked" @click="modal = 'seats'">
            <Icon icon="lucide:circle-dot" />Sắp xếp vòng chỗ ngồi (P.I. / Sói trùm)</button
          ><small v-if="people.length < 5">Cần ít nhất 5 người chơi.</small>
        </div>
        <button v-else class="ww-primary" :disabled="locked" @click="run('ready')">
          <Icon :icon="me?.ready ? 'lucide:check-check' : 'lucide:hand'" />{{
            me?.ready ? 'Đã sẵn sàng · Hủy sẵn sàng' : 'Tôi đã sẵn sàng'
          }}
        </button>
        <button
          v-if="!state.host && state.deck.length"
          class="player-deck-preview"
          @click="openDeck"
        >
          <Icon icon="lucide:layers" />Xem bộ bài của ván ({{ state.deck.length }} lá)
        </button>
        <div v-if="state.history.length" class="session-links">
          <button @click="openHistory()"><Icon icon="lucide:scroll-text" />Lịch sử các ván</button
          ><button @click="modal = 'stats'"><Icon icon="lucide:trophy" />Bảng thành tích</button>
        </div>
      </section>
      <section class="lobby-players">
        <div class="section-heading">
          <span>// QUANH BÀN</span><b>{{ people.length }} người chơi</b>
        </div>
        <div class="member-grid">
          <article v-for="p in state.members" :key="p.id" class="member-card">
            <PlayerAvatar class="member-portrait" :value="p.avatar" :name="p.name" />
            <div>
              <h3>{{ p.name }}</h3>
              <span>{{
                p.host
                  ? 'Quản trò'
                  : !p.connected
                    ? 'Mất kết nối'
                    : p.ready
                      ? 'Đã sẵn sàng'
                      : 'Đang chuẩn bị'
              }}</span>
            </div>
            <Icon
              :icon="
                p.host ? 'lucide:crown' : p.ready ? 'lucide:check-circle-2' : 'lucide:hourglass'
              "
            />
          </article>
          <div v-if="!people.length" class="empty-seat">
            <Icon icon="lucide:armchair" /><span>Gửi lời mời để bạn bè vào làng.</span>
          </div>
        </div>
        <div v-if="state.deck.length" class="deck-ribbon">
          <span
            v-for="(id, index) in state.deck"
            :key="index"
            :style="artStyle(id)"
            :title="roleName(id)"
          />
          <p>
            {{ state.deck.length }} lá · điểm
            {{ state.deck.reduce((s, id) => s + (roleById(id)?.balance_points || 0), 0)
            }}<small>Điểm cân bằng tham khảo</small>
          </p>
          <div class="saved-deck-abilities" aria-label="Chức năng bộ bài đã chốt">
            <details v-for="item in selectedRoleCounts" :key="item.id">
              <summary>{{ item.count }} × {{ item.role?.name_vi }}</summary>
              <p>{{ item.role?.guide_vi || item.role?.ability_vi }}</p>
            </details>
          </div>
        </div>
      </section>
    </main>

    <main v-else-if="deathWaiting" class="ww-rest">
      <Icon icon="lucide:moon" />
      <h1>Bạn đã rời làng.</h1>
      <p>Giữ im lặng để câu chuyện tiếp tục.<br />Lịch sử và vai trò sẽ mở khi ván kết thúc.</p>
      <span>Ván {{ state.game }} · {{ phaseNames[state.phase] }}</span>
    </main>

    <main
      v-else
      class="ww-game"
      :class="{
        'is-choosing':
          targetSelectionActive || (state.phase === 'nominate' && !state.host && !state.voted),
      }"
    >
      <div class="phase-heading">
        <span class="eyebrow"
          >PHÒNG {{ state.code }} · VÁN {{ state.game
          }}{{ state.round ? ` · NGÀY / ĐÊM ${state.round}` : '' }}</span
        >
        <h1>{{ phaseNames[state.phase] }}</h1>
        <span class="phase-badge"
          ><Icon :icon="state.host ? 'lucide:crown' : 'lucide:user'" />{{
            state.host ? 'Quản trò' : me?.name
          }}</span
        >
      </div>
      <button
        v-if="state.host && state.canResetNight"
        class="journal-shortcut"
        :disabled="busy || !connected"
        @click="modal = 'reset-night'"
      >
        <Icon icon="lucide:history" />Làm lại đêm {{ state.round }}
      </button>
      <section v-if="['countdown', 'dawn'].includes(state.phase)" class="countdown-scene">
        <Icon :icon="state.phase === 'dawn' ? 'lucide:sunrise' : 'lucide:layers'" /><strong>{{
          countdown
        }}</strong>
        <p>
          {{
            state.phase === 'dawn'
              ? 'Cả làng thức dậy. Kết quả đêm sẽ được công bố…'
              : 'Lá bài đang tìm chủ nhân…'
          }}
        </p>
      </section>
      <template v-else-if="state.phase === 'ended'"
        ><section class="victory">
          <Icon icon="lucide:trophy" /><span>KẾT THÚC VÁN {{ state.game }}</span>
          <h2>
            {{ winnerTitle(state.winner) }}
          </h2>
          <p v-if="!state.host">
            {{
              ['aborted', 'manual'].includes(state.winner || '')
                ? 'Ván này không cộng thắng hoặc thua.'
                : state.myWon
                  ? 'Bạn đã đạt điều kiện chiến thắng của mình.'
                  : 'Một câu chuyện mới đang chờ bạn ở ván sau.'
            }}
          </p>
        </section>
        <div class="member-grid reveal-grid">
          <article v-for="p in people" :key="p.id">
            <RoleCard :role="roleById(p.role)" compact /><strong>{{ p.name }}</strong
            ><small>{{
              state.history[state.history.length - 1]?.players.find((player) => player.id === p.id)
                ?.won
                ? 'Đạt điều kiện thắng'
                : ['aborted', 'manual'].includes(state.winner || '')
                  ? 'Không tính thành tích'
                  : 'Chưa đạt điều kiện thắng'
            }}</small>
          </article>
        </div>
        <div class="end-actions">
          <button class="ww-primary" @click="openHistory(state.game)">
            <Icon icon="lucide:scroll-text" />Xem toàn bộ diễn biến</button
          ><button @click="modal = 'stats'"><Icon icon="lucide:trophy" />Bảng thành tích</button
          ><button v-if="state.host" :disabled="locked" @click="run('rematch')">
            <Icon icon="lucide:rotate-ccw" />Ván mới · Chỉnh lại bộ bài
          </button>
        </div></template
      >
      <template v-else>
        <div class="play-layout">
          <aside v-if="!state.host" class="my-card-area">
            <button
              v-if="targetSelectionActive"
              class="pocket-card"
              aria-label="Xem vai trò của tôi"
              @click="modal = 'my-role'"
            >
              <Icon icon="lucide:eye" /><span>Lá bài của tôi<small>Chạm để xem riêng</small></span>
            </button>
            <template v-else>
              <button
                v-if="!revealed && !['reveal', 'dealt'].includes(state.phase)"
                class="pocket-card"
                aria-label="Xem vai trò của tôi"
                @click="toggleReveal"
              >
                <Icon icon="lucide:moon-star" /><span
                  >Lá bài của bạn<small>Chạm để xem bí mật</small></span
                ><Icon icon="lucide:eye" />
              </button>
              <button
                v-else
                ref="revealButton"
                class="my-card"
                :aria-label="revealed ? 'Ẩn vai trò của tôi' : 'Xem vai trò của tôi'"
                :aria-pressed="revealed"
                @click="toggleReveal"
              >
                <RoleCard :role="myRole" :concealed="!revealed" /></button
              ><button
                v-if="state.phase === 'reveal' && !state.seen"
                class="ww-primary"
                :disabled="locked || !revealed"
                @click="run('seen')"
              >
                Tôi đã xem bài<Icon icon="lucide:check" />
              </button>
              <p v-else class="fineprint">
                Chạm để {{ revealed ? 'úp bài' : 'xem bài' }} · Giữ bí mật vai trò
              </p>
              <div v-if="revealed && myRole" class="private-notes">
                <strong>{{ myRole.name_vi }}</strong>
                <p>{{ myRole.guide_vi || myRole.ability_vi }}</p>
                <p>{{ myRole.win_condition_vi }}</p>
              </div>
              <details v-if="state.notes.length" class="private-notes">
                <summary>Kết quả riêng của bạn</summary>
                <p v-for="(note, i) in state.notes" :key="i">{{ note }}</p>
              </details>
            </template>
          </aside>
          <section class="phase-content">
            <template v-if="['reveal', 'dealt'].includes(state.phase)"
              ><Icon icon="lucide:eye" class="scene-icon" />
              <h2>
                {{ state.phase === 'dealt' ? 'Mọi người đã xem bài' : 'Hãy xem bài của mình' }}
              </h2>
              <p>
                {{ people.filter((p) => p.seen).length }}/{{ people.length }} người đã xác nhận. Khi
                {{
                  state.cardsOnly
                    ? 'đủ người, quản trò sẽ điều hành trực tiếp.'
                    : 'đủ người, quản trò sẽ bắt đầu đêm đầu tiên.'
                }}
              </p>
              <div v-if="state.host && state.phase === 'dealt'" class="identity-list">
                <div v-for="p in people" :key="p.id">
                  <PlayerAvatar class="avatar" :value="p.avatar" :name="p.name" /><strong>{{
                    p.name
                  }}</strong
                  ><span
                    >{{ roleName(p.role)
                    }}<small v-if="p.hiddenRole">Lá ẩn: {{ roleName(p.hiddenRole) }}</small></span
                  >
                </div>
              </div></template
            >
            <template v-if="state.phase === 'manual'">
              <span class="eyebrow">CHỈ DÙNG BỘ BÀI</span>
              <h2>Cả làng đã nhận bài</h2>
              <p>
                Quản trò điều hành trực tiếp. Giữ kín lá bài của bạn cho đến khi quản trò kết thúc
                ván.
              </p>
              <div v-if="state.host" class="identity-list">
                <div v-for="p in people" :key="p.id">
                  <PlayerAvatar class="avatar" :value="p.avatar" :name="p.name" /><strong>{{
                    p.name
                  }}</strong
                  ><span>{{ roleName(p.role) }}</span>
                </div>
              </div>
            </template>
            <template v-if="state.phase === 'teen-review'">
              <h2>Kiểm tra điều kiện cuối ngày</h2>
              <p>
                {{
                  state.host
                    ? 'Xác nhận Sói tuổi teen đã nói “Sói” hoặc “Ma sói” trong ngày này chưa. Người bị câm hoặc Bà già đuổi được miễn.'
                    : 'Chờ quản trò hoàn tất kiểm tra để bắt đầu đêm tiếp theo.'
                }}
              </p>
              <div v-if="state.host" class="teen-review-list">
                <article v-for="check in state.teenChecks" :key="check.id">
                  <strong>{{ personName(check.id) }}</strong>
                  <div class="end-actions">
                    <button
                      :aria-pressed="check.spoken === true"
                      :disabled="locked"
                      @click="run('teen-check', { playerId: check.id, spoken: true })"
                    >
                      Đã nói từ khóa</button
                    ><button
                      :aria-pressed="check.spoken === false"
                      :disabled="locked"
                      @click="run('teen-check', { playerId: check.id, spoken: false })"
                    >
                      Chưa nói · Sẽ bị loại
                    </button>
                  </div>
                </article>
              </div>
            </template>
            <template v-if="['night', 'death-action', 'martyr'].includes(state.phase)"
              ><span class="eyebrow">{{
                state.host ? 'LỜI GỌI CỦA QUẢN TRÒ' : 'LƯỢT HIỆN TẠI'
              }}</span>
              <h2>
                {{
                  state.current
                    ? state.phase === 'martyr'
                      ? `Kẻ tử đạo có cứu ${personName(state.nominee)} không?`
                      : state.phase === 'death-action'
                        ? `${roleName(state.current.key)}, hãy thực hiện phát bắn cuối`
                        : `${roleName(state.current.key)}, hãy thức dậy`
                    : 'Các vai đã hoàn thành'
                }}
              </h2>
              <p v-if="state.phase === 'death-action' && state.summary">{{ state.summary }}</p>
              <p v-if="state.current">
                {{ state.current.confirmed }}/{{ state.current.total }} đã xác nhận.
                {{
                  state.host
                    ? 'Theo dõi lựa chọn và chuyển lượt khi mọi người đã hoàn thành.'
                    : state.action
                      ? 'Đến lượt bạn thực hiện hành động.'
                      : 'Giữ im lặng và chờ lượt.'
                }}
              </p>
              <p v-else>Quản trò có thể gọi cả làng thức dậy.</p>
              <p v-if="state.host && state.current" class="turn-instructions">
                {{
                  state.current.key === 'wolves'
                    ? 'Mời các Sói đang săn thống nhất mục tiêu. Sói trùm cho tối đa hai người kề nhau; thưởng Sói con cho hai người bất kỳ. Con bệnh khiến cả đàn nghỉ săn.'
                    : state.current.key === 'vampires'
                      ? roleById('vampire')?.guide_vi || roleById('vampire')?.ability_vi
                      : roleById(state.current.key)?.guide_vi ||
                        roleById(state.current.key)?.ability_vi
                }}
              </p>
              <div
                v-if="state.action"
                class="night-action"
                :class="{ 'has-targets': targetSelectionActive }"
              >
                <p v-if="state.action.confirmed" class="confirmed">
                  <Icon icon="lucide:check-check" />Đã xác nhận. Bạn có thể nhắm mắt.
                </p>
                <p
                  v-if="
                    state.action.confirmed &&
                    state.notes.length &&
                    [
                      'seer',
                      'apprentice_seer',
                      'pi',
                      'aura_seer',
                      'mystic_seer',
                      'mentalist',
                      'sorceress',
                      'mason',
                      'minion',
                      'beholder',
                    ].includes(state.action.key)
                  "
                  class="private-notes"
                >
                  {{ state.notes[state.notes.length - 1] }}
                </p>
                <template v-if="!state.action.confirmed"
                  ><p v-if="['mason', 'minion', 'beholder'].includes(state.action.key)">
                    Bấm Xác nhận để nhận thông tin bí mật của vai.
                  </p>
                  <p v-else-if="state.action.kind === 'targets'">
                    {{
                      optionalAction
                        ? state.action.key === 'hunter'
                          ? 'Chọn một người để bắn hoặc xác nhận bỏ qua.'
                          : state.action.key === 'spellcaster'
                            ? 'Chọn một người để làm câm hoặc bỏ qua đêm nay.'
                            : 'Bạn có thể bỏ qua để giữ kỹ năng.'
                        : actionMin !== actionMax
                          ? `Chọn ${actionMin} hoặc ${actionMax} người rồi xác nhận. Hai mục tiêu phải ngồi cạnh nhau.`
                          : `Chọn ${actionMax} người rồi xác nhận.`
                    }}
                  </p>
                  <label v-if="state.action.kind === 'letter'" class="special-action"
                    >Gợi ý của Hồn ma: một chữ cái, không dùng chữ đầu tên người chơi<input
                      v-model="ghostLetter"
                      :disabled="locked || confirmingChoice"
                      maxlength="2"
                      aria-label="Chữ cái của Hồn ma"
                      placeholder="Để trống để bỏ qua"
                  /></label>
                  <label v-if="state.action.kind === 'activate'" class="potion"
                    ><input
                      v-model="activateSkill"
                      type="checkbox"
                      :disabled="locked || confirmingChoice"
                    />{{
                      state.action.key === 'martyr'
                        ? `Tôi tự nguyện chết thay ${personName(state.nominee)}.`
                        : 'Kích hoạt Kẻ phá rối: ngày mai có hai phiên biểu quyết.'
                    }}</label
                  >
                  <label
                    v-if="
                      state.action.key === 'witch' &&
                      !state.action.used.heal &&
                      state.action.wolfTargets?.length
                    "
                    class="potion"
                    ><input
                      v-model="savePotion"
                      type="checkbox"
                      :disabled="locked || confirmingChoice"
                    />Dùng bình cứu
                    {{
                      state.action.wolfTargets.length === 1
                        ? personName(state.action.wolfTargets[0])
                        : 'cho một nạn nhân Sói'
                    }}</label
                  >
                  <label
                    v-if="savePotion && state.action.wolfTargets.length > 1"
                    class="special-action"
                    >Chọn người được cứu<select
                      v-model="saveTarget"
                      :disabled="locked || confirmingChoice"
                      aria-label="Nạn nhân được bình cứu"
                    >
                      <option :value="null" disabled>Chọn một người</option>
                      <option v-for="id in state.action.wolfTargets" :key="id" :value="id">
                        {{ personName(id) }}
                      </option>
                    </select></label
                  >
                  <label
                    v-if="state.action.key === 'leprechaun' && state.action.wolfTargets.length"
                    class="special-action"
                    >Vết cắn muốn chuyển<select
                      v-model="redirectFrom"
                      :disabled="locked || confirmingChoice"
                      aria-label="Nạn nhân Sói muốn chuyển"
                    >
                      <option :value="null" disabled>Chọn một nạn nhân</option>
                      <option v-for="id in state.action.wolfTargets" :key="id" :value="id">
                        {{ personName(id) }}
                      </option>
                    </select></label
                  >
                  <p v-if="state.action.key === 'leprechaun'" class="fineprint">
                    Chuyển tối đa một vết cắn sang người kề nạn nhân trong vòng sống, hoặc bỏ qua để
                    giữ nguyên. Nếu có hai vết cắn, người nhận không được trùng nạn nhân còn lại.
                  </p>
                  <p v-if="state.action.key === 'witch'">
                    {{
                      state.action.used.poison
                        ? 'Bình độc đã dùng.'
                        : 'Chọn người bên dưới nếu muốn dùng bình độc.'
                    }}
                  </p>
                  <p v-if="state.action.key === 'revealer'" class="fineprint">
                    Cả ván chỉ có một lượt khám phá. Chưa muốn dùng thì xác nhận Bỏ qua để giữ lượt
                    cho đêm sau.
                  </p>
                  <TargetPicker
                    v-if="actionMax"
                    :key="`${state.code}:${state.game}:${state.revision}:${state.action.key}`"
                    :players="targetCandidates"
                    :selected="targets"
                    :limit="actionMax"
                    :disabled="locked || confirmingChoice"
                    @select="selectTarget"
                  />
                  <p v-if="!validTargets" class="ww-alert">
                    {{
                      state.action.key === 'leprechaun'
                        ? 'Chọn người kề nạn nhân đã chọn và không trùng vết cắn còn lại.'
                        : 'Hai mục tiêu phải ngồi cạnh nhau trong vòng người còn sống. Hãy đổi một mục tiêu hoặc chỉ chọn một người.'
                    }}
                  </p>
                  <div class="action-submit">
                    <button class="ww-primary" :disabled="!canConfirm" @click="confirmNight">
                      <Icon icon="lucide:check" />{{
                        confirmingChoice ? 'Đang xác nhận…' : 'Xác nhận'
                      }}{{
                        optionalAction &&
                        !targets.length &&
                        !savePotion &&
                        !ghostLetter &&
                        !activateSkill
                          ? ' · Bỏ qua'
                          : ''
                      }}
                    </button>
                  </div></template
                >
              </div>
              <div v-if="state.choices.length" class="live-choices">
                <h3>{{ state.host ? 'Lựa chọn trực tiếp' : 'Lựa chọn của đồng đội' }}</h3>
                <div v-for="choice in state.choices" :key="choice.id">
                  <strong>{{ personName(choice.id) }}</strong
                  ><span
                    >→ {{ choice.redirectFrom ? `Chuyển ${personName(choice.redirectFrom)} → ` : ''
                    }}{{
                      choice.text ||
                      (choice.activate
                        ? state.phase === 'martyr'
                          ? 'Tự nguyện chết thay'
                          : 'Kích hoạt kỹ năng'
                        : choice.targets.map(personName).join(', ') || 'Bỏ qua')
                    }}{{ choice.save ? ` · Cứu ${personName(choice.saveTarget)}` : '' }}</span
                  ><Icon :icon="choice.confirmed ? 'lucide:check-check' : 'lucide:pencil'" />
                </div>
              </div>
            </template>
            <template v-if="['day', 'day-end', 'day-extra'].includes(state.phase)"
              ><Icon icon="lucide:sunrise" class="scene-icon" />
              <h2>{{ state.summary }}</h2>
              <p>
                {{
                  state.phase === 'day'
                    ? 'Cả làng cùng thảo luận. Quản trò sẽ mở lượt đề cử người giải thích.'
                    : state.phase === 'day-extra'
                      ? 'Kẻ phá rối đã kích hoạt phiên biểu quyết thứ hai.'
                      : 'Quản trò sẽ đưa cả làng sang đêm tiếp theo.'
                }}
              </p>
              <p v-if="me?.banished" class="ww-alert">
                Bạn bị Bà già tạm đuổi khỏi làng hôm nay: không nói và không bỏ phiếu. Bạn vẫn còn
                sống.
              </p>
              <div v-if="state.clues?.length" class="private-notes">
                <strong>Thông điệp Hồn ma</strong>
                <p v-for="(clue, index) in state.clues" :key="index">
                  Đêm {{ clue.round }}: {{ clue.letter }}
                </p>
              </div>
              <p v-if="me?.silenced" class="ww-alert">
                Bạn bị Pháp sư câm tác động: không nói trong ngày hôm nay, vẫn được bỏ phiếu.
              </p></template
            >
            <template v-if="state.phase === 'defense'"
              ><Icon icon="lucide:message-circle" class="scene-icon" /><span class="eyebrow"
                >NGƯỜI ĐƯỢC MỜI GIẢI THÍCH</span
              >
              <h2>{{ personName(state.nominee) }}</h2>
              <p>Cả làng lắng nghe. Quản trò bấm tiếp tục khi phần giải thích kết thúc.</p>
              <p v-if="people.find((p) => p.id === state?.nominee)?.silenced">
                Người này đang bị cấm nói trong ngày hôm nay.
              </p></template
            >
            <template v-if="['nominate', 'verdict'].includes(state.phase)"
              ><span class="eyebrow">{{
                state.phase === 'nominate'
                  ? `VÒNG ĐỀ CỬ${state.ballot ? ' · BỎ PHIẾU LẠI' : ''}`
                  : 'VÒNG PHÁN QUYẾT'
              }}</span>
              <h2>
                {{
                  state.phase === 'nominate'
                    ? 'Ai cần giải thích?'
                    : `Treo cổ ${personName(state.nominee)}?`
                }}
              </h2>
              <p>
                {{ state.voteCount }}/{{ state.voterCount }} người có quyền vote đã xác nhận.
                {{
                  state.phase === 'verdict'
                    ? 'Cần hơn nửa tổng trọng số phiếu Có để treo cổ.'
                    : 'Chọn một người hoặc bỏ phiếu trắng.'
                }}
              </p>
              <p v-if="!state.host && !state.canVote" class="ww-alert">
                Bạn không có quyền bỏ phiếu trong ngày này.
              </p>
              <template v-if="!state.host && state.canVote"
                ><p v-if="state.voted" class="confirmed">
                  <Icon icon="lucide:check-check" />Phiếu của bạn đã được ghi nhận.
                </p>
                <template v-else
                  ><div v-if="state.phase === 'nominate'">
                    <TargetPicker
                      :key="`${state.game}:${state.revision}:nominate`"
                      :players="nominationCandidates"
                      :selected="voteChosen && typeof vote === 'string' ? [vote] : []"
                      :disabled="locked"
                      @select="chooseVote"
                    />
                    <button
                      class="blank-vote"
                      :disabled="locked"
                      :aria-pressed="voteChosen && vote === null"
                      @click="chooseVote(null)"
                    >
                      Phiếu trắng
                    </button>
                  </div>
                  <div v-else class="verdict-options">
                    <button
                      :disabled="myRole?.id === 'pacifist'"
                      :aria-pressed="voteChosen && vote === true"
                      @click="chooseVote(true)"
                    >
                      <Icon icon="lucide:check" />Có, treo cổ</button
                    ><button
                      :disabled="myRole?.id === 'village_idiot'"
                      :aria-pressed="voteChosen && vote === false"
                      @click="chooseVote(false)"
                    >
                      <Icon icon="lucide:x" />Không treo cổ
                    </button>
                  </div>
                  <p
                    v-if="['pacifist', 'village_idiot'].includes(myRole?.id || '')"
                    class="fineprint"
                  >
                    Lá bài của bạn quy định lựa chọn trong vòng này.
                  </p>
                  <div class="action-submit">
                    <button class="ww-primary" :disabled="locked || !voteChosen" @click="voteNow">
                      Xác nhận phiếu
                    </button>
                  </div></template
                ></template
              ></template
            >
            <button
              v-if="state.host && nextLabel && !state.cardsOnly"
              class="ww-primary host-next"
              :disabled="!canNext"
              @click="run('next')"
            >
              {{ nextLabel }}<Icon icon="lucide:arrow-right" />
            </button>
            <div
              v-if="state.host && state.cardsOnly && ['reveal', 'manual'].includes(state.phase)"
              class="end-actions"
            >
              <button class="ww-primary" :disabled="locked" @click="openManualFinish(false)">
                Kết thúc ván
              </button>
              <button :disabled="locked" @click="openManualFinish(true)">Chuẩn bị ván mới</button>
            </div>
            <p v-if="state.host && state.waitingFor?.length" class="waiting-list">
              Đang chờ: {{ state.waitingFor.map(personName).join(', ') }}.
            </p>
            <button
              v-if="state.host && state.round > 0"
              class="journal-shortcut"
              @click="modal = 'journal'"
            >
              <Icon icon="lucide:notebook-text" />Xem nhật ký từng đêm
            </button>
          </section>
        </div>
      </template>
    </main>
    <footer class="ww-footer">
      HACHI WEREWOLF · Một buổi chơi, nhiều câu chuyện.<button
        v-if="state && ['lobby', 'ended'].includes(state.phase)"
        @click="modal = 'people'"
      >
        {{ state.host ? 'Quản lý phòng' : 'Phòng của bạn' }}
      </button>
    </footer>

    <dialog ref="dialog" class="ww-dialog" @close="closeModal" @click="handleDialogClick">
      <div class="dialog-content">
        <header>
          <h2>
            {{
              modal === 'my-role'
                ? 'Lá bài của tôi'
                : modal === 'reset-night'
                  ? 'Làm lại đêm gần nhất'
                  : modal === 'finish-manual'
                    ? 'Kết thúc ván trực tiếp'
                    : modal === 'catalog'
                      ? 'Thư viện bộ bài'
                      : modal === 'qr'
                        ? 'Quét mã để vào phòng'
                        : modal === 'deck'
                          ? 'Bộ bài của buổi chơi'
                          : modal === 'people'
                            ? 'Quanh bàn chơi'
                            : modal === 'history'
                              ? 'Lịch sử các ván'
                              : modal === 'stats'
                                ? 'Bảng thành tích buổi chơi'
                                : modal === 'journal'
                                  ? `Nhật ký đêm · Ván ${state?.game}`
                                  : modal === 'seats'
                                    ? 'Vòng chỗ ngồi'
                                    : 'Cách chơi cùng bạn bè'
            }}
          </h2>
          <button aria-label="Đóng" @click="closeModal"><Icon icon="lucide:x" /></button>
        </header>
        <p v-if="error" class="ww-alert" role="alert">{{ error }}</p>
        <section v-if="modal === 'my-role' && myRole" class="private-role-preview">
          <RoleCard :role="myRole" />
          <p class="fineprint">Giữ bí mật vai trò. Đóng để quay lại chọn người chơi.</p>
        </section>
        <section v-if="modal === 'reset-night' && state?.host">
          <h3>Làm lại đêm {{ state.round }}?</h3>
          <p>
            Khôi phục người sống/chết, vai trò, kỹ năng, hiệu ứng, phiếu và nhật ký về trước đêm
            này. Mọi diễn biến từ đêm đó trở đi sẽ được làm lại; nếu ván đã kết thúc, kết quả và
            thành tích của ván này cũng được hoàn tác.
          </p>
          <p class="ww-alert">
            Thông tin người chơi đã xem không thể thu hồi. Hãy thống nhất với cả bàn trước khi làm
            lại.
          </p>
          <div class="end-actions">
            <button @click="closeModal">Giữ nguyên ván</button
            ><button class="ww-primary" :disabled="busy || !connected" @click="resetNight">
              Xác nhận làm lại đêm {{ state.round }}
            </button>
          </div>
        </section>
        <section v-if="modal === 'finish-manual' && state?.host">
          <h3>{{ manualNewGame ? 'Kết thúc và chuẩn bị ván mới?' : 'Kết thúc ván đang chơi?' }}</h3>
          <p>
            Lá bài của mọi người sẽ được công khai. Chế độ chỉ dùng bộ bài không tự tính thắng/thua.
          </p>
          <div class="end-actions">
            <button @click="closeModal">Tiếp tục chơi</button
            ><button class="ww-primary" :disabled="busy || !connected" @click="finishManual">
              {{ manualNewGame ? 'Chuẩn bị ván mới' : 'Kết thúc ván' }}
            </button>
          </div>
        </section>
        <section v-if="modal === 'qr' && state" class="qr-enlarged">
          <img v-if="qr" :src="qr" alt="Mã QR tham gia phòng" />
          <span class="eyebrow">MÃ PHÒNG</span>
          <strong>{{ state.code }}</strong>
          <button @click="copy(invite)">
            <Icon icon="lucide:copy" />{{ copied ? 'Đã sao chép' : 'Chép lời mời' }}
          </button>
        </section>
        <CardLibrary v-if="modal === 'catalog'" :roles="catalog" :cards-only="state?.cardsOnly" />
        <DeckEditor
          v-if="modal === 'deck' && state"
          :deck="state.deck"
          :count="people.length"
          :roles="catalog"
          :revision="state.revision"
          :disabled="locked"
          :drunk-role="state.drunkRole"
          :readonly="!state.host"
          :cards-only="state.cardsOnly"
          @suggest="suggest"
          @save="saveDeck"
        />
        <NightJournal
          v-if="modal === 'journal' && state?.host"
          :logs="state.logs"
          :round="state.round"
          :phase="state.phase"
        />
        <section v-if="modal === 'seats' && state?.host">
          <p class="fineprint">
            Sắp theo đúng vòng ngồi thực tế, không tính quản trò. Người đầu và người cuối ngồi cạnh
            nhau; P.I. và Sói trùm dùng thứ tự này và bỏ qua người đã chết.
          </p>
          <div class="identity-list seat-editor">
            <div v-for="(id, index) in seatDraft" :key="id">
              <b>{{ index + 1 }}</b
              ><strong>{{ personName(id) }}</strong
              ><button
                :disabled="index === 0"
                :aria-label="`Đưa ${personName(id)} lên trước`"
                @click="moveSeat(index, -1)"
              >
                <Icon icon="lucide:arrow-up" /></button
              ><button
                :disabled="index === seatDraft.length - 1"
                :aria-label="`Đưa ${personName(id)} xuống sau`"
                @click="moveSeat(index, 1)"
              >
                <Icon icon="lucide:arrow-down" />
              </button>
            </div>
          </div>
          <button class="ww-primary" :disabled="locked" @click="saveSeats">
            Lưu thứ tự chỗ ngồi
          </button>
        </section>
        <template v-if="modal === 'people'"
          ><p>Phòng {{ state?.code }} · Buổi chơi tối đa 24 giờ</p>
          <div class="identity-list">
            <div v-for="p in state?.members" :key="p.id">
              <PlayerAvatar class="avatar" :value="p.avatar" :name="p.name" /><strong
                >{{ p.name
                }}<small>{{
                  p.host
                    ? 'Quản trò'
                    : !p.connected
                      ? 'Mất kết nối'
                      : state?.phase === 'lobby'
                        ? p.ready
                          ? 'Đã sẵn sàng'
                          : 'Đang chuẩn bị'
                        : p.alive
                          ? 'Đang chơi'
                          : 'Đã bị loại'
                }}</small></strong
              ><span v-if="p.role"
                >{{ roleName(p.role)
                }}<small v-if="p.hiddenRole">Lá ẩn: {{ roleName(p.hiddenRole) }}</small></span
              ><small v-if="p.seat">Ghế {{ p.seat }}</small>
              <button
                v-if="state?.host && state.phase === 'lobby' && !p.host"
                :aria-label="`Xóa ${p.name} khỏi phòng`"
                :disabled="busy"
                @click="run('kick', { playerId: p.id })"
              >
                <Icon icon="lucide:user-minus" />
              </button>
            </div>
          </div>
          <button
            v-if="state && ['lobby', 'ended'].includes(state.phase)"
            class="danger"
            :disabled="busy"
            @click="run('leave')"
          >
            {{ state.host ? 'Kết thúc buổi chơi · Đóng phòng' : 'Rời phòng' }}
          </button>
          <p v-else class="fineprint">
            Nếu mất kết nối, mở lại trang trên cùng trình duyệt để trở lại. Ván sẽ tạm dừng chờ bạn.
          </p>
          <section
            v-if="state?.host && !['lobby', 'ended'].includes(state.phase)"
            class="abort-section"
          >
            <button v-if="!confirmingAbort" class="danger" @click="confirmingAbort = true">
              Hủy ván đang chơi
            </button>
            <template v-else
              ><p>
                Hủy ván {{ state.game }} và mở lịch sử cho cả phòng? Ván này sẽ không tính
                thắng/thua. Các ván trước vẫn được giữ.
              </p>
              <div class="end-actions">
                <button @click="confirmingAbort = false">Tiếp tục chờ</button
                ><button class="danger" :disabled="busy || !connected" @click="abortGame">
                  Xác nhận hủy ván
                </button>
              </div></template
            >
          </section></template
        >
        <template v-if="modal === 'history'"
          ><div class="history-tabs">
            <button
              v-for="h in state?.history"
              :key="h.game"
              :aria-pressed="historyGame === h.game"
              @click="historyGame = h.game"
            >
              Ván {{ h.game }}{{ h.winner === 'aborted' ? ' · Đã hủy' : '' }}
            </button>
          </div>
          <p v-if="shownHistory" class="history-outcome">
            {{ winnerTitle(shownHistory.winner) }}
          </p>
          <details v-if="shownHistory" class="history-roles">
            <summary>Vai trò trong ván này</summary>
            <div class="identity-list">
              <div v-for="p in shownHistory.players" :key="p.id">
                <strong>{{ p.name }}</strong
                ><span
                  >{{
                    p.originalRole && p.originalRole !== p.role
                      ? `${roleName(p.originalRole)} → `
                      : ''
                  }}{{ roleName(p.role) }} ·
                  {{
                    p.won
                      ? 'Thắng'
                      : shownHistory.winner === 'aborted'
                        ? 'Ván hủy'
                        : shownHistory.winner === 'manual'
                          ? 'Không tính thành tích'
                          : 'Thua'
                  }}</span
                >
              </div>
            </div>
          </details>
          <ol v-if="shownHistory" class="history-log">
            <li v-for="(event, i) in shownHistory.logs" :key="i">
              <span>Ngày / đêm {{ event.round }}</span
              >{{ event.message }}
            </li>
          </ol>
          <p v-else>Chọn một ván để xem toàn bộ diễn biến.</p></template
        >
        <template v-if="modal === 'stats'">
          <p class="fineprint">
            Thành tích cộng dồn trong buổi chơi. Ván hủy và ván chỉ dùng bộ bài không tự tính
            thắng/thua.
          </p>
          <div v-if="standings.length" class="standings-list">
            <article v-for="(person, index) in standings" :key="person.id">
              <b class="rank">{{ index + 1 }}</b
              ><PlayerAvatar class="avatar" :value="person.avatar" :name="person.name" /><strong
                >{{ person.name
                }}<small
                  >{{ person.wins + person.losses }} ván{{
                    person.present ? '' : ' · Đã rời phòng'
                  }}</small
                ></strong
              ><span class="wins"
                ><b>{{ person.wins }}</b
                >Thắng</span
              ><span
                ><b>{{ person.losses }}</b
                >Thua</span
              >
            </article>
          </div>
          <p v-else class="journal-empty">Chưa có người chơi trong buổi này.</p>
        </template>
        <template v-if="modal === 'help'"
          ><div class="help-steps">
            <p>
              <b>01 · Về làng.</b> Quản trò tạo phòng, bạn bè quét QR, chọn tên và bấm Sẵn sàng.
              Quản trò không nhận bài.
            </p>
            <p>
              <b>02 · Nhận bài.</b> Chốt bộ bài, đếm ngược 5 giây, lật bài rồi xác nhận đã xem. Úp
              lại để giữ bí mật.
            </p>
            <p>
              <b>03 · Đêm xuống.</b> Quản trò gọi từng vai. Người có lượt chọn trên điện thoại và
              xác nhận; kết quả riêng chỉ mở sau xác nhận. Sói thống nhất một mục tiêu trước khi
              cùng xác nhận.
            </p>
            <p>
              <b>04 · Bình minh.</b> Sau 10 giây, công bố người bị loại. Thảo luận trực tiếp rồi
              vote chọn người giải thích. Hòa thì vote lại giữa những người hòa; hòa tiếp sẽ không
              treo.
            </p>
            <p>
              <b>05 · Phán quyết.</b> Người được chọn giải thích, cả làng vote Có/Không treo cổ. Cần
              hơn nửa trọng số phiếu Có. Thị trưởng có 2 phiếu; các vai đặc biệt tuân theo lá bài.
            </p>
            <p>
              <b>06 · Hạ màn.</b> Dân thắng khi không còn Sói/Ma cà rồng. Sói thắng theo số lượng
              sau khi hết Ma cà rồng. Ma cà rồng, Sói đơn độc, cặp đôi và vai thắng riêng được chấm
              theo hướng dẫn lá bài. Thợ săn phải xử lý xong phát bắn trước khi chốt kết quả. Lịch
              sử mở cho mọi người cuối ván.
            </p>
            <p>
              Mất kết nối sẽ tạm dừng ván. Lịch sử chỉ giữ trong phòng, tối đa 24 giờ; server khởi
              động lại sẽ kết thúc buổi chơi. Người bị loại chờ tới cuối ván, trừ lượt kỹ năng của
              Thợ săn/Hồn ma. Bảo vệ được chọn mình, không bảo vệ cùng người hai đêm liên tiếp.
              Không giới hạn thời gian hành động.
            </p>
          </div></template
        >
      </div>
    </dialog>
  </div>
</template>
