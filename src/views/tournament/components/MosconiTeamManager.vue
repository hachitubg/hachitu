<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import type { MosconiTeam, Participant } from '../types'

const props = defineProps<{
  participants: Participant[]
  teams: MosconiTeam[]
}>()

const emit = defineEmits<{
  add: [teamId: 'A' | 'B', name: string]
  remove: [id: string]
  edit: [id: string, name: string]
  renameTeam: [teamId: 'A' | 'B', name: string]
}>()

const inputA = ref('')
const inputB = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')

const teamA = computed(() => props.teams.find((team) => team.id === 'A'))
const teamB = computed(() => props.teams.find((team) => team.id === 'B'))

const playersA = computed(() =>
  props.participants.filter((participant) => participant.teamId === 'A'),
)
const playersB = computed(() =>
  props.participants.filter((participant) => participant.teamId === 'B'),
)

function addPlayer(teamId: 'A' | 'B') {
  const source = teamId === 'A' ? inputA : inputB
  if (!source.value.trim()) return
  emit('add', teamId, source.value)
  source.value = ''
}

function startEdit(participant: Participant) {
  editingId.value = participant.id
  editingName.value = participant.name
}

function confirmEdit() {
  if (!editingId.value || !editingName.value.trim()) return
  emit('edit', editingId.value, editingName.value)
  editingId.value = null
  editingName.value = ''
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-2">
      <span class="font-display text-sm tracking-widest text-accent-amber">//</span>
      <h3 class="font-display text-lg font-semibold text-text-primary">Đội hình Mosconi Cup</h3>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <section class="border border-border-default bg-bg-surface p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <input
            :value="teamA?.name ?? ''"
            type="text"
            class="w-full border border-border-default bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-coral"
            placeholder="Tên đội A"
            @input="emit('renameTeam', 'A', ($event.target as HTMLInputElement).value || 'Đội A')"
          />
          <span class="font-display text-xs text-text-dim">{{ playersA.length }}/5</span>
        </div>

        <div class="mb-4 flex gap-2">
          <input
            v-model="inputA"
            type="text"
            placeholder="Thêm người chơi đội A"
            class="flex-1 border border-border-default bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-coral"
            @keydown.enter.prevent="addPlayer('A')"
          />
          <button
            class="inline-flex items-center gap-1.5 border border-accent-coral bg-accent-coral/10 px-4 py-2 text-xs font-semibold text-accent-coral transition hover:bg-accent-coral/20"
            @click="addPlayer('A')"
          >
            <Icon icon="lucide:plus" class="size-3.5" />
            Thêm
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="(participant, index) in playersA"
            :key="participant.id"
            class="flex items-center gap-3 border border-border-default bg-bg-elevated px-4 py-2.5"
          >
            <span class="w-5 text-xs text-text-dim">{{ index + 1 }}</span>
            <template v-if="editingId === participant.id">
              <input
                v-model="editingName"
                class="flex-1 border border-accent-coral bg-bg-deep px-3 py-1.5 text-sm text-text-primary outline-none"
                @keydown.enter.prevent="confirmEdit"
                @keydown.escape="cancelEdit"
              />
              <button
                class="text-accent-sky transition hover:text-accent-sky/80"
                @click="confirmEdit"
              >
                <Icon icon="lucide:check" class="size-4" />
              </button>
              <button class="text-text-dim transition hover:text-text-primary" @click="cancelEdit">
                <Icon icon="lucide:x" class="size-4" />
              </button>
            </template>
            <template v-else>
              <span class="flex-1 text-sm text-text-primary">{{ participant.name }}</span>
              <button
                class="text-text-dim transition hover:text-accent-sky"
                title="Sửa tên"
                @click="startEdit(participant)"
              >
                <Icon icon="lucide:pencil" class="size-3.5" />
              </button>
              <button
                class="text-text-dim transition hover:text-accent-coral"
                title="Xóa người chơi"
                @click="emit('remove', participant.id)"
              >
                <Icon icon="lucide:trash-2" class="size-3.5" />
              </button>
            </template>
          </div>
          <div
            v-if="playersA.length === 0"
            class="border border-dashed border-border-default px-4 py-5 text-center text-sm text-text-dim"
          >
            Chưa có người chơi ở đội này.
          </div>
        </div>
      </section>

      <section class="border border-border-default bg-bg-surface p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <input
            :value="teamB?.name ?? ''"
            type="text"
            class="w-full border border-border-default bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-sky"
            placeholder="Tên đội B"
            @input="emit('renameTeam', 'B', ($event.target as HTMLInputElement).value || 'Đội B')"
          />
          <span class="font-display text-xs text-text-dim">{{ playersB.length }}/5</span>
        </div>

        <div class="mb-4 flex gap-2">
          <input
            v-model="inputB"
            type="text"
            placeholder="Thêm người chơi đội B"
            class="flex-1 border border-border-default bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent-sky"
            @keydown.enter.prevent="addPlayer('B')"
          />
          <button
            class="inline-flex items-center gap-1.5 border border-accent-sky bg-accent-sky/10 px-4 py-2 text-xs font-semibold text-accent-sky transition hover:bg-accent-sky/20"
            @click="addPlayer('B')"
          >
            <Icon icon="lucide:plus" class="size-3.5" />
            Thêm
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="(participant, index) in playersB"
            :key="participant.id"
            class="flex items-center gap-3 border border-border-default bg-bg-elevated px-4 py-2.5"
          >
            <span class="w-5 text-xs text-text-dim">{{ index + 1 }}</span>
            <template v-if="editingId === participant.id">
              <input
                v-model="editingName"
                class="flex-1 border border-accent-sky bg-bg-deep px-3 py-1.5 text-sm text-text-primary outline-none"
                @keydown.enter.prevent="confirmEdit"
                @keydown.escape="cancelEdit"
              />
              <button
                class="text-accent-sky transition hover:text-accent-sky/80"
                @click="confirmEdit"
              >
                <Icon icon="lucide:check" class="size-4" />
              </button>
              <button class="text-text-dim transition hover:text-text-primary" @click="cancelEdit">
                <Icon icon="lucide:x" class="size-4" />
              </button>
            </template>
            <template v-else>
              <span class="flex-1 text-sm text-text-primary">{{ participant.name }}</span>
              <button
                class="text-text-dim transition hover:text-accent-sky"
                title="Sửa tên"
                @click="startEdit(participant)"
              >
                <Icon icon="lucide:pencil" class="size-3.5" />
              </button>
              <button
                class="text-text-dim transition hover:text-accent-coral"
                title="Xóa người chơi"
                @click="emit('remove', participant.id)"
              >
                <Icon icon="lucide:trash-2" class="size-3.5" />
              </button>
            </template>
          </div>
          <div
            v-if="playersB.length === 0"
            class="border border-dashed border-border-default px-4 py-5 text-center text-sm text-text-dim"
          >
            Chưa có người chơi ở đội này.
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
