<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useScroll } from '@vueuse/core'
import { Icon } from '@iconify/vue'
import {
  effectPresets,
  defaultEffects,
  effectGroups,
  normalizeEffectSearch,
} from '../utils/effects'
import type { PhotoEffects, EffectId } from '../utils/effects'
const settings = defineModel<PhotoEffects>({ required: true })
defineProps<{ sharpenOnly?: boolean; loading: boolean; error: string }>()
defineEmits<{ retry: [] }>()
const group = ref('Tất cả')
const search = ref('')
const panel = ref<HTMLElement>()
const { y: scrollY } = useScroll(computed(() => panel.value?.closest('dialog')))
const visible = computed(() =>
  effectPresets.filter(
    (p) =>
      p.id === 'none' ||
      ((group.value === 'Tất cả' || p.group === group.value) &&
        normalizeEffectSearch(p.name + ' ' + p.hint).includes(normalizeEffectSearch(search.value))),
  ),
)
const active = computed(() => effectPresets.find((p) => p.id === settings.value.effect))
const spatial = computed(() =>
  ['miniature', 'lens', 'mono', 'comic', 'swirl', 'bulge', 'pinch', 'bokeh', 'magazine'].includes(
    settings.value.effect,
  ),
)
function choose(id: EffectId) {
  settings.value = {
    ...settings.value,
    effect: id,
    amount: ['negative', 'solarize'].includes(id) ? 100 : 50,
  }
  void nextTick(() => {
    scrollY.value = 0
  })
}
function reset() {
  settings.value = defaultEffects()
}
</script>
<template>
  <div ref="panel" class="photo-effects-panel">
    <p v-if="loading" role="status">Đang nạp bộ hiệu ứng…</p>
    <div v-if="error" class="effects-error" role="alert">
      <p>{{ error }}</p>
      <button @click="$emit('retry')">Thử lại</button><button @click="reset">Tắt toàn bộ</button>
    </div>
    <template v-if="!sharpenOnly">
      <label class="effects-search"
        >{{ effectPresets.length - 1 }} hiệu ứng · Tìm kiếm<input
          v-model="search"
          type="search"
          placeholder="Bokeh, film, phác thảo…"
          aria-label="Tìm hiệu ứng"
      /></label>
      <div class="effects-groups" aria-label="Nhóm hiệu ứng">
        <button
          v-for="item in effectGroups"
          :key="item"
          :aria-pressed="group === item"
          @click="group = item"
        >
          {{ item }}
        </button>
      </div>
      <template v-if="settings.effect !== 'none'">
        <label class="slider-label" for="effect-amount"
          >{{ active?.name }}<span>{{ settings.amount }}%</span></label
        ><input
          id="effect-amount"
          v-model.number="settings.amount"
          type="range"
          min="0"
          max="100"
        />
        <template v-if="spatial"
          ><label class="slider-label" for="effect-scale"
            >Độ rộng / cỡ hạt<span>{{ settings.scale }}%</span></label
          ><input id="effect-scale" v-model.number="settings.scale" type="range" min="0" max="100"
        /></template>
        <template
          v-if="
            [
              'miniature',
              'zoom',
              'mono',
              'comic',
              'pixel',
              'swirl',
              'bulge',
              'pinch',
              'magazine',
              'radialink',
            ].includes(settings.effect)
          "
        >
          <label v-if="settings.effect !== 'miniature'" class="slider-label" for="effect-x"
            >Tâm ngang<span>{{ settings.centerX }}%</span></label
          ><input
            v-if="settings.effect !== 'miniature'"
            id="effect-x"
            v-model.number="settings.centerX"
            type="range"
            min="0"
            max="100"
          />
          <label class="slider-label" for="effect-y"
            >Tâm dọc<span>{{ settings.centerY }}%</span></label
          ><input id="effect-y" v-model.number="settings.centerY" type="range" min="0" max="100" />
        </template>
      </template>
      <div class="effects-grid">
        <button
          v-for="item in visible"
          :key="item.id"
          :aria-pressed="settings.effect === item.id"
          @click="choose(item.id)"
        >
          <Icon :icon="item.icon" /><strong>{{ item.name }}</strong
          ><span>{{ item.hint }}</span>
        </button>
      </div>
    </template>
    <details :open="sharpenOnly" class="effects-sharpen">
      <summary><Icon icon="lucide:focus" />Làm nét ảnh</summary>
      <p>
        Tăng độ rõ bằng Unsharp Mask. Không phải AI khôi phục ảnh; chỉnh vừa phải để tránh viền sáng
        và nhiễu.
      </p>
      <label class="slider-label" for="effect-sharpness"
        >Độ nét<span>{{ settings.sharpness }}%</span></label
      ><input
        id="effect-sharpness"
        v-model.number="settings.sharpness"
        type="range"
        min="0"
        max="100"
      />
      <label class="slider-label" for="effect-radius"
        >Bán kính chi tiết<span>{{ settings.sharpenRadius }}%</span></label
      ><input
        id="effect-radius"
        v-model.number="settings.sharpenRadius"
        type="range"
        min="0"
        max="100"
      />
      <label class="slider-label" for="effect-denoise"
        >Giảm nhiễu trước khi làm nét<span>{{ settings.denoise }}%</span></label
      ><input
        id="effect-denoise"
        v-model.number="settings.denoise"
        type="range"
        min="0"
        max="100"
      />
      <button @click="settings = { ...settings, sharpness: 35, sharpenRadius: 20, denoise: 0 }">
        Nét nhẹ</button
      ><button @click="settings = { ...settings, sharpness: 0, denoise: 0 }">Tắt làm nét</button>
    </details>
    <button class="effects-reset" @click="reset">Đặt lại hiệu ứng & làm nét</button>
    <a href="/hachi-studio/vendor/glfx/LICENSE.txt" target="_blank" rel="noopener noreferrer"
      >Hiệu ứng & Unsharp Mask: glfx.js · Evan Wallace · MIT</a
    >
  </div>
</template>
<style scoped>
.photo-effects-panel {
  display: grid;
  gap: 14px;
}
.effects-search {
  display: grid;
  gap: 8px;
  font-size: 10px;
  color: var(--color-text-dim);
}
.effects-search input {
  width: 100%;
  min-height: 42px;
  font-size: 16px;
  background: var(--color-bg-deep);
  border: 1px solid var(--color-border-default);
  padding: 8px 10px;
  color: var(--color-text-primary);
}
.photo-effects-panel .slider-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: var(--color-text-secondary);
  margin: 10px 0 0;
}
.photo-effects-panel .slider-label span {
  font-size: 10px;
  color: var(--color-accent-coral);
  font-variant-numeric: tabular-nums;
}
.photo-effects-panel input[type='range'] {
  display: block;
  width: 100%;
  height: 28px;
  margin: 0;
  accent-color: var(--color-accent-coral);
  touch-action: pan-y;
}
.effects-groups {
  display: flex;
  gap: 6px;
  overflow: auto;
}
.effects-groups button {
  min-height: 40px;
  white-space: nowrap;
  padding: 8px 12px;
  border: 1px solid var(--color-border-default);
  font-size: 11px;
}
.photo-effects-panel button[aria-pressed='true'] {
  border-color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
  color: var(--color-accent-coral);
}
.effects-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.effects-grid button {
  display: grid;
  gap: 7px;
  text-align: left;
  align-content: start;
  padding: 12px;
  border: 1px solid var(--color-border-default);
}
.effects-grid svg {
  width: 24px;
  height: 24px;
  color: var(--color-accent-amber);
}
.effects-grid strong {
  font-size: 12px;
}
.effects-grid span {
  font-size: 10px;
  line-height: 1.5;
  color: var(--color-text-dim);
}
.effects-sharpen {
  border-top: 1px solid var(--color-border-default);
  padding-top: 12px;
}
.effects-sharpen summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 13px;
  cursor: pointer;
}
.effects-sharpen svg {
  width: 20px;
  height: 20px;
}
.effects-sharpen p,
.effects-error p {
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.effects-sharpen button,
.effects-reset,
.effects-error button {
  padding: 10px 12px;
  min-height: 44px;
  border: 1px solid var(--color-border-default);
  font-size: 12px;
  margin-right: 6px;
}
.photo-effects-panel > a {
  font-size: 9px;
  line-height: 1.6;
  color: var(--color-text-dim);
}
.effects-error {
  padding: 12px;
  background: var(--color-bg-elevated);
}
</style>
