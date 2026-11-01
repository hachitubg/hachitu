<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import PlayerAvatar from './PlayerAvatar.vue'
import TargetPicker from './TargetPicker.vue'
import type { RoomState, Role, Input } from '../types'
const props = defineProps<{ state: RoomState; roles: Role[]; locked: boolean }>()
const emit = defineEmits<{ command: [action: string, input: Input]; finish: [] }>()
const people = computed(() => props.state.members.filter((p) => !p.host))
const stage = computed(() => props.state.manualStage || 'ready')
const pending = ref<'dawn' | 'execute' | 'revive' | null>(null)
const selected = ref<string[]>([])
const candidates = computed(() =>
  people.value.filter((p) => (pending.value === 'revive' ? !p.alive : p.alive)),
)
const limit = computed(() => (pending.value === 'dawn' ? candidates.value.length : 1))
const roleName = (id: string | null) =>
  props.roles.find((r) => r.id === id)?.name_vi || 'Chưa nhận bài'
const stageTitle = computed(() =>
  stage.value === 'night'
    ? `Đêm ${props.state.round}`
    : stage.value === 'day'
      ? `Ngày ${props.state.round}`
      : 'Cả làng đã nhận bài',
)
watch(
  () => props.state.revision,
  () => {
    pending.value = null
    selected.value = []
  },
)
function open(value: typeof pending.value) {
  pending.value = value
  selected.value = []
}
function select(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((v) => v !== id)
    : limit.value === 1
      ? [id]
      : [...selected.value, id]
}
function confirm() {
  if (pending.value)
    emit(
      'command',
      `manual-${pending.value === 'dawn' ? 'dawn' : pending.value === 'execute' ? 'execute' : 'revive'}`,
      { targets: [...selected.value] },
    )
}
</script>
<template>
  <section class="manual-board">
    <div class="manual-stage" :class="{ night: stage === 'night' }">
      <Icon :icon="stage === 'night' ? 'lucide:moon-star' : 'lucide:sunrise'" />
      <div>
        <span>QUẢN TRÒ ĐIỀU PHỐI</span>
        <h2>{{ stageTitle }}</h2>
        <p>
          Bạn quyết định diễn biến ngoài bàn chơi. App ghi nhận và đồng bộ, không tự xử lý kỹ năng.
        </p>
      </div>
      <strong
        >{{ people.filter((p) => p.alive).length }}/{{ people.length
        }}<small>còn sống</small></strong
      >
    </div>
    <div class="manual-actions" v-if="!pending">
      <button
        v-if="stage !== 'night'"
        class="ww-primary"
        :disabled="locked"
        @click="$emit('command', 'manual-night', {})"
      >
        <Icon icon="lucide:moon" />Bắt đầu đêm {{ state.round + 1 }}
      </button>
      <button v-else class="ww-primary" :disabled="locked" @click="open('dawn')">
        <Icon icon="lucide:sunrise" />Công bố người chết trong đêm
      </button>
      <button
        v-if="stage === 'day'"
        :disabled="locked || !people.some((p) => p.alive)"
        @click="open('execute')"
      >
        <Icon icon="lucide:gavel" />Ghi người bị treo cổ
      </button>
      <button :disabled="locked || !people.some((p) => !p.alive)" @click="open('revive')">
        <Icon icon="lucide:undo-2" />Sửa nhầm · Khôi phục
      </button>
      <button :disabled="locked" @click="$emit('finish')">
        <Icon icon="lucide:flag" />Kết thúc · Chọn phe thắng
      </button>
    </div>
    <section v-if="pending" class="manual-selection">
      <h3>
        {{
          pending === 'dawn'
            ? 'Ai bị loại trong đêm này?'
            : pending === 'execute'
              ? 'Ai bị treo cổ?'
              : 'Khôi phục người chơi nào?'
        }}
      </h3>
      <p>
        {{
          pending === 'dawn'
            ? 'Chọn mọi người đã chết. Nếu không ai chết, để trống rồi xác nhận bình minh.'
            : 'Chọn đúng một người và xác nhận. Thay đổi sẽ được ghi vào lịch sử.'
        }}
      </p>
      <TargetPicker
        :players="candidates"
        :selected="selected"
        :limit="limit"
        :disabled="locked"
        @select="select"
      />
      <div class="manual-confirm">
        <button :disabled="locked" @click="open(null)">Quay lại</button
        ><button
          class="ww-primary"
          :disabled="locked || (pending !== 'dawn' && selected.length !== 1)"
          @click="confirm"
        >
          {{
            pending === 'dawn' && !selected.length
              ? 'Bình minh · Không ai chết'
              : 'Xác nhận kết quả'
          }}<Icon icon="lucide:check" />
        </button>
      </div>
    </section>
    <h3 class="manual-heading">Lá bài quanh bàn <span>Chỉ quản trò nhìn thấy</span></h3>
    <div class="manual-roster">
      <article v-for="p in people" :key="p.id" :class="{ eliminated: !p.alive }">
        <PlayerAvatar :value="p.avatar" :name="p.name" class="avatar" />
        <div>
          <strong>{{ p.name }}</strong
          ><span>{{ roleName(p.role) }}</span
          ><small>{{
            p.alive
              ? p.connected
                ? 'Còn sống'
                : 'Còn sống · Mất kết nối'
              : p.manualDeathReason || 'Đã bị loại'
          }}</small>
        </div>
        <Icon :icon="p.alive ? 'lucide:heart' : 'lucide:skull'" />
      </article>
    </div>
    <details class="manual-journal">
      <summary>
        <Icon icon="lucide:scroll-text" />Diễn biến ván · {{ state.logs.length }} sự kiện
      </summary>
      <ol>
        <li v-for="(event, i) in [...state.logs].reverse()" :key="i">
          <small>{{ event.round ? `Ngày / Đêm ${event.round}` : 'Chia bài' }}</small
          >{{ event.message }}
        </li>
      </ol>
    </details>
  </section>
</template>
<style scoped>
.manual-board {
  display: grid;
  gap: 20px;
}
.manual-stage {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  border-top: 3px solid var(--color-accent-amber);
}
.manual-stage.night {
  border-top-color: var(--color-accent-sky);
}
.manual-stage > svg {
  width: 30px;
  height: 30px;
  color: var(--color-accent-amber);
  flex-shrink: 0;
}
.manual-stage > div {
  flex: 1;
}
.manual-stage span {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--color-text-dim);
}
.manual-stage h2 {
  margin: 8px 0;
  font-size: 24px;
}
.manual-stage p {
  font-size: 11px;
  line-height: 1.6;
  margin: 0;
  color: var(--color-text-secondary);
}
.manual-stage > strong {
  font-size: 24px;
  text-align: right;
}
.manual-stage small {
  display: block;
  font-size: 10px;
  font-weight: 400;
  color: var(--color-text-secondary);
}
.manual-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.manual-actions button,
.manual-confirm button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  min-height: 48px;
  border: 1px solid var(--color-border-default);
  font-size: 12px;
}
.manual-actions svg,
.manual-confirm svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.manual-actions button:first-child {
  grid-column: 1/-1;
}
.manual-selection {
  border: 1px solid var(--color-accent-amber);
  padding: 16px;
}
.manual-selection h3 {
  font-size: 18px;
  margin: 0 0 10px;
}
.manual-selection p {
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}
.manual-confirm {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.manual-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  margin: 0;
  gap: 8px;
}
.manual-heading span {
  font-size: 9px;
  font-weight: 400;
  color: var(--color-text-dim);
}
.manual-roster {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.manual-roster article {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--color-border-default);
  padding: 12px;
}
.manual-roster .avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}
.manual-roster article > div {
  flex: 1;
  min-width: 0;
}
.manual-roster strong,
.manual-roster span,
.manual-roster small {
  display: block;
  overflow-wrap: anywhere;
}
.manual-roster strong {
  font-size: 13px;
}
.manual-roster span {
  font-size: 11px;
  color: var(--color-accent-coral);
  margin-top: 5px;
}
.manual-roster small {
  font-size: 10px;
  color: var(--color-text-dim);
  margin-top: 5px;
}
.manual-roster article > svg {
  width: 16px;
  height: 16px;
  color: var(--color-accent-coral);
  flex-shrink: 0;
}
.manual-roster .eliminated {
  background: var(--color-bg-deep);
}
.eliminated .avatar {
  filter: grayscale(1);
}
.manual-journal {
  border-top: 1px solid var(--color-border-default);
  padding-top: 12px;
}
.manual-journal summary {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-height: 44px;
  cursor: pointer;
}
.manual-journal svg {
  width: 17px;
  height: 17px;
}
.manual-journal ol {
  padding: 0;
  list-style: none;
  max-height: 360px;
  overflow: auto;
  scrollbar-width: thin;
}
.manual-journal li {
  font-size: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-default);
  line-height: 1.6;
}
.manual-journal small {
  display: block;
  color: var(--color-text-dim);
  font-size: 9px;
}
@media (max-width: 480px) {
  .manual-stage {
    padding: 14px;
    gap: 10px;
  }
  .manual-stage h2 {
    font-size: 21px;
  }
  .manual-stage > svg {
    display: none;
  }
  .manual-roster article {
    padding: 10px;
    gap: 7px;
  }
  .manual-roster .avatar {
    width: 32px;
    height: 32px;
  }
  .manual-roster article > svg {
    display: none;
  }
  .manual-confirm {
    position: sticky;
    bottom: 0;
    background: var(--color-bg-surface);
    padding: 8px 0;
  }
  .manual-confirm button {
    flex: 1;
  }
  .manual-actions button {
    font-size: 11px;
  }
  .manual-heading span {
    max-width: 100px;
    text-align: right;
  }
}
</style>
