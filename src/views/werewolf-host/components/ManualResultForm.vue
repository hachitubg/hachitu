<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TargetPicker from './TargetPicker.vue'
import type { Member, Role, Input } from '../types'
const props = defineProps<{ players: Member[]; roles: Role[]; disabled: boolean }>()
defineEmits<{ confirm: [data: Input]; cancel: [] }>()
const winningTeam = ref<NonNullable<Input['winningTeam']>>('village')
const winners = ref<string[]>([])
watch(
  winningTeam,
  (team) => {
    winners.value =
      team === 'manual'
        ? []
        : props.players
            .filter((p) => props.roles.find((r) => r.id === p.role)?.team === team)
            .map((p) => p.id)
  },
  { immediate: true },
)
const valid = computed(() => winningTeam.value === 'manual' || winners.value.length > 0)
function toggle(id: string) {
  winners.value = winners.value.includes(id)
    ? winners.value.filter((v) => v !== id)
    : [...winners.value, id]
}
</script>
<template>
  <div class="manual-result-form">
    <label for="manual-winning-team">Kết quả do quản trò xác nhận</label
    ><select id="manual-winning-team" v-model="winningTeam" :disabled="disabled">
      <option value="village">Phe Dân làng thắng</option>
      <option value="werewolf">Phe Sói thắng</option>
      <option value="vampire">Phe Ma cà rồng thắng</option>
      <option value="independent">Thắng riêng / kết quả đặc biệt</option>
      <option value="manual">Kết thúc · Không tính thắng thua</option>
    </select>
    <p>
      Danh sách dưới đây mới là người được cộng thắng. Hãy điều chỉnh theo luật ngoài bàn chơi, kể
      cả người đã chết hoặc đã đổi phe. App không tự suy luận điều kiện thắng của lá bài.
    </p>
    <TargetPicker
      v-if="winningTeam !== 'manual'"
      :players="players"
      :selected="winners"
      :limit="players.length"
      :disabled="disabled"
      @select="toggle"
    />
    <p class="manual-result-note">
      Sau xác nhận, tất cả máy sẽ thấy vai trò và toàn bộ diễn biến. Kết quả không thể ghi lại lần
      hai.
    </p>
    <div>
      <button :disabled="disabled" @click="$emit('cancel')">Tiếp tục chơi</button
      ><button
        class="ww-primary"
        :disabled="disabled || !valid"
        @click="$emit('confirm', { winningTeam, winnerIds: [...winners] })"
      >
        Xác nhận kết thúc ván
      </button>
    </div>
  </div>
</template>
<style scoped>
.manual-result-form {
  display: grid;
  gap: 14px;
}
.manual-result-form label {
  font-size: 12px;
}
.manual-result-form select {
  width: 100%;
  min-height: 46px;
  padding: 10px;
  font-size: 16px;
  background: var(--color-bg-deep);
  border: 1px solid var(--color-border-default);
  color: var(--color-text-primary);
}
.manual-result-form p {
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin: 0;
}
.manual-result-note {
  padding: 12px;
  background: var(--color-bg-elevated);
}
.manual-result-form > div:last-child {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.manual-result-form button {
  min-height: 48px;
  padding: 12px;
  font-size: 12px;
  border: 1px solid var(--color-border-default);
}
</style>
