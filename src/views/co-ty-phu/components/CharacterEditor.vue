<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import CharacterSprite from './CharacterSprite.vue'
import { randomCharacter, characterKey } from '../character-config.mjs'
import type { CharacterConfig } from '../character-config.mjs'
import { useCharacterRenderer } from '../composables/useCharacterRenderer'
import type { Direction } from '../composables/useCharacterRenderer'
const model = defineModel<CharacterConfig>({ required: true })
const props = defineProps<{ disabled?: boolean; name?: string; taken?: CharacterConfig[] }>()
const { failed, retry } = useCharacterRenderer()
const direction = ref<Direction>('SE')
const walking = ref(false)
const directions: Direction[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
const controls: { key: keyof CharacterConfig; label: string; options: string[] }[] = [
  {
    key: 'hairStyle',
    label: 'Kiểu tóc',
    options: [
      'Tóc ngắn',
      'Tóc dựng',
      'Tóc dài',
      'Đầu trọc',
      'Mohawk',
      'Tóc xoăn',
      'Đuôi ngựa',
      'Tóc húi',
      'Afro',
      'Tóc búi',
      'Mái lệch',
    ],
  },
  {
    key: 'hair',
    label: 'Màu tóc',
    options: ['Đen nâu', 'Nâu đậm', 'Nâu vàng', 'Vàng', 'Đỏ', 'Tím', 'Xanh đen', 'Bạc'],
  },
  { key: 'skin', label: 'Màu da', options: ['Sáng', 'Ấm', 'Nâu', 'Đậm'] },
  {
    key: 'face',
    label: 'Biểu cảm',
    options: [
      'Bình thản',
      'Mỉm cười',
      'Vui vẻ',
      'Tự tin',
      'Nháy mắt',
      'Ngạc nhiên',
      'Nghiêm nghị',
      'Buồn ngủ',
    ],
  },
  {
    key: 'shirtPattern',
    label: 'Kiểu áo',
    options: ['Trơn', 'Kẻ sọc', 'Cổ chữ V', 'Có cổ', 'Chấm bi', 'Chữ V kép'],
  },
  {
    key: 'shirt',
    label: 'Màu áo',
    options: ['Xanh dương', 'Đỏ', 'Xanh lá', 'Vàng', 'Tím', 'Xanh ngọc', 'Cam', 'Tím sáng'],
  },
  {
    key: 'pants',
    label: 'Màu quần',
    options: ['Xanh đen', 'Xám xanh', 'Đen', 'Xám tím', 'Than', 'Nâu tím', 'Rêu', 'Đen xám'],
  },
  { key: 'shoes', label: 'Giày', options: ['Đen', 'Trắng kem', 'Nâu', 'Đỏ', 'Xanh', 'Vàng'] },
  {
    key: 'accessory',
    label: 'Phụ kiện',
    options: [
      'Không',
      'Kính',
      'Kính râm',
      'Mũ',
      'Băng đầu',
      'Khuyên tai',
      'Khẩu trang',
      'Râu',
      'Bịt mắt',
    ],
  },
  {
    key: 'accessoryColor',
    label: 'Màu phụ kiện',
    options: ['Đỏ', 'Đen', 'Vàng', 'Trắng', 'Xanh', 'Rêu'],
  },
]
function change(key: keyof CharacterConfig, event: Event) {
  model.value = { ...model.value, [key]: Number((event.target as HTMLSelectElement).value) }
}
function rotate(step: number) {
  direction.value = directions[(directions.indexOf(direction.value) + step + 8) % 8]!
}
function randomize() {
  const occupied = new Set([characterKey(model.value), ...(props.taken || []).map(characterKey)])
  let next = randomCharacter()
  while (occupied.has(characterKey(next))) next = randomCharacter()
  model.value = next
}
</script>
<template>
  <section class="character-editor" aria-label="Tùy chỉnh nhân vật 2D">
    <div class="character-editor-heading">
      <div><strong>Nhân vật của bạn</strong><small>Tóc, trang phục và cá tính riêng.</small></div>
      <button type="button" :disabled="disabled" @click="randomize">
        <Icon icon="lucide:shuffle" />Ngẫu nhiên
      </button>
    </div>
    <div class="character-stage">
      <span class="stage-lines" aria-hidden="true" /><CharacterSprite
        :character="model"
        :direction="direction"
        :animate="walking"
        explicit-motion
        :name="name"
      /><strong>{{ name?.trim() || 'Đây là bạn' }}</strong
      ><span>Nhân vật này sẽ đồng hành trên bàn cờ</span>
    </div>
    <div class="character-preview-actions">
      <button
        type="button"
        aria-label="Xoay nhân vật sang trái"
        :disabled="disabled"
        @click="rotate(-1)"
      >
        <Icon icon="lucide:rotate-ccw" /></button
      ><button
        type="button"
        :aria-pressed="walking"
        :disabled="disabled"
        @click="walking = !walking"
      >
        <Icon :icon="walking ? 'lucide:pause' : 'lucide:footprints'" />{{
          walking ? 'Dừng thử' : 'Thử đi bộ'
        }}</button
      ><button
        type="button"
        aria-label="Xoay nhân vật sang phải"
        :disabled="disabled"
        @click="rotate(1)"
      >
        <Icon icon="lucide:rotate-cw" />
      </button>
    </div>
    <button v-if="failed" type="button" class="wide" @click="retry">Tải lại nhân vật</button>
    <details class="character-customize">
      <summary>
        <Icon icon="lucide:sliders-horizontal" />Tùy chỉnh ngoại hình<Icon
          icon="lucide:chevron-down"
        />
      </summary>
      <div class="character-controls">
        <label v-for="c in controls" :key="c.key"
          >{{ c.label
          }}<select
            :value="model[c.key]"
            :disabled="
              disabled ||
              (c.key === 'accessoryColor' && ![3, 4, 5].includes(model.accessory)) ||
              (c.key === 'hair' && model.hairStyle === 3)
            "
            @change="change(c.key, $event)"
          >
            <option v-for="(option, i) in c.options" :key="i" :value="i">{{ option }}</option>
          </select></label
        >
      </div>
    </details>
    <p class="character-hint">
      Random tạo diện mạo mới. Ngoại hình trùng trong phòng sẽ cần đổi trước khi vào.
    </p>
    <a
      class="character-credit"
      href="/co-ty-phu/vendor/LICENSE.txt"
      target="_blank"
      rel="noopener noreferrer"
      >Nhân vật: 2d_chars · MIT</a
    >
  </section>
</template>
<style scoped>
.character-editor {
  margin-top: 18px;
}
.character-editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.character-editor-heading strong {
  font-size: 12px;
}
.character-editor-heading small {
  display: block;
  font-size: 10px;
  color: var(--color-text-dim);
  margin-top: 4px;
}
.character-editor-heading button {
  font-size: 11px;
  padding: 8px 10px;
}
.character-stage {
  margin-top: 12px;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px 14px;
  background:
    radial-gradient(ellipse at 50% 90%, var(--color-bg-elevated), transparent 70%),
    var(--color-bg-deep);
  border: 1px solid var(--color-border-default);
}
.character-stage .character-sprite {
  width: 120px;
  height: 180px;
  z-index: 1;
}
.stage-lines {
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0.35;
  background:
    repeating-linear-gradient(90deg, transparent 0 39px, var(--color-border-default) 40px),
    repeating-linear-gradient(0deg, transparent 0 39px, var(--color-border-default) 40px);
}
.character-stage strong {
  font-family: var(--font-display);
  font-size: 15px;
  overflow-wrap: anywhere;
  text-align: center;
}
.character-stage > span:last-child {
  font-size: 9px;
  margin-top: 5px;
  color: var(--color-text-dim);
}
.character-preview-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 10px 0;
}
.character-preview-actions > button {
  font-size: 11px;
}
.character-customize > summary {
  display: flex;
  gap: 8px;
  align-items: center;
  border: 1px solid var(--color-border-default);
  padding: 12px !important;
}
.character-customize > summary > svg:last-child {
  margin-left: auto;
}
.character-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}
.character-controls label {
  min-width: 0;
}
.character-hint {
  font-size: 10px !important;
  margin: 10px 0 0;
}
.character-credit {
  font-size: 9px;
  color: var(--color-text-dim);
}
@media (max-width: 400px) {
  .character-stage .character-sprite {
    width: 104px;
    height: 156px;
  }
  .character-editor-heading {
    gap: 6px;
  }
}
</style>
