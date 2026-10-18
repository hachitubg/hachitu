<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import RoleCard from './RoleCard.vue'
import type { Role } from '../types'
import { canReplaceCard, deckSlots, replaceCard } from '../utils/deck-editor'
const props = defineProps<{
  deck: string[]
  count: number
  roles: Role[]
  revision: number
  disabled: boolean
  drunkRole?: string | null
  readonly?: boolean
  cardsOnly?: boolean
}>()
const emit = defineEmits<{ suggest: []; save: [deck: string[], drunkRole?: string] }>()
const draft = ref(deckSlots(props.deck, props.count))
const hiddenRole = ref(props.drunkRole || 'villager')
const reservedOptions = computed(() => props.roles.filter((role) => role.drunkEligible))
const reserveAvailable = (role: Role) =>
  draft.value.filter((id) => id === role.id).length < role.quantity
const reserveValid = computed(
  () =>
    props.cardsOnly ||
    !draft.value.includes('drunk') ||
    reservedOptions.value.some((role) => role.id === hiddenRole.value && reserveAvailable(role)),
)
const replacing = ref<number | null>(null)
const search = ref('')
const deferred = ref(false)
const roleById = (id: string | null) => props.roles.find((role) => role.id === id)
const filled = computed(() => draft.value.filter(Boolean).length)
const score = computed(() =>
  draft.value.reduce((sum, id) => sum + (roleById(id)?.balance_points || 0), 0),
)
const choices = computed(() =>
  props.roles.filter(
    (role) =>
      role.team !== 'utility' &&
      (props.cardsOnly || deferred.value || role.enabled) &&
      role.name_vi.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
  ),
)
watch([() => props.revision, () => props.count], () => {
  draft.value = deckSlots(props.deck, props.count)
  replacing.value = null
  hiddenRole.value = props.drunkRole || 'villager'
})
function chooseSlot(index: number) {
  if (props.readonly || props.disabled) return
  replacing.value = index
  search.value = ''
  deferred.value = false
}
function pick(role: Role) {
  if (
    replacing.value === null ||
    props.readonly ||
    props.disabled ||
    !canReplaceCard(draft.value, replacing.value, role, props.cardsOnly)
  )
    return
  draft.value = replaceCard(draft.value, replacing.value, role, props.cardsOnly)
  replacing.value = null
}
function save() {
  if (props.readonly) return
  if (filled.value !== props.count || props.count < 5 || props.disabled || !reserveValid.value)
    return
  const cards = draft.value.filter((id): id is string => id !== null)
  if (!props.cardsOnly && cards.includes('drunk')) emit('save', cards, hiddenRole.value)
  else emit('save', cards)
}
</script>
<template>
  <section class="deck-editor">
    <div class="deck-status">
      <b>{{ filled }}/{{ count }} lá</b><span>Điểm {{ score > 0 ? '+' : '' }}{{ score }}</span
      ><button v-if="!readonly" :disabled="disabled || count < 5" @click="emit('suggest')">
        <Icon icon="lucide:shuffle" />Gợi ý lại
      </button>
    </div>
    <template v-if="replacing === null">
      <p class="fineprint">
        {{
          readonly
            ? 'Bộ bài quản trò đã chọn. Bấm Chức năng để xem chi tiết từng lá.'
            : 'Bấm vào lá bài để đổi lá khác. Bấm Chức năng để xem chi tiết.'
        }}
      </p>
      <p v-if="!count" class="journal-empty">Mời người chơi vào phòng trước khi chọn bộ bài.</p>
      <div class="selected-deck-grid" aria-label="Các lá bài đang chọn">
        <article v-for="(id, index) in draft" :key="index" class="selected-deck-entry">
          <button
            class="selected-deck-slot"
            :class="{ 'readonly-card': readonly }"
            :disabled="disabled || readonly"
            :aria-label="`${readonly ? 'Lá' : 'Đổi lá'} ${index + 1}: ${roleById(id)?.name_vi || 'Chưa chọn'}`"
            @click="chooseSlot(index)"
          >
            <span class="slot-number">{{ String(index + 1).padStart(2, '0') }}</span
            ><RoleCard v-if="id" :role="roleById(id)" compact /><span v-else class="empty-deck-card"
              ><Icon icon="lucide:plus" /><strong>Chọn lá bài</strong></span
            >
          </button>
          <details v-if="id" class="selected-card-ability">
            <summary>Chức năng</summary>
            <p>{{ roleById(id)?.guide_vi || roleById(id)?.ability_vi }}</p>
            <p v-if="roleById(id)?.win_condition_vi">
              <strong>Thắng khi:</strong> {{ roleById(id)?.win_condition_vi }}
            </p>
          </details>
        </article>
      </div>
      <div v-if="!readonly && !cardsOnly && draft.includes('drunk')" class="drunk-reserve">
        <label for="drunk-reserve">Lá ẩn cho Kẻ say rượu (quản trò chọn trước ván)</label
        ><select id="drunk-reserve" v-model="hiddenRole" :disabled="disabled">
          <option
            v-for="role in reservedOptions"
            :key="role.id"
            :value="role.id"
            :disabled="!reserveAvailable(role)"
          >
            {{ role.name_vi }}{{ reserveAvailable(role) ? '' : ' · Đã hết lá' }}
          </option>
        </select>
        <p>
          Lá này được lấy từ phần bài còn dư, không tính là một người chơi. Chỉ lộ cho Kẻ say rượu
          khi đêm ba bắt đầu.
        </p>
        <p v-if="!reserveValid">Hãy chọn một lá ẩn còn bản sao trong bộ bài.</p>
      </div>
      <button
        v-if="!readonly"
        class="ww-primary sticky-save"
        :disabled="disabled || filled !== count || count < 5 || !reserveValid"
        @click="save"
      >
        Chốt bộ bài {{ filled }} lá
      </button>
    </template>
    <template v-else>
      <div class="replacement-heading">
        <button @click="replacing = null">
          <Icon icon="lucide:arrow-left" />Về bộ bài đang chọn
        </button>
        <p>
          Thay lá {{ replacing + 1 }} ·
          <strong>{{ roleById(draft[replacing] || null)?.name_vi || 'Chưa chọn' }}</strong>
        </p>
      </div>
      <input v-model="search" placeholder="Tìm tên lá bài…" aria-label="Tìm lá thay thế" /><label
        class="deferred-toggle"
        v-if="!cardsOnly"
        ><input v-model="deferred" type="checkbox" />Xem cả các vai đang tạm hoãn</label
      >
      <div class="deck-grid replacement-grid" aria-label="Chọn lá bài thay thế">
        <article
          v-for="role in choices"
          :key="role.id"
          :class="{ deferred: !role.enabled && !cardsOnly }"
        >
          <button
            class="replacement-card"
            :aria-label="`Chọn ${role.name_vi} thay lá ${replacing + 1}`"
            :disabled="disabled || !canReplaceCard(draft, replacing, role, cardsOnly)"
            @click="pick(role)"
          >
            <RoleCard :role="role" compact /><span>{{
              !role.enabled && !cardsOnly
                ? 'Tạm hoãn'
                : canReplaceCard(draft, replacing, role, cardsOnly)
                  ? 'Chọn lá này'
                  : 'Đã đủ số lá trong bộ'
            }}</span>
          </button>
          <details>
            <summary>Chức năng</summary>
            <p>{{ role.guide_vi || role.ability_vi }}</p>
            <p>{{ role.win_condition_vi }}</p>
            <p v-if="role.id === 'mason'">Cần chọn đủ 2 lá Hội Tam điểm.</p>
          </details>
        </article>
      </div>
      <p v-if="!choices.length" class="journal-empty">Không tìm thấy lá phù hợp.</p>
    </template>
  </section>
</template>
<style scoped>
.selected-deck-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin: 20px 0;
}
.drunk-reserve {
  margin: 16px 0;
  padding: 14px;
  background: var(--color-bg-elevated);
  font-size: 12px;
  line-height: 1.7;
}
.drunk-reserve label {
  display: block;
  font-weight: 600;
}
.drunk-reserve select {
  width: 100%;
  min-height: 44px;
  padding: 8px;
  margin: 8px 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  font-size: 16px;
}
.drunk-reserve p {
  margin: 4px 0;
  font-size: 11px;
}
.selected-deck-slot {
  display: block !important;
  width: 100%;
  position: relative;
  padding: 0 !important;
  border: 0 !important;
  text-align: left !important;
  min-width: 0;
  align-self: start;
}
.selected-deck-entry {
  min-width: 0;
  align-self: start;
}
.readonly-card:disabled {
  opacity: 1;
  cursor: default;
}
.selected-card-ability {
  border: 1px solid var(--color-border-default);
  border-top: 0;
  padding: 12px;
  background: var(--color-bg-surface);
  font-size: 11px;
  line-height: 1.75;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.selected-card-ability summary {
  display: block;
  color: var(--color-accent-amber);
  font-size: 10px;
  cursor: pointer;
}
.selected-card-ability p {
  margin: 8px 0 0;
}
.slot-number {
  position: absolute;
  z-index: 1;
  top: 8px;
  left: 8px;
  background: var(--color-bg-surface);
  color: var(--color-accent-coral);
  font-family: var(--font-display);
  font-size: 11px;
  padding: 3px 7px;
}
.empty-deck-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3/4.2;
  border: 1px dashed var(--color-border-default);
  background: var(--color-bg-deep);
  color: var(--color-text-dim);
  font-size: 12px;
}
.replacement-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 14px 0;
  flex-wrap: wrap;
}
.replacement-heading > p {
  font-size: 12px;
}
.replacement-card {
  display: block !important;
  width: 100%;
  padding: 0 !important;
  border: 0 !important;
  text-align: left !important;
}
.replacement-card > span {
  display: block;
  text-align: center;
  font-size: 10px;
  padding: 10px 4px;
  color: var(--color-accent-coral);
  border: 1px solid var(--color-border-default);
}
.replacement-grid article {
  min-width: 0;
}
.journal-empty {
  font-size: 12px;
  padding: 20px;
  text-align: center;
  color: var(--color-text-dim);
}
@media (max-width: 760px) {
  .selected-deck-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}
</style>
