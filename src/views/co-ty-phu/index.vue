<script setup lang="ts">
import { computed, ref, watch, onScopeDispose } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import {
  useClipboard,
  useEventListener,
  useLocalStorage,
  usePreferredReducedMotion,
  useTimestamp,
  useElementSize,
} from '@vueuse/core'
import { usePropertyRoom } from './composables/usePropertyRoom'
import GameBoard from './components/GameBoard.vue'
import CharacterEditor from './components/CharacterEditor.vue'
import CharacterSprite from './components/CharacterSprite.vue'
import PropertyBuildings from './components/PropertyBuildings.vue'
import { randomCharacter } from './character-config.mjs'
import { money } from './types'
import type { Input, Property, Settings } from './types'
import './styles.css'

const { state, me, connected, busy, error, send, reconnect } = usePropertyRoom()
const route = useRoute()
const name = ref(''),
  roomCode = ref(typeof route.query.room === 'string' ? route.query.room : '')
const joining = ref(!!roomCode.value)
const character = ref(randomCharacter())
const selected = ref<number | null>(null),
  tab = ref<'assets' | 'players' | 'log'>('assets')
const zoomed = ref(false)
const boardViewport = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight } = useElementSize(boardViewport)
const boardFit = computed(
  () =>
    `${Math.max(80, Math.floor(Math.min(viewportWidth.value / 1.12, viewportHeight.value / 0.94)))}px`,
)
const inspectId = ref(0)
const dialog = ref<HTMLDialogElement>(),
  modal = ref('')
const bid = ref(1)
const settings = ref<Settings>({
  startingCash: 1500,
  timeLimit: 0,
  parkingPot: false,
  doubleGo: false,
})
const tradeTo = ref(''),
  give = ref<number[]>([]),
  take = ref<number[]>([]),
  giveCash = ref(0),
  receiveCash = ref(0)
const { copy, copied } = useClipboard()
const visualBusy = ref(false)
const reducedMotion = usePreferredReducedMotion()
const motionEnabled = useLocalStorage('hachitu:capital:motion', reducedMotion.value !== 'reduce')
const boardTheme = useLocalStorage('hachitu:capital:theme', 'light')
const decisionDialog = ref<HTMLDialogElement>()
const decisionMount = ref<HTMLElement>()
const portfolioMount = ref<HTMLElement>()
const viewMount = ref<HTMLElement>()
const clock = useTimestamp({ interval: 100 })
const serverOffset = ref(0)
watch(
  () => state.value?.serverTime,
  (value) => {
    if (value) serverOffset.value = value - Date.now()
  },
  { immediate: true },
)
const presentationRunning = computed(
  () =>
    visualBusy.value ||
    (state.value?.presentation?.readyAt || 0) > clock.value + serverOffset.value,
)
const seenCard = ref('')
const cardKey = computed(
  () => `${state.value?.code}:${state.value?.presentation?.id}:${state.value?.card?.text}`,
)
const pendingCard = computed(
  () => !!state.value?.card && myTurn.value && cardKey.value !== seenCard.value,
)
const requiredDecision = computed(() => {
  const s = state.value
  if (
    !s ||
    s.phase === 'lobby' ||
    s.phase === 'ended' ||
    s.paused ||
    presentationRunning.value ||
    me.value?.bankrupt
  )
    return false
  return (
    pendingCard.value ||
    (s.phase === 'buy' && myTurn.value) ||
    (s.phase === 'debt' && debtMine.value) ||
    s.auction?.actor === me.value?.id ||
    s.trade?.to === me.value?.id ||
    (s.phase === 'roll' && myTurn.value && me.value?.jail)
  )
})
const active = computed(() => state.value?.players[state.value.turn])
const isHost = computed(() => state.value?.hostId === me.value?.id)
const myTurn = computed(() => active.value?.id === me.value?.id)
const blocked = computed(
  () => busy.value || !connected.value || !!state.value?.paused || presentationRunning.value,
)
const tile = computed(() => state.value?.board.find((t) => t.id === selected.value))
const asset = computed(() => state.value?.properties.find((a) => a.id === selected.value))
const myAssets = computed(
  () => state.value?.properties.filter((a) => a.owner === me.value?.id) || [],
)
const debtMine = computed(() => !!me.value && state.value?.debt?.from === me.value.id)
watch(
  [requiredDecision, decisionDialog],
  () => {
    const d = decisionDialog.value
    if (!d) return
    if (requiredDecision.value && !d.open) d.showModal()
    else if (!requiredDecision.value && d.open) d.close()
  },
  { flush: 'post' },
)
onScopeDispose(() => {
  decisionDialog.value?.close()
})
const mayManage = computed(
  () =>
    !blocked.value &&
    !state.value?.trade &&
    (debtMine.value || (myTurn.value && ['roll', 'end'].includes(state.value?.phase || ''))),
)
const mayTrade = computed(() => mayManage.value && !me.value?.bankrupt)
const counterpart = computed(() => state.value?.players.find((p) => p.id === tradeTo.value))
const tradeAssets = computed(
  () => state.value?.properties.filter((a) => a.owner === tradeTo.value) || [],
)
const propertyName = (id: number) => state.value?.board[id]?.name || ''
const personName = (id: string | null | undefined) =>
  state.value?.players.find((p) => p.id === id)?.name || 'Ngân hàng'
const invite = computed(() => `${window.location.origin}/co-ty-phu?room=${state.value?.code || ''}`)
const actionTitle = computed(() => {
  const s = state.value
  if (!s) return ''
  if (s.paused) return 'Tạm dừng kết nối'
  if (presentationRunning.value) return 'Đang thực hiện lượt đi…'
  if (pendingCard.value) return s.card?.kind === 'chance' ? 'Thẻ Cơ hội' : 'Thẻ Cộng đồng'
  if (s.trade) return 'Đang thương lượng'
  if (s.phase === 'debt') return `${personName(s.debt?.from)} cần thanh toán`
  if (s.phase === 'auction') return `Đấu giá ${propertyName(s.auction!.tileId)}`
  if (s.phase === 'buy') return `${personName(active.value?.id)} có quyền mua`
  if (s.phase === 'ended') return 'Đế chế đã tìm thấy chủ nhân'
  return myTurn.value
    ? s.phase === 'roll'
      ? s.again
        ? 'Bạn được gieo thêm!'
        : 'Đến lượt bạn'
      : 'Hoàn tất lượt đi'
    : `Lượt của ${active.value?.name}`
})
watch(
  () => state.value?.auction?.high,
  (value) => {
    bid.value = (value || 0) + 1
  },
)
watch(
  () => state.value?.settings,
  (value) => {
    if (value) settings.value = { ...value }
  },
  { immediate: true },
)
watch(
  () => state.value?.phase,
  () => {
    selected.value = active.value?.position ?? null
  },
)
watch(tradeTo, () => {
  take.value = []
})
watch(modal, (value) => {
  if (value) dialog.value?.showModal()
  else dialog.value?.close()
})
watch(
  () => state.value?.code,
  () => {
    modal.value = ''
    selected.value = null
  },
)
useEventListener(dialog, 'close', () => {
  modal.value = ''
})
async function enter() {
  await send(joining.value ? 'join' : 'create', {
    name: name.value,
    character: character.value,
    code: roomCode.value,
  })
}
function editCharacter() {
  if (me.value?.character) character.value = { ...me.value.character }
  modal.value = 'character'
}
async function saveCharacter() {
  if (await send('character', { character: character.value })) modal.value = ''
}
async function run(action: string, input: Input = {}) {
  const ok = await send(action, input)
  if (ok && ['close', 'leave', 'surrender', 'bankrupt', 'trade'].includes(action)) modal.value = ''
}
function showTile(id: number) {
  selected.value = id
  modal.value = 'tile'
}
function openPanel(value: 'assets' | 'players' | 'log') {
  tab.value = value
  modal.value = 'portfolio'
}
function tradable(a: Property) {
  return !state.value?.properties.some(
    (b) =>
      b.level &&
      state.value?.board[b.id]?.group === state.value?.board[a.id]?.group &&
      state.value?.board[a.id]?.group,
  )
}
function openTrade() {
  tradeTo.value = state.value?.players.find((p) => p.id !== me.value?.id && !p.bankrupt)?.id || ''
  give.value = []
  take.value = []
  giveCash.value = 0
  receiveCash.value = 0
  modal.value = 'trade'
}
async function offerTrade() {
  await run('trade', {
    to: tradeTo.value,
    give: give.value,
    take: take.value,
    giveCash: giveCash.value,
    receiveCash: receiveCash.value,
  })
}
function outside(event: MouseEvent) {
  if (event.target === dialog.value) modal.value = ''
}
</script>

<template>
  <div
    class="capital-app"
    :class="{
      'motion-enabled': motionEnabled,
      'in-game': state && !['lobby'].includes(state.phase),
    }"
  >
    <header class="capital-header">
      <RouterLink to="/" aria-label="Về trang chủ" class="icon-button"
        ><Icon icon="lucide:arrow-left"
      /></RouterLink>
      <div class="capital-wordmark">
        HACHI <b>CAPITAL</b><small>CỜ TỶ PHÚ · VIETNAM EDITION</small>
      </div>
      <span
        class="connection-dot"
        :class="{ online: connected }"
        :title="connected ? 'Đã kết nối' : 'Đang kết nối'"
      />
      <button class="icon-button" aria-label="Luật chơi" @click="modal = 'help'">
        <Icon icon="lucide:book-open" />
      </button>
      <button v-if="state" class="icon-button" aria-label="Quản lý phòng" @click="modal = 'room'">
        <Icon icon="lucide:settings-2" />
      </button>
    </header>
    <div v-if="error" class="capital-notice" role="alert">
      {{ error
      }}<button @click="error = ''" aria-label="Đóng thông báo"><Icon icon="lucide:x" /></button>
    </div>
    <div v-if="!connected" class="capital-notice">
      Đang kết nối máy chủ… <button @click="reconnect">Kết nối lại</button>
    </div>

    <main v-if="!state" class="capital-entry">
      <section class="entry-editorial">
        <span class="kicker">BẠN BÈ QUANH BÀN · 02—06 NGƯỜI</span>
        <h1>Một nước đi.<br /><em>Cả một đế chế.</em></h1>
        <p>Mua một góc phố. Xây cả thành phố. Hẹn bạn bè trên bàn cờ tỷ phú của riêng mình.</p>
        <div class="deed-fan" aria-hidden="true">
          <div class="sample-deed group-amber">
            <span>ĐÀ LẠT</span><Icon icon="lucide:trees" /><strong>180</strong
            ><small>CAO NGUYÊN SƯƠNG MÙ</small>
          </div>
          <div class="sample-deed group-coral">
            <span>CẦN THƠ</span><Icon icon="lucide:ship" /><strong>220</strong
            ><small>MIỀN SÔNG NƯỚC</small>
          </div>
          <div class="sample-deed group-ink">
            <span>SÀI GÒN</span><Icon icon="lucide:building-2" /><strong>400</strong
            ><small>THÀNH PHỐ KHÔNG NGỦ</small>
          </div>
        </div>
        <div class="entry-facts">
          <span><b>40</b> ô khám phá</span><span><b>28</b> tài sản</span
          ><span><b>∞</b> cách thương lượng</span>
        </div>
      </section>
      <form class="capital-form" @submit.prevent="enter">
        <div class="mode-tabs">
          <button type="button" :aria-pressed="!joining" @click="joining = false">Tạo phòng</button
          ><button type="button" :aria-pressed="joining" @click="joining = true">Vào phòng</button>
        </div>
        <span class="kicker">{{
          joining ? 'MỖI NGƯỜI MỘT ĐIỆN THOẠI' : 'MỜI BẠN BÈ CÙNG CHƠI'
        }}</span>
        <h2>{{ joining ? 'Một chỗ quanh bàn' : 'Mở một buổi chơi' }}</h2>
        <label for="capital-name">Tên của bạn</label
        ><input
          id="capital-name"
          v-model="name"
          maxlength="24"
          required
          autocomplete="nickname"
          placeholder="Hãy nhập tên"
        />
        <template v-if="joining"
          ><label for="capital-code">Mã phòng</label
          ><input
            id="capital-code"
            v-model="roomCode"
            maxlength="6"
            required
            placeholder="6 ký tự trên máy chủ phòng"
            autocapitalize="characters"
        /></template>
        <CharacterEditor v-model="character" :disabled="busy" :name="name" />
        <button class="primary wide" :disabled="busy || !connected || !name.trim()" type="submit">
          {{ busy ? 'Đang mở cửa…' : joining ? 'Vào phòng chơi' : 'Tạo phòng chơi'
          }}<Icon icon="lucide:arrow-right" />
        </button>
        <p class="footnote">
          Không cần tài khoản. Tiền trong game là tiền giả lập. Phòng giữ tối đa 24 giờ trong buổi
          chơi.
        </p>
      </form>
    </main>

    <main v-else-if="state.phase === 'lobby'" class="capital-lobby">
      <section class="lobby-invite">
        <span class="kicker">CHUẨN BỊ KHỞI HÀNH</span>
        <h1>Đủ bạn.<br /><em>Là đủ vui.</em></h1>
        <p>Gửi mã hoặc lời mời cho bạn bè. Mỗi người mở trên điện thoại của mình.</p>
        <div class="code-ticket">
          <small>MÃ PHÒNG</small><strong>{{ state.code }}</strong
          ><button @click="copy(invite)">
            <Icon icon="lucide:copy" />{{ copied ? 'Đã chép lời mời' : 'Chép lời mời' }}
          </button>
        </div>
        <button class="wide" :aria-pressed="me?.ready" :disabled="blocked" @click="run('ready')">
          <Icon :icon="me?.ready ? 'lucide:check-check' : 'lucide:hand'" />{{
            me?.ready ? 'Đã sẵn sàng · Nhấn để hủy' : 'Tôi đã sẵn sàng'
          }}
        </button>
        <button class="wide" :disabled="blocked" @click="editCharacter">
          <Icon icon="lucide:shirt" />Chỉnh nhân vật của tôi
        </button>
        <button
          v-if="isHost"
          class="primary wide"
          :disabled="
            blocked ||
            state.players.length < 2 ||
            !state.players.every((p) => p.ready && p.connected)
          "
          @click="run('start')"
        >
          Bắt đầu hành trình<Icon icon="lucide:dices" />
        </button>
        <p class="footnote">
          {{ state.players.filter((p) => p.ready).length }}/{{ state.players.length }} sẵn sàng ·
          Cần ít nhất 2 người. Chủ phòng cũng là người chơi.
        </p>
      </section>
      <section>
        <div class="section-line">
          <span>// QUANH BÀN</span><b>{{ state.players.length }}/6</b>
        </div>
        <button
          v-if="isHost"
          class="primary wide add-bot"
          :disabled="blocked || state.players.length >= 6"
          @click="run('add-bot')"
        >
          <Icon icon="lucide:bot" />Thêm máy vào bàn<small>{{ state.players.length }}/6 chỗ</small>
        </button>
        <div class="lobby-roster">
          <article v-for="(p, i) in state.players" :key="p.id">
            <CharacterSprite
              class="roster-character"
              :class="`player-${i}`"
              :character="p.character"
              :name="p.name"
            />
            <div>
              <strong>{{ p.name }}<Icon v-if="p.isBot" icon="lucide:bot" /></strong
              ><small
                >{{ p.id === state.hostId ? 'Chủ phòng · ' : ''
                }}{{ !p.connected ? 'Mất kết nối' : p.ready ? 'Sẵn sàng' : 'Đang chuẩn bị' }}</small
              >
            </div>
            <Icon v-if="p.ready" icon="lucide:check" />
            <button
              v-if="isHost && p.isBot"
              :disabled="busy"
              class="remove-bot"
              :aria-label="`Xóa ${p.name}`"
              @click="run('kick', { id: p.id })"
            >
              <Icon icon="lucide:x" />
            </button>
          </article>
        </div>
        <form class="rule-config" @submit.prevent="run('settings', settings)">
          <div class="section-line">
            <span>// LUẬT CỦA BÀN</span><Icon icon="lucide:sliders-horizontal" />
          </div>
          <label
            >Vốn khởi đầu<select v-model.number="settings.startingCash" :disabled="!isHost || busy">
              <option v-for="n in [1000, 1500, 2000, 2500]" :key="n" :value="n">
                {{ money(n) }}{{ n === 1500 ? ' · Cổ điển' : '' }}
              </option>
            </select></label
          ><label
            >Thời lượng<select v-model.number="settings.timeLimit" :disabled="!isHost || busy">
              <option :value="0">Đến người cuối cùng</option>
              <option v-for="n in [30, 60, 90]" :key="n" :value="n">
                {{ n }} phút · Xếp hạng tài sản
              </option>
            </select></label
          ><label class="check-row"
            ><input
              type="checkbox"
              v-model="settings.parkingPot"
              :disabled="!isHost || busy"
            /><span
              >Quỹ thưởng Công viên<small
                >Luật nhà: gom thuế và phí sự kiện; không tính mua, xây hay chuộc đất.</small
              ></span
            ></label
          ><label class="check-row"
            ><input type="checkbox" v-model="settings.doubleGo" :disabled="!isHost || busy" /><span
              >Đúng ô Khởi hành nhận gấp đôi<small>Luật nhà: nhận 400 thay vì 200.</small></span
            ></label
          ><button v-if="isHost" type="submit" :disabled="blocked" class="wide">
            Áp dụng luật · Mọi người sẵn sàng lại
          </button>
          <p class="footnote">
            Mặc định: 1.500 vốn, 200 khi qua Khởi hành, Công viên không thưởng. Đọc Luật chơi để xem
            quy ước phiên bản số.
          </p>
        </form>
      </section>
    </main>

    <main v-else class="capital-game focus-game">
      <div class="game-topline">
        <span class="kicker">PHÒNG {{ state.code }} · LƯỢT {{ state.turnNumber }}</span
        ><strong
          >{{ me?.name }} <span>{{ money(me?.cash || 0) }}</span></strong
        >
      </div>
      <nav class="game-tools" aria-label="Bảng thông tin trò chơi">
        <button @click="openPanel('assets')" aria-label="Tài sản của tôi">
          <Icon icon="lucide:landmark" /><span>Tài sản</span></button
        ><button @click="openPanel('players')" aria-label="Danh sách người chơi">
          <Icon icon="lucide:users" /><span>Người chơi</span></button
        ><button @click="openPanel('log')" aria-label="Nhật ký ván chơi">
          <Icon icon="lucide:scroll-text" /><span>Nhật ký</span></button
        ><button @click="modal = 'view'" aria-label="Cài đặt hiển thị">
          <Icon icon="lucide:sliders-horizontal" /><span>Hiển thị</span>
        </button>
      </nav>
      <section v-if="state.paused" class="capital-notice">
        Chờ
        {{
          state.players
            .filter((p) => !p.connected && !p.bankrupt)
            .map((p) => p.name)
            .join(', ')
        }}
        kết nối lại. Mở lại trang trên cùng trình duyệt để tiếp tục.
      </section>
      <div class="game-layout">
        <section class="board-column">
          <div
            ref="boardViewport"
            class="board-viewport"
            :class="{ zoomed }"
            :style="{ '--board-fit': boardFit }"
          >
            <GameBoard
              :state="state"
              :selected="selected"
              :motion-enabled="motionEnabled"
              :theme="boardTheme"
              @select="showTile"
              @presenting="visualBusy = $event"
            />
          </div>
          <div class="hidden-board-tools">
            <Teleport :to="viewMount || 'body'" :disabled="!viewMount"
              ><div class="view-settings">
                <div class="board-legend">
                  <span>Chạm ô để xem tài sản</span
                  ><span>{{
                    state.settings.timeLimit
                      ? `Ván ${state.settings.timeLimit} phút`
                      : 'Đến người cuối cùng'
                  }}</span>
                </div>
                <button
                  class="motion-toggle"
                  :aria-pressed="motionEnabled"
                  @click="motionEnabled = !motionEnabled"
                >
                  <Icon icon="lucide:clapperboard" />Hiệu ứng: {{ motionEnabled ? 'Bật' : 'Tắt'
                  }}<small>Chuyển động nhân vật và xúc xắc</small>
                </button>
                <div class="board-inspector">
                  <button
                    class="icon-button"
                    :aria-pressed="zoomed"
                    :aria-label="zoomed ? 'Thu nhỏ bàn cờ' : 'Phóng to bàn cờ'"
                    @click="zoomed = !zoomed"
                  >
                    <Icon :icon="zoomed ? 'lucide:zoom-out' : 'lucide:zoom-in'" />
                  </button>
                  <select v-model.number="inspectId" aria-label="Chọn ô để xem chi tiết">
                    <option v-for="t in state.board" :key="t.id" :value="t.id">
                      {{ t.id }} · {{ t.name }}
                    </option>
                  </select>
                  <button @click="showTile(inspectId)">Xem ô</button>
                </div>
                <label class="theme-selector"
                  >Khung cảnh<select v-model="boardTheme">
                    <option value="light">Phố ban mai</option>
                    <option value="summer">Bến cảng mùa hè</option>
                    <option value="autumn">Phố mùa thu</option>
                  </select></label
                >
                <a
                  class="art-credit"
                  href="/co-ty-phu/poorup-art/LICENSE.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Đồ họa: Poorup · jeremy341 · MIT</a
                >
              </div></Teleport
            >
          </div>
          <div class="player-strip">
            <button
              v-for="(p, i) in state.players"
              :key="p.id"
              :class="{ active: active?.id === p.id, eliminated: p.bankrupt }"
              @click="tab = 'players'"
            >
              <CharacterSprite
                class="strip-character"
                :class="`player-${i}`"
                :character="p.character"
                :name="p.name"
              /><span
                >{{ p.name }}<b>{{ p.bankrupt ? 'Phá sản' : money(p.cash) }}</b></span
              >
            </button>
          </div>
        </section>
        <aside class="game-sidebar">
          <Teleport :to="decisionMount || 'body'" :disabled="!requiredDecision || !decisionMount">
            <section class="turn-panel" aria-live="polite">
              <span class="kicker">{{ myTurn ? 'QUYẾT ĐỊNH CỦA BẠN' : 'CÙNG THEO DÕI' }}</span>
              <h2>{{ actionTitle }}</h2>
              <div
                v-if="state.phase === 'buy' && !pendingCard"
                class="decision-property"
                :class="`group-${state.board[active?.position || 0]?.group || 'none'}`"
              >
                <Icon icon="lucide:building-2" /><strong>{{
                  propertyName(active?.position || 0)
                }}</strong
                ><small>Giá mua {{ money(state.board[active?.position || 0]?.price || 0) }}</small>
              </div>
              <template v-if="pendingCard && !presentationRunning"
                ><img
                  class="decision-art"
                  :src="`/co-ty-phu/poorup-art/icons/${state.card?.kind === 'chance' ? 'surprise' : 'treasure-chest'}.svg`"
                  alt=""
                />
                <p>{{ state.card?.text }}</p>
                <button class="primary wide" @click="seenCard = cardKey">
                  Đã hiểu · Tiếp tục
                </button></template
              >
              <template v-else-if="state.phase === 'ended'"
                ><Icon icon="lucide:trophy" class="victory-icon" />
                <p>
                  {{
                    state.winnerIds.length
                      ? `${state.winnerIds.map(personName).join(' & ')} chiến thắng!`
                      : 'Không còn người có khả năng thanh toán. Ván kết thúc không có người thắng.'
                  }}
                </p>
                <button
                  v-if="isHost"
                  class="primary wide"
                  :disabled="blocked"
                  @click="run('rematch')"
                >
                  Mở ván mới
                </button></template
              >
              <template v-else-if="state.trade"
                ><p>
                  {{ personName(state.trade.from) }} đề nghị trao đổi với
                  {{ personName(state.trade.to) }}.
                </p>
                <div class="trade-summary">
                  <p>
                    <b>Bên đề nghị đưa:</b>
                    {{ state.trade.give.map(propertyName).join(', ') || 'Không có đất' }} +
                    {{ money(state.trade.giveCash) }}
                  </p>
                  <p>
                    <b>Đổi lấy:</b>
                    {{ state.trade.take.map(propertyName).join(', ') || 'Không có đất' }} +
                    {{ money(state.trade.receiveCash) }}
                  </p>
                  <small
                    >Nhận đất thế chấp: trả ngay 10% giá thế chấp cho ngân hàng, giữ nguyên thế
                    chấp.</small
                  >
                </div>
                <button
                  v-if="state.trade.to === me?.id"
                  class="primary wide"
                  :disabled="blocked"
                  @click="run('trade-reply', { accept: true })"
                >
                  Chấp nhận trao đổi</button
                ><button
                  v-if="[state.trade.from, state.trade.to].includes(me?.id || '')"
                  class="wide"
                  :disabled="busy || !connected"
                  @click="run('cancel-trade')"
                >
                  {{ state.trade.to === me?.id ? 'Từ chối' : 'Hủy đề nghị' }}
                </button></template
              >
              <template v-else-if="state.phase === 'debt'"
                ><p>
                  {{ state.debt?.reason }} · Cần trả <b>{{ money(state.debt?.amount || 0) }}</b> cho
                  {{ personName(state.debt?.to) }}.
                </p>
                <p v-if="debtMine">
                  Bạn có {{ money(me?.cash || 0) }}. Chọn tài sản để bán nhà, thế chấp hoặc thương
                  lượng.
                </p>
                <div v-if="debtMine" class="debt-assets">
                  <button
                    v-for="a in myAssets"
                    :key="a.id"
                    :disabled="blocked"
                    @click="showTile(a.id)"
                  >
                    <Icon icon="lucide:landmark" />{{ propertyName(a.id)
                    }}<small>{{
                      a.mortgaged ? 'Đã thế chấp' : a.level ? 'Có công trình' : 'Có thể thế chấp'
                    }}</small>
                  </button>
                </div>
                <button v-if="debtMine" class="wide" @click="openTrade" :disabled="blocked">
                  Trao đổi để trả nợ</button
                ><button
                  v-if="debtMine"
                  class="danger wide"
                  @click="modal = 'bankrupt'"
                  :disabled="blocked"
                >
                  Tuyên bố phá sản…
                </button></template
              >
              <template v-else-if="state.auction"
                ><p>
                  Giá cao nhất <b>{{ money(state.auction.high) }}</b> ·
                  {{ personName(state.auction.bidder) }}
                </p>
                <p>
                  Đến lượt {{ personName(state.auction.actor) }}. Bỏ lượt nghĩa là rút khỏi phiên
                  đấu giá này.
                </p>
                <form
                  v-if="state.auction.actor === me?.id"
                  @submit.prevent="run('bid', { amount: bid })"
                >
                  <label for="bid-value">Giá bạn trả</label
                  ><input
                    id="bid-value"
                    v-model.number="bid"
                    type="number"
                    :min="state.auction.high + 1"
                    :max="me?.cash"
                    step="1"
                    required
                  /><button class="primary wide" :disabled="blocked">Trả giá</button
                  ><button type="button" class="wide" :disabled="blocked" @click="run('pass')">
                    Rút khỏi đấu giá
                  </button>
                </form></template
              >
              <template v-else-if="state.phase === 'buy'"
                ><p>
                  {{ propertyName(active?.position || 0) }} · Giá
                  {{ money(state.board[active?.position || 0]?.price || 0) }}
                </p>
                <template v-if="myTurn"
                  ><button
                    class="primary wide"
                    :disabled="
                      blocked || (me?.cash || 0) < (state.board[active?.position || 0]?.price || 0)
                    "
                    @click="run('buy')"
                  >
                    Mua tài sản</button
                  ><button class="wide" :disabled="blocked" @click="run('auction')">
                    Đưa ra đấu giá
                  </button></template
                ></template
              >
              <template v-else-if="myTurn && state.phase === 'roll'"
                ><p v-if="me?.jail">
                  Đang ở tù · Đã thử {{ me.jailTurns }}/3 lần. Gieo đôi để ra tù; lần thứ ba phải
                  trả 50.
                </p>
                <button class="primary roll-button wide" :disabled="blocked" @click="run('roll')">
                  <Icon icon="lucide:dices" />{{ me?.jail ? 'Thử gieo đôi' : 'Gieo xúc xắc' }}
                </button>
                <div v-if="me?.jail" class="button-row">
                  <button :disabled="blocked || me.cash < 50" @click="run('bail')">
                    Trả 50 để ra tù</button
                  ><button v-if="me.jailCards" :disabled="blocked" @click="run('jail-card')">
                    Dùng giấy miễn tù
                  </button>
                </div></template
              >
              <button
                v-else-if="myTurn && state.phase === 'end'"
                class="primary wide"
                :disabled="blocked"
                @click="run('end')"
              >
                Kết thúc lượt<Icon icon="lucide:arrow-right" />
              </button>
              <p v-else class="footnote">
                Theo dõi bàn cờ, xem tài sản và chuẩn bị nước đi của bạn.
              </p>
              <div v-if="state.card && !pendingCard" class="event-card">
                <Icon :icon="state.card.kind === 'chance' ? 'lucide:sparkles' : 'lucide:gift'" />
                <p>{{ state.card.text }}</p>
              </div>
            </section>
          </Teleport>
          <Teleport :to="portfolioMount || 'body'" :disabled="!portfolioMount"
            ><section class="portfolio">
              <div class="mode-tabs">
                <button :aria-pressed="tab === 'assets'" @click="tab = 'assets'">Tài sản</button
                ><button :aria-pressed="tab === 'players'" @click="tab = 'players'">
                  Người chơi</button
                ><button :aria-pressed="tab === 'log'" @click="tab = 'log'">Nhật ký</button>
              </div>
              <template v-if="tab === 'assets'"
                ><div class="section-line">
                  <span
                    >{{ myAssets.length }} tài sản · {{ money(me?.worth || 0) }} tổng giá trị</span
                  ><button
                    class="icon-button"
                    aria-label="Đề nghị trao đổi"
                    :disabled="!mayTrade"
                    @click="openTrade"
                  >
                    <Icon icon="lucide:arrow-left-right" />
                  </button>
                </div>
                <p v-if="!myAssets.length" class="empty-state">
                  Hành trình lớn bắt đầu bằng một góc phố.<br />Mua tài sản đầu tiên khi bạn đặt
                  chân tới.
                </p>
                <div class="asset-list">
                  <button
                    v-for="a in myAssets"
                    :key="a.id"
                    @click="showTile(a.id)"
                    :class="`group-${state.board[a.id]?.group || 'none'}`"
                  >
                    <span class="asset-color" /><span
                      >{{ propertyName(a.id)
                      }}<small>{{
                        a.mortgaged
                          ? 'Đang thế chấp'
                          : a.level === 5
                            ? 'Khách sạn'
                            : `${a.level} nhà`
                      }}</small></span
                    ><Icon icon="lucide:chevron-right" />
                  </button>
                </div>
                <button v-if="mayTrade" class="wide" @click="openTrade">
                  Thương lượng với bạn bè
                </button></template
              >
              <div v-else-if="tab === 'players'" class="standings">
                <article v-for="(p, i) in state.players" :key="p.id">
                  <CharacterSprite
                    class="strip-character"
                    :class="`player-${i}`"
                    :character="p.character"
                    :name="p.name"
                  />
                  <div>
                    <b>{{ p.name }}</b
                    ><small>{{
                      p.bankrupt
                        ? 'Đã phá sản'
                        : p.jail
                          ? 'Đang ở tù'
                          : !p.connected
                            ? 'Mất kết nối'
                            : 'Đang chơi'
                    }}</small>
                  </div>
                  <span
                    >{{ money(p.cash) }}<small>Tổng {{ money(p.worth) }}</small></span
                  >
                </article>
              </div>
              <ol v-else class="game-log">
                <li
                  v-for="(line, i) in [...state.logs].reverse()"
                  :key="`${state.logs.length - i}-${line}`"
                >
                  {{ line }}
                </li>
              </ol>
            </section></Teleport
          >
        </aside>
      </div>
    </main>

    <dialog
      ref="decisionDialog"
      class="capital-dialog decision-dialog"
      aria-label="Quyết định lượt chơi"
      @cancel.prevent
    >
      <div class="modal-body">
        <header>
          <span class="kicker">ĐẾN LƯỢT BẠN QUYẾT ĐỊNH</span
          ><span class="decision-required">Bắt buộc</span>
        </header>
        <div ref="decisionMount" />
      </div>
    </dialog>
    <dialog ref="dialog" class="capital-dialog" @click="outside">
      <div class="modal-body">
        <header>
          <span class="kicker">HACHI CAPITAL</span
          ><button class="icon-button" aria-label="Đóng" @click="modal = ''">
            <Icon icon="lucide:x" />
          </button>
        </header>
        <p v-if="error" role="alert" class="capital-notice">{{ error }}</p>
        <section v-show="modal === 'portfolio'">
          <h2>
            {{
              tab === 'assets'
                ? 'Tài sản của bạn'
                : tab === 'players'
                  ? 'Quanh bàn chơi'
                  : 'Nhật ký ván chơi'
            }}
          </h2>
          <div ref="portfolioMount" />
        </section>
        <section v-show="modal === 'view'">
          <h2>Hiển thị bàn chơi</h2>
          <div ref="viewMount" />
        </section>
        <section v-if="modal === 'character' && state?.phase === 'lobby'">
          <h2>Nhân vật của bạn</h2>
          <CharacterEditor
            v-model="character"
            :disabled="busy"
            :name="me?.name"
            :taken="
              state.players
                .filter((p) => p.id !== me?.id)
                .flatMap((p) => (p.character ? [p.character] : []))
            "
          />
          <p class="footnote">Lưu thay đổi sẽ hủy trạng thái sẵn sàng của bạn.</p>
          <button class="primary wide" :disabled="blocked" @click="saveCharacter">
            Lưu nhân vật
          </button>
        </section>
        <section
          v-if="modal === 'tile' && tile"
          class="deed-detail"
          :class="`group-${tile.group || 'none'}`"
        >
          <div class="deed-title">
            <span>{{ tile.kind === 'street' ? 'GIẤY CHỨNG NHẬN SỞ HỮU' : 'TRÊN BẢN ĐỒ' }}</span>
            <h2>{{ tile.name }}</h2>
          </div>
          <p>
            {{ asset?.owner ? `Chủ sở hữu: ${personName(asset.owner)}` : 'Thuộc ngân hàng'
            }}{{ asset?.mortgaged ? ' · Đang thế chấp' : '' }}
          </p>
          <div v-if="tile.kind === 'street'" class="property-development">
            <Transition name="construction" mode="out-in"
              ><PropertyBuildings
                v-if="asset?.level"
                :key="`${tile.id}:${asset.level}`"
                :level="asset.level"
                :name="tile.name"
              />
              <div v-else class="empty-development">
                <Icon icon="lucide:land-plot" /><span>Đất trống</span>
              </div></Transition
            ><strong>{{
              asset?.level === 5
                ? 'Khách sạn'
                : asset?.level
                  ? `${asset.level} nhà`
                  : 'Chưa xây dựng'
            }}</strong>
            <div class="development-track">
              <span v-for="n in 5" :key="n" :class="{ done: (asset?.level || 0) >= n }">{{
                n === 5 ? 'KS' : n
              }}</span>
            </div>
          </div>
          <template v-if="tile.price"
            ><div class="deed-prices">
              <span
                >Giá mua<b>{{ money(tile.price) }}</b></span
              ><span
                >Thế chấp<b>{{ money(tile.price / 2) }}</b></span
              ><span
                >Chuộc<b>{{ money(tile.price / 2 + Math.ceil(tile.price / 20)) }}</b></span
              >
            </div>
            <div v-if="tile.rents" class="rent-table">
              <div v-for="(value, i) in tile.rents" :key="i">
                <span>{{ i === 0 ? 'Đất trống' : i === 5 ? 'Khách sạn' : `${i} nhà` }}</span
                ><b>{{ money(value) }}</b>
              </div>
              <p class="footnote">
                Đủ nhóm màu: tiền thuê đất trống gấp đôi. Xây đều, mỗi cấp {{ tile.houseCost }}. Bán
                lại công trình được nửa giá.
              </p>
            </div>
            <p v-else>
              {{
                tile.kind === 'station'
                  ? 'Sở hữu 1/2/3/4 ga: tiền thuê 25/50/100/200.'
                  : 'Một tiện ích: 4 × tổng xúc xắc. Cả hai: 10 × tổng xúc xắc.'
              }}
            </p>
            <div v-if="asset && me && asset.owner === me.id" class="asset-actions">
              <template v-if="!asset.mortgaged"
                ><button
                  v-if="tile.kind === 'street'"
                  :disabled="!mayManage || debtMine"
                  @click="run('build', { tileId: tile.id })"
                >
                  <Icon icon="lucide:house-plus" />Xây thêm</button
                ><button
                  v-if="asset.level"
                  :disabled="!mayManage"
                  @click="run('sell', { tileId: tile.id })"
                >
                  Bán 1 cấp</button
                ><button
                  v-if="asset.level"
                  :disabled="!mayManage"
                  @click="run('sell-group', { tileId: tile.id })"
                >
                  Bán công trình cả nhóm</button
                ><button :disabled="!mayManage" @click="run('mortgage', { tileId: tile.id })">
                  Thế chấp
                </button></template
              ><button
                v-else
                :disabled="!mayManage || debtMine"
                @click="run('redeem', { tileId: tile.id })"
              >
                Chuộc tài sản
              </button>
            </div></template
          >
          <p v-else>
            {{
              tile.kind === 'go'
                ? 'Qua Khởi hành nhận 200. Luật nhà có thể thưởng thêm khi dừng đúng ô.'
                : tile.kind === 'jail'
                  ? 'Đi ngang là thăm tù. Người bị giam gieo đôi, dùng thẻ hoặc trả 50 để ra.'
                  : tile.kind === 'parking'
                    ? 'Nghỉ chân. Mặc định không có tiền thưởng.'
                    : tile.kind === 'go-jail'
                      ? 'Đi thẳng vào tù. Không nhận lương Khởi hành.'
                      : tile.amount
                        ? `Trả ngân hàng ${tile.amount}.`
                        : 'Rút một thẻ và thực hiện hiệu ứng ngay.'
            }}
          </p>
        </section>
        <form v-if="modal === 'trade'" @submit.prevent="offerTrade" class="trade-form">
          <h2>Một thỏa thuận tốt.</h2>
          <label
            >Đối tác<select v-model="tradeTo">
              <option
                v-for="p in state?.players.filter((p) => p.id !== me?.id && !p.bankrupt)"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }}
              </option>
            </select></label
          >
          <h3>Bạn đưa</h3>
          <label
            >Tiền mặt<input
              v-model.number="giveCash"
              type="number"
              min="0"
              :max="me?.cash"
              required /></label
          ><label v-for="a in myAssets" :key="a.id" class="check-row"
            ><input type="checkbox" v-model="give" :value="a.id" :disabled="!tradable(a)" />{{
              propertyName(a.id)
            }}{{ a.mortgaged ? ' · Thế chấp' : '' }}</label
          >
          <h3>{{ counterpart?.name }} đưa</h3>
          <label
            >Tiền mặt<input
              v-model.number="receiveCash"
              type="number"
              min="0"
              :max="counterpart?.cash"
              required /></label
          ><label v-for="a in tradeAssets" :key="a.id" class="check-row"
            ><input type="checkbox" v-model="take" :value="a.id" :disabled="!tradable(a)" />{{
              propertyName(a.id)
            }}{{ a.mortgaged ? ' · Thế chấp' : '' }}</label
          >
          <p class="footnote">
            Nhóm có nhà cần bán hết nhà trước khi trao đổi. Nhận đất thế chấp phải trả ngay lãi 10%
            giá thế chấp; chuộc sau trả gốc + 10% lần nữa.
          </p>
          <button class="primary wide" :disabled="blocked || !mayTrade">Gửi đề nghị</button>
        </form>
        <section v-if="modal === 'bankrupt' || modal === 'surrender'">
          <h2>{{ modal === 'bankrupt' ? 'Tuyên bố phá sản?' : 'Bỏ cuộc ván này?' }}</h2>
          <p>
            Bạn sẽ bị loại khỏi ván. Công trình được thanh lý; tài sản chuyển cho chủ nợ hoặc đưa về
            ngân hàng để đấu giá. Hãy cân nhắc thế chấp và trao đổi trước.
          </p>
          <button class="danger wide" :disabled="blocked" @click="run(modal)">
            Xác nhận {{ modal === 'bankrupt' ? 'phá sản' : 'bỏ cuộc' }}
          </button>
        </section>
        <section v-if="modal === 'room' && state">
          <h2>Bàn chơi {{ state.code }}</h2>
          <button class="wide" @click="modal = 'help'">
            <Icon icon="lucide:book-open" />Luật chơi
          </button>
          <button class="wide" @click="copy(invite)">
            {{ copied ? 'Đã chép' : 'Chép lời mời' }}
          </button>
          <p>
            Vốn {{ money(state.settings.startingCash) }} ·
            {{
              state.settings.timeLimit ? `${state.settings.timeLimit} phút` : 'Đến người cuối cùng'
            }}.
          </p>
          <p class="footnote">
            {{ state.settings.parkingPot ? 'Có quỹ Công viên. ' : ''
            }}{{ state.settings.doubleGo ? 'Đúng Khởi hành nhận gấp đôi.' : '' }}Mất mạng: mở lại
            cùng trình duyệt. Ván tạm dừng để chờ. Phòng mất khi server khởi động lại.
          </p>
          <button
            v-if="['lobby', 'ended'].includes(state.phase)"
            class="wide"
            :disabled="busy"
            @click="run('leave')"
          >
            Rời phòng</button
          ><button
            v-if="myTurn && ['roll', 'end'].includes(state.phase)"
            class="wide"
            @click="modal = 'surrender'"
          >
            Bỏ cuộc…
          </button>
          <details v-if="isHost">
            <summary>Quản lý của chủ phòng</summary>
            <button
              v-for="p in state.players.filter(
                (p) => p.id !== me?.id && ['lobby', 'ended'].includes(state!.phase),
              )"
              :key="p.id"
              class="wide"
              :disabled="busy"
              @click="run('kick', { id: p.id })"
            >
              Mời {{ p.name }} rời phòng
            </button>
            <p>Đóng phòng sẽ kết thúc buổi chơi cho tất cả mọi người.</p>
            <button class="danger wide" @click="modal = 'close-room'">Đóng phòng…</button>
          </details>
        </section>
        <section v-if="modal === 'close-room'">
          <h2>Đóng phòng cho cả bàn?</h2>
          <p>Ván hiện tại và dữ liệu buổi chơi sẽ kết thúc.</p>
          <button class="danger wide" :disabled="busy" @click="run('close')">
            Xác nhận đóng phòng
          </button>
        </section>
        <section v-if="modal === 'help'" class="rules-help">
          <span class="kicker">LUẬT CHƠI & QUY ƯỚC</span>
          <h2>Từ góc phố đến đế chế.</h2>
          <h3>01. Đi, mua, cho thuê</h3>
          <p>
            Mỗi người có 1.500 mặc định. Gieo hai xúc xắc; qua Khởi hành nhận 200. Đến đất trống:
            mua hoặc đấu giá cho cả bàn, kể cả người vừa từ chối. Đến đất người khác: tự trả tiền
            thuê. Đất thế chấp không thu tiền.
          </p>
          <h3>02. Xây đúng nhóm</h3>
          <p>
            Đủ nhóm màu mới xây, không có đất thế chấp trong nhóm. Xây và bán đều: chênh tối đa một
            cấp. Bốn nhà nâng lên một khách sạn. Ngân hàng có 32 nhà, 12 khách sạn; bán công trình
            được nửa giá. Hết nhà thì chờ, hoặc bán toàn bộ công trình nhóm để thanh lý khách sạn.
          </p>
          <h3>03. Đôi và nhà tù</h3>
          <p>
            Gieo đôi được thêm lượt; ba lần đôi liên tiếp đi tù. Trong tù vẫn thu tiền thuê. Trước
            gieo có thể trả 50 hoặc dùng giấy miễn tù. Thử tối đa ba lượt; lần ba phải trả 50 rồi đi
            theo xúc xắc. Gieo đôi ra tù không thêm lượt.
          </p>
          <h3>04. Nợ & trao đổi</h3>
          <p>
            Thiếu tiền: bán nhà, thế chấp hoặc trao đổi. Chuộc đất trả gốc thế chấp + 10%. Nhận đất
            thế chấp trong giao dịch trả ngay 10% lãi; chuộc về sau trả thêm 10%. Phá sản chuyển tài
            sản cho chủ nợ; nợ ngân hàng thì đấu giá lại. Không vay tiền giữa người chơi.
          </p>
          <h3>05. Phiên bản số HACHITU</h3>
          <p>
            Bốc thăm người đi đầu. Đấu giá lần lượt, giá tăng tối thiểu 1, rút là rời phiên. Quản lý
            công trình/trao đổi trong lượt của mình hoặc khi mắc nợ; vì vậy không có đấu giá công
            trình đồng thời. Giao dịch giấy miễn tù chưa hỗ trợ. Thuế thu nhập cố định 200, thuế xa
            xỉ 100. Tiền thuê tự thu. Hết giờ tính ở cuối lượt; hòa tài sản thì đồng thắng. Chủ
            phòng có thể bật luật nhà trước ván.
          </p>
          <p>
            Thiết kế và địa danh riêng của HACHITU. Tham khảo luật
            <a
              href="https://www.hasbro.com/common/instruct/monins.pdf"
              target="_blank"
              rel="noopener noreferrer"
              >Hasbro</a
            >. Đây là bản chuyển thể độc lập, có các quy ước số ở trên.
          </p>
        </section>
      </div>
    </dialog>
  </div>
</template>
