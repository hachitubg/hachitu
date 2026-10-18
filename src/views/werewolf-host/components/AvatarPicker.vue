<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import PlayerAvatar from './PlayerAvatar.vue'
import { avatarStyles, randomAvatar } from '../utils/avatars'
import type { AvatarStyle } from '../utils/avatars'
const model = defineModel<string>({ required: true })
defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ upload: [] }>()
const style = ref<AvatarStyle>('adventurer')
const options = ref([model.value, ...Array.from({ length: 7 }, () => randomAvatar(style.value))])
function changeStyle(value: AvatarStyle) {
  style.value = value
  options.value = Array.from({ length: 8 }, () => randomAvatar(value))
  model.value = options.value[0]!
}
function randomize() {
  const next = randomAvatar(style.value)
  options.value = [next, ...options.value.slice(0, 7)]
  model.value = next
}
</script>
<template>
  <section class="new-avatar-picker" aria-label="Chọn ảnh đại diện">
    <div class="avatar-current">
      <PlayerAvatar :value="model" />
      <div><strong>Chân dung của bạn</strong><small>Chọn mẫu hoặc tạo diện mạo mới</small></div>
      <button type="button" :disabled="busy" @click="randomize">
        <Icon icon="lucide:shuffle" />Ngẫu nhiên
      </button>
    </div>
    <div class="avatar-style-tabs" aria-label="Phong cách avatar">
      <button
        v-for="item in avatarStyles"
        :key="item.id"
        type="button"
        :aria-pressed="style === item.id"
        :disabled="busy"
        @click="changeStyle(item.id)"
      >
        {{ item.name }}
      </button>
    </div>
    <div class="new-avatar-grid">
      <button
        v-for="(value, index) in options"
        :key="value"
        type="button"
        :aria-label="`Chọn avatar ${index + 1}`"
        :aria-pressed="model === value"
        :disabled="busy"
        @click="model = value"
      >
        <PlayerAvatar :value="value" /><Icon v-if="model === value" icon="lucide:check" />
      </button>
    </div>
    <div class="avatar-picker-footer">
      <button type="button" :disabled="busy" @click="emit('upload')">
        <Icon icon="lucide:image-plus" />{{ busy ? 'Đang đọc ảnh…' : 'Dùng ảnh của tôi' }}</button
      ><a href="https://www.dicebear.com/licenses/" target="_blank" rel="noopener noreferrer"
        >Avatar: DiceBear · Tác giả &amp; giấy phép</a
      >
    </div>
  </section>
</template>
<style scoped>
.new-avatar-picker {
  margin-top: 12px;
}
.avatar-current {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-current > .player-avatar {
  width: 54px;
  height: 54px;
  border: 1px solid var(--color-border-default);
}
.avatar-current > div {
  flex: 1;
  min-width: 0;
}
.avatar-current strong {
  display: block;
  font-size: 12px;
}
.avatar-current small {
  display: block;
  font-size: 9px;
  line-height: 1.5;
  color: var(--color-text-dim);
  margin-top: 4px;
}
.avatar-current > button {
  padding: 8px;
  font-size: 10px;
}
.avatar-style-tabs {
  display: flex;
  gap: 5px;
  overflow: auto;
  margin: 12px 0;
}
.avatar-style-tabs button {
  white-space: nowrap;
  font-size: 10px;
  min-height: 36px;
  padding: 6px 10px;
}
.new-avatar-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}
.new-avatar-grid > button {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
}
.new-avatar-grid .player-avatar {
  width: 100%;
  height: 100%;
}
.new-avatar-grid > button > svg {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: var(--color-accent-coral);
  color: var(--color-bg-surface);
  width: 20px;
  height: 20px;
  padding: 3px;
}
.avatar-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}
.avatar-picker-footer a {
  font-size: 9px;
  color: var(--color-text-dim);
  line-height: 1.6;
  max-width: 145px;
  text-align: right;
}
.avatar-picker-footer > button {
  font-size: 10px;
}
</style>
