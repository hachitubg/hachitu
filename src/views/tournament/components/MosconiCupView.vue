<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import type { Tournament } from '../types'

const props = defineProps<{
  tournament: Tournament
  editable: boolean
  scoreA: number
  scoreB: number
}>()

const emit = defineEmits<{
  submitResult: [matchId: string, scoreA: number, scoreB: number]
}>()

const editingMatchId = ref<string | null>(null)
const scoreAInput = ref(0)
const scoreBInput = ref(0)
const error = ref('')

const teamA = computed(
  () => props.tournament.mosconiTeams.find((team) => team.id === 'A') ?? { id: 'A', name: 'Đội A' },
)
const teamB = computed(
  () => props.tournament.mosconiTeams.find((team) => team.id === 'B') ?? { id: 'B', name: 'Đội B' },
)

const matches = computed(() =>
  [...props.tournament.matches].sort((a, b) => a.matchIndex - b.matchIndex),
)

function getMatchTypeLabel(matchType: string | undefined): string {
  if (matchType === 'double') return 'Doubles'
  return 'Singles'
}

function openEditor(matchId: string, scoreA: number | null, scoreB: number | null) {
  editingMatchId.value = matchId
  scoreAInput.value = scoreA ?? 0
  scoreBInput.value = scoreB ?? 0
  error.value = ''
}

function cancelEditor() {
  editingMatchId.value = null
  scoreAInput.value = 0
  scoreBInput.value = 0
  error.value = ''
}

function saveMatch(matchId: string) {
  error.value = ''
  if (scoreAInput.value < 0 || scoreBInput.value < 0) {
    error.value = 'Điểm phải lớn hơn hoặc bằng 0.'
    return
  }
  if (scoreAInput.value === scoreBInput.value) {
    error.value = 'Game này không cho phép hòa.'
    return
  }

  emit('submitResult', matchId, scoreAInput.value, scoreBInput.value)
  cancelEditor()
}
</script>

<template>
  <div class="space-y-8">
    <div class="grid gap-4 md:grid-cols-3">
      <div class="border border-border-default bg-bg-surface p-5">
        <p class="text-xs tracking-widest text-text-dim uppercase">Đội A</p>
        <p class="mt-2 font-display text-xl font-bold text-text-primary">{{ teamA.name }}</p>
        <p class="mt-1 text-4xl font-display font-bold text-accent-coral">{{ scoreA }}</p>
      </div>

      <div class="flex items-center justify-center border border-border-default bg-bg-surface p-5">
        <div class="text-center">
          <p class="text-xs tracking-widest text-text-dim uppercase">Format</p>
          <p class="mt-2 font-display text-lg font-bold text-text-primary">Mosconi Custom</p>
          <p class="mt-1 text-sm text-text-secondary">
            20 game cố định, mỗi người 3 trận đơn và 2 trận đôi.
          </p>
        </div>
      </div>

      <div class="border border-border-default bg-bg-surface p-5 text-right">
        <p class="text-xs tracking-widest text-text-dim uppercase">Đội B</p>
        <p class="mt-2 font-display text-xl font-bold text-text-primary">{{ teamB.name }}</p>
        <p class="mt-1 text-4xl font-display font-bold text-accent-sky">{{ scoreB }}</p>
      </div>
    </div>

    <div class="border border-border-default bg-bg-surface p-5 text-sm text-text-secondary">
      Lịch đấu được tạo ngẫu nhiên khi bắt đầu giải. Mỗi game đều đã được gán sẵn người chơi để đảm
      bảo mỗi người đánh đúng 3 trận đơn, 2 trận đôi và có cơ hội chạm đủ toàn bộ đội đối diện.
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <article
        v-for="match in matches"
        :key="match.id"
        class="border border-border-default bg-bg-surface p-4"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <p class="font-display text-sm font-semibold text-text-primary">
              {{ match.label || `Game ${match.matchIndex + 1}` }}
            </p>
            <p class="mt-1 text-xs text-text-dim">{{ getMatchTypeLabel(match.matchType) }}</p>
          </div>
          <span
            class="border px-2 py-1 text-[11px] font-semibold"
            :class="
              match.status === 'done'
                ? 'border-accent-amber/30 text-accent-amber'
                : 'border-border-default text-text-dim'
            "
          >
            {{ match.status === 'done' ? 'Đã nhập kết quả' : 'Chưa nhập kết quả' }}
          </span>
        </div>

        <div v-if="editingMatchId !== match.id" class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-text-dim">{{ teamA.name }}</p>
              <p class="truncate text-sm font-semibold text-text-primary">
                {{ match.displayNameA }}
              </p>
            </div>
            <span
              v-if="match.status === 'done'"
              class="font-display text-lg font-bold text-accent-coral"
            >
              {{ match.scoreA }}
            </span>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-text-dim">{{ teamB.name }}</p>
              <p class="truncate text-sm font-semibold text-text-primary">
                {{ match.displayNameB }}
              </p>
            </div>
            <span
              v-if="match.status === 'done'"
              class="font-display text-lg font-bold text-accent-sky"
            >
              {{ match.scoreB }}
            </span>
          </div>

          <button
            v-if="editable"
            class="inline-flex items-center gap-1.5 text-xs text-accent-sky transition hover:text-accent-sky/80"
            @click="openEditor(match.id, match.scoreA, match.scoreB)"
          >
            <Icon icon="lucide:edit-3" class="size-3.5" />
            {{ match.status === 'done' ? 'Sửa tỉ số' : 'Nhập tỉ số' }}
          </button>
        </div>

        <div v-else class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div>
              <label class="mb-1 block text-xs text-text-dim">{{ teamA.name }}</label>
              <input
                v-model.number="scoreAInput"
                type="number"
                min="0"
                class="w-full border border-border-default bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-coral"
              />
            </div>

            <div class="pt-5 text-center text-sm text-text-dim">VS</div>

            <div>
              <label class="mb-1 block text-xs text-text-dim">{{ teamB.name }}</label>
              <input
                v-model.number="scoreBInput"
                type="number"
                min="0"
                class="w-full border border-border-default bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-sky"
              />
            </div>
          </div>

          <p v-if="error" class="text-xs text-accent-coral">{{ error }}</p>

          <div class="flex gap-2">
            <button
              class="flex-1 border border-accent-coral bg-accent-coral/10 py-2 text-xs font-semibold text-accent-coral transition hover:bg-accent-coral/20"
              @click="saveMatch(match.id)"
            >
              Lưu game
            </button>
            <button
              class="flex-1 border border-border-default py-2 text-xs text-text-dim transition hover:bg-bg-elevated"
              @click="cancelEditor"
            >
              Hủy
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
