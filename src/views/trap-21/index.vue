<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { chooseBotMove, newRound, takeTurn, TARGET, WIN_TARGET } from './utils/game'
import type { Player } from './utils/game'

type Mode = 'bot' | 'friend'
const mode = ref<Mode>('bot')
const round = ref(newRound())
const scores = ref<[number, number]>([0, 0])
const roundNumber = ref(1)
const names = computed(() =>
  mode.value === 'bot' ? ['Bạn', 'Máy'] : ['Người chơi 1', 'Người chơi 2'],
)
const botTurn = computed(
  () => mode.value === 'bot' && round.value.current === 1 && round.value.winner === null,
)
const matchWinner = computed<Player | null>(() =>
  scores.value[0] >= WIN_TARGET ? 0 : scores.value[1] >= WIN_TARGET ? 1 : null,
)
const status = computed(() => {
  if (matchWinner.value !== null) return `${names.value[matchWinner.value]} thắng trận!`
  if (round.value.winner !== null) return `${names.value[round.value.winner]} thắng ván!`
  if (botTurn.value) return 'Máy đang suy nghĩ…'
  return `Lượt của ${names.value[round.value.current]?.toLocaleLowerCase('vi-VN')}`
})
const lastMove = computed(() => round.value.moves[round.value.moves.length - 1])
const tiles = computed(() =>
  Array.from({ length: TARGET }, (_, index) => {
    const number = index + 1
    const move = round.value.moves.find((item) => number >= item.from && number <= item.to)
    return {
      number,
      owner: move?.player,
      latest: !!lastMove.value && number >= lastMove.value.from && number <= lastMove.value.to,
    }
  }),
)

function makeMove(amount: number) {
  const next = takeTurn(round.value, amount)
  if (next === round.value) return
  round.value = next
  if (next.winner !== null) scores.value[next.winner] += 1
}

const { start: startBot, stop: stopBot } = useTimeoutFn(
  () => {
    if (botTurn.value) makeMove(chooseBotMove(round.value.total))
  },
  650,
  { immediate: false },
)

watch(
  () => [round.value.current, round.value.winner, mode.value],
  () => {
    stopBot()
    if (botTurn.value) startBot()
  },
)

function play(amount: number) {
  if (!botTurn.value) makeMove(amount)
}

function resetMatch() {
  stopBot()
  scores.value = [0, 0]
  roundNumber.value = 1
  round.value = newRound()
}

function setMode(next: Mode) {
  if (mode.value === next) return
  mode.value = next
  resetMatch()
}

function nextRound() {
  if (round.value.winner === null || matchWinner.value !== null) return
  roundNumber.value += 1
  round.value = newRound(roundNumber.value % 2 === 0 ? 1 : 0)
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('input, textarea, select, [contenteditable="true"]')
  )
    return
  if (!['1', '2', '3'].includes(event.key)) return
  event.preventDefault()
  play(Number(event.key))
})
</script>

<template>
  <div
    class="trap-page min-h-screen bg-bg-deep px-4 py-5 font-body text-text-primary sm:px-6 sm:py-8"
  >
    <div class="mx-auto max-w-5xl">
      <nav class="mb-7 flex items-center justify-between text-sm">
        <RouterLink
          to="/"
          class="inline-flex min-h-11 items-center gap-2 text-text-secondary hover:text-accent-coral"
        >
          <Icon icon="lucide:arrow-left" class="size-4" /> Trang chủ
        </RouterLink>
        <span class="font-display text-xs tracking-[0.2em] text-text-dim"
          >HACHITU / CHƠI CÙNG NHAU</span
        >
      </nav>

      <header class="mb-6 flex flex-wrap items-end justify-between gap-5 animate-fade-up">
        <div>
          <p class="mb-2 font-display text-xs tracking-[0.22em] text-accent-coral">
            // MỘT CHÚT MƯU MẸO
          </p>
          <h1 class="font-display text-5xl font-bold tracking-tight sm:text-7xl">
            Bẫy <span class="text-accent-coral">21.</span>
          </h1>
          <p class="mt-3 text-sm text-text-secondary sm:text-base">
            Thêm số, gài bẫy. Đừng là người chạm 21.
          </p>
        </div>
        <div class="flex border border-border-default bg-bg-surface p-1" aria-label="Chế độ chơi">
          <button
            type="button"
            :aria-pressed="mode === 'bot'"
            class="mode-button"
            :class="{ selected: mode === 'bot' }"
            @click="setMode('bot')"
          >
            <Icon icon="lucide:bot" class="size-4" /> Đấu với máy
          </button>
          <button
            type="button"
            :aria-pressed="mode === 'friend'"
            class="mode-button"
            :class="{ selected: mode === 'friend' }"
            @click="setMode('friend')"
          >
            <Icon icon="lucide:users" class="size-4" /> Hai người
          </button>
        </div>
      </header>

      <main
        class="overflow-hidden border border-border-default bg-bg-surface animate-fade-up animate-delay-1"
      >
        <div class="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border-default">
          <div
            v-for="player in [0, 1] as const"
            :key="player"
            class="score-panel"
            :class="[
              player === 0
                ? 'col-start-1 row-start-1 text-accent-coral'
                : 'col-start-3 row-start-1 text-accent-sky',
              { active: round.current === player && round.winner === null },
            ]"
          >
            <div class="truncate text-sm font-semibold">{{ names[player] }}</div>
            <div class="mt-2 flex gap-2" :aria-label="`${scores[player]} ván thắng`">
              <span
                v-for="point in WIN_TARGET"
                :key="point"
                class="size-2.5 rounded-full border border-current"
                :class="{ 'bg-current': scores[player] >= point }"
              />
            </div>
          </div>
          <div class="col-start-2 row-start-1 px-2 text-center">
            <p class="font-display text-2xl font-bold tabular-nums">
              {{ scores[0] }} <span class="text-text-dim">:</span> {{ scores[1] }}
            </p>
            <p class="mt-1 text-[10px] uppercase tracking-widest text-text-dim">
              Ván {{ roundNumber }}
            </p>
          </div>
        </div>

        <div class="grid md:grid-cols-[0.8fr_1.2fr]">
          <section
            class="counter-panel flex flex-col items-center justify-center border-b border-border-default px-5 py-6 text-center md:border-r md:border-b-0 md:py-12"
          >
            <p class="text-xs uppercase tracking-[0.2em] text-text-secondary">Con số hiện tại</p>
            <div
              class="relative my-2 font-display text-8xl font-bold leading-none tracking-tighter sm:text-9xl"
              :class="round.total >= 18 ? 'text-accent-coral' : 'text-text-primary'"
            >
              {{ round.total.toString().padStart(2, '0') }}
            </div>
            <div class="flex items-center gap-2 text-xs text-text-secondary">
              <Icon icon="lucide:flag-triangle-right" class="size-4 text-accent-coral" /> Chạm
              {{ TARGET }} là thua
            </div>
            <p class="mt-5 max-w-60 text-sm leading-6 text-text-secondary hidden md:block">
              Không cần nhanh tay.<br />Chỉ cần đi trước đối thủ một nước.
            </p>
          </section>

          <section class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between gap-3 text-xs text-text-dim">
              <span class="font-display uppercase tracking-widest">Đường đến chiếc bẫy</span>
              <span>{{ TARGET - round.total }} số còn lại</span>
            </div>
            <div class="grid grid-cols-7 gap-1.5 sm:gap-2" aria-label="Bàn chơi 21 số">
              <div
                v-for="tile in tiles"
                :key="tile.number"
                class="number-tile flex aspect-square items-center justify-center border font-display text-base font-semibold sm:text-xl"
                :class="{
                  'tile-one': tile.owner === 0,
                  'tile-two': tile.owner === 1,
                  'tile-empty': tile.owner === undefined,
                  'tile-trap': tile.number === TARGET,
                  'tile-latest': tile.latest,
                }"
                :aria-label="`${tile.number}${tile.owner === undefined ? ', chưa chọn' : ', ' + names[tile.owner]}${tile.number === TARGET ? ', bẫy' : ''}`"
              >
                {{ tile.number }}
              </div>
            </div>
            <p class="mt-4 min-h-5 text-xs text-text-secondary">
              <template v-if="lastMove"
                >{{ names[lastMove.player] }} vừa chọn
                {{
                  lastMove.from === lastMove.to
                    ? lastMove.to
                    : `${lastMove.from} đến ${lastMove.to}`
                }}.</template
              >
              <template v-else>Mỗi lượt chọn thêm 1, 2 hoặc 3 số liên tiếp.</template>
            </p>
          </section>
        </div>

        <section class="border-t border-border-default p-4 sm:p-6">
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2
              role="status"
              class="flex items-center gap-2 font-display text-base font-semibold sm:text-lg"
            >
              <Icon
                :icon="
                  round.winner !== null
                    ? 'lucide:trophy'
                    : botTurn
                      ? 'lucide:loader-circle'
                      : 'lucide:arrow-right'
                "
                class="size-5 text-accent-coral"
                :class="{ 'animate-spin': botTurn }"
              />
              {{ status }}
            </h2>
            <span v-if="round.winner === null" class="hidden text-xs text-text-dim sm:inline"
              >Phím tắt: 1 / 2 / 3</span
            >
          </div>
          <div v-if="round.winner === null" class="grid grid-cols-3 gap-3">
            <button
              v-for="amount in [1, 2, 3]"
              :key="amount"
              type="button"
              class="move-button border border-border-default bg-bg-deep px-2 py-3 text-center disabled:cursor-not-allowed disabled:opacity-35 sm:py-4"
              :disabled="botTurn || round.total + amount > TARGET"
              @click="play(amount)"
            >
              <span class="block font-display text-3xl font-bold">+{{ amount }}</span>
              <span
                class="mt-1 block text-xs"
                :class="
                  round.total + amount === TARGET ? 'text-accent-coral' : 'text-text-secondary'
                "
                >{{
                  round.total + amount > TARGET
                    ? 'Vượt 21'
                    : round.total + amount === TARGET
                      ? 'Chạm bẫy!'
                      : `Đến số ${round.total + amount}`
                }}</span
              >
            </button>
          </div>
          <div v-else>
            <p class="mb-4 text-sm text-text-secondary">
              {{ names[round.winner === 0 ? 1 : 0] }} đã chạm số 21.
              {{
                matchWinner !== null
                  ? 'Trận đấu kết thúc. Làm thêm trận nữa chứ?'
                  : 'Ván tiếp theo sẽ đổi người đi trước.'
              }}
            </p>
            <button
              type="button"
              class="flex min-h-14 w-full items-center justify-center gap-2 bg-accent-coral px-5 py-3 font-display font-semibold text-bg-surface hover:brightness-95"
              @click="matchWinner !== null ? resetMatch() : nextRound()"
            >
              <Icon
                :icon="matchWinner !== null ? 'lucide:rotate-ccw' : 'lucide:arrow-right'"
                class="size-5"
              />
              {{ matchWinner !== null ? 'Chơi trận mới' : 'Ván tiếp theo' }}
            </button>
          </div>
        </section>
      </main>

      <footer
        class="mt-5 flex flex-wrap items-start justify-between gap-4 text-sm text-text-secondary"
      >
        <details class="max-w-xl flex-1">
          <summary class="min-h-11 cursor-pointer py-2 font-semibold">
            Luật chơi trong 10 giây
          </summary>
          <ol class="list-decimal space-y-2 pl-5 leading-6">
            <li>Hai bên luân phiên thêm 1–3 số, bắt đầu từ 0.</li>
            <li>Ai chạm đúng 21 sẽ thua ván. Không được đi quá 21.</li>
            <li>Thắng {{ WIN_TARGET }} ván trước để thắng trận. Người đi trước đổi sau mỗi ván.</li>
            <li>Chế độ hai người: cùng chơi trên một màn hình. Đổi chế độ sẽ bắt đầu trận mới.</li>
          </ol>
        </details>
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 py-2 hover:text-accent-coral"
          @click="resetMatch"
        >
          <Icon icon="lucide:rotate-ccw" class="size-4" /> Chơi lại từ đầu
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.trap-page {
  background-image: radial-gradient(var(--color-border-default) 0.6px, transparent 0.6px);
  background-size: 18px 18px;
}
.mode-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.5rem 0.8rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}
.mode-button.selected {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
}
.score-panel {
  padding: 1rem 1.25rem;
  border-bottom: 3px solid transparent;
}
.score-panel.active {
  border-bottom-color: currentColor;
  background: var(--color-bg-deep);
}
.counter-panel {
  background: linear-gradient(135deg, var(--color-bg-deep), var(--color-bg-surface));
}
.number-tile {
  transition:
    background-color 180ms,
    color 180ms;
}
.tile-empty {
  border-color: var(--color-border-default);
  color: var(--color-text-dim);
  background: var(--color-bg-deep);
}
.tile-one {
  background: var(--color-accent-coral);
  border-color: var(--color-accent-coral);
  color: var(--color-bg-surface);
}
.tile-two {
  background: var(--color-accent-sky);
  border-color: var(--color-accent-sky);
  color: var(--color-bg-surface);
}
.tile-trap {
  border: 2px dashed var(--color-accent-coral);
}
.tile-trap.tile-empty {
  color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
}
.tile-latest {
  box-shadow: inset 0 -3px 0 var(--color-text-primary);
}
.move-button {
  touch-action: manipulation;
}
.move-button:not(:disabled):hover {
  border-color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
}
.move-button:not(:disabled):active {
  transform: translateY(2px);
}
button:focus-visible,
summary:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-accent-sky);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .animate-fade-up,
  .animate-spin {
    animation: none;
  }
  .number-tile {
    transition: none;
  }
}
</style>
