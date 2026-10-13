<script setup lang="ts">
import { computed, nextTick, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  useElementSize,
  useEventListener,
  useObjectUrl,
  useUserMedia,
  useRafFn,
} from '@vueuse/core'
import { collageLayouts } from '../data/collage'
import type { FrameCell } from '../data/collage'
import { frameRect, sourceRect, frameDividers, resizeFrames } from '../utils/collage'
import type { FrameDivider } from '../utils/collage'
import { panFraming } from '../utils/crop'
import type { Framing } from '../utils/crop'
import { useMouseScroll } from '../composables/useMouseScroll'

const emit = defineEmits<{ close: [] }>()
const root = ref<HTMLElement>()
useMouseScroll(root)
const board = ref<HTMLElement>()
const boardWrap = ref<HTMLElement>()
const { width: availableWidth, height: availableHeight } = useElementSize(boardWrap)
const panel = ref<'layout' | 'ratio' | 'paper' | null>(null)
function togglePanel(next: 'layout' | 'ratio' | 'paper') {
  panel.value = panel.value === next ? null : next
}
function selectLayout(id: string) {
  layoutId.value = id
  panel.value = null
}
function selectRatio(value: number) {
  ratio.value = value
  panel.value = null
}
const layoutId = ref('four-grid')
const layout = computed(() => collageLayouts.find((item) => item.id === layoutId.value)!)
const customCells = ref<FrameCell[]>(layout.value.cells.map((cell) => ({ ...cell })))
const dividers = computed(() => frameDividers(customCells.value))
const filledCount = computed(() => customCells.value.filter((_, i) => images.value[i]).length)
function resetLayout() {
  customCells.value = layout.value.cells.map((cell) => ({ ...cell }))
}
const boardStyle = computed(() => {
  const width = Math.max(
    1,
    Math.min(availableWidth.value - 32, (availableHeight.value - 24) * ratio.value, 420),
  )
  return { width: `${width}px`, height: `${width / ratio.value}px`, background: paper.value }
})
function dividerStyle(divider: FrameDivider) {
  const x = divider.axis === 'x' ? divider.position : (divider.start + divider.end) / 2
  const y =
    divider.axis === 'y' ? divider.position : divider.start + (divider.end - divider.start) * 0.36
  return {
    left: `${((border.value + x * (360 - 2 * border.value)) / 360) * 100}%`,
    top: `${((border.value + y * (360 / ratio.value - 2 * border.value)) / (360 / ratio.value)) * 100}%`,
  }
}
function resizeKey(event: KeyboardEvent, divider: FrameDivider) {
  const decrease = divider.axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
  const increase = divider.axis === 'x' ? 'ArrowRight' : 'ArrowDown'
  if (event.key !== decrease && event.key !== increase) return
  event.preventDefault()
  customCells.value = resizeFrames(
    customCells.value,
    divider,
    divider.position + (event.key === increase ? 0.02 : -0.02),
  )
}
let dividerDrag:
  | {
      id: number
      divider: FrameDivider
      cells: FrameCell[]
      x: number
      y: number
      width: number
      height: number
    }
  | undefined
const ratio = ref(9 / 16)
const active = ref(0)
const gap = ref(8)
const border = ref(16)
const paper = ref('#fffaf3')
const images = shallowRef<(HTMLCanvasElement | undefined)[]>([
  undefined,
  undefined,
  undefined,
  undefined,
])
const framing = reactive<Framing[]>(Array.from({ length: 4 }, () => ({ zoom: 1, x: 0, y: 0 })))
const previews: (HTMLCanvasElement | undefined)[] = []
const fileInput = ref<HTMLInputElement>()
const busy = ref(false)
const message = ref('')
const error = ref('')
const cameraSlot = ref<number>()
const cameraVideo = ref<HTMLVideoElement>()
const facing = ref<'user' | 'environment'>('user')
const cameraBusy = ref(false)
const cameraReady = ref(false)
const { start, stop } = useUserMedia({
  constraints: computed(() => ({
    audio: false,
    video: { facingMode: { ideal: facing.value }, width: { ideal: 1920 }, height: { ideal: 1440 } },
  })),
  autoSwitch: false,
})
const download = shallowRef<Blob>()
const downloadUrl = useObjectUrl(download)
let disposed = false
let cameraVersion = 0
let importVersion = 0
const cellRects = computed(() =>
  customCells.value.map((cell) => frameRect(cell, 360, 360 / ratio.value, gap.value, border.value)),
)
const cameraRatio = computed(() => {
  const rect = cellRects.value[cameraSlot.value ?? 0]!
  return rect.w / rect.h
})
function resetFrame(index = active.value) {
  Object.assign(framing[index]!, { zoom: 1, x: 0, y: 0 })
}
function chooseFile() {
  fileInput.value?.click()
}
function removePhoto() {
  images.value = images.value.map((image, i) => (i === active.value ? undefined : image))
  resetFrame()
}
function drawPreviews() {
  customCells.value.forEach((_, index) => {
    const target = previews[index],
      image = images.value[index],
      rect = cellRects.value[index]!
    if (!target) return
    const width = Math.round(rect.w * 1.5),
      height = Math.round(rect.h * 1.5)
    if (target.width !== width) target.width = width
    if (target.height !== height) target.height = height
    const ctx = target.getContext('2d')!
    ctx.clearRect(0, 0, target.width, target.height)
    if (!image) return
    const crop = sourceRect(image.width, image.height, rect.w / rect.h, framing[index]!)
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, target.width, target.height)
  })
}
let previewDirty = true
useRafFn(() => {
  if (previewDirty) {
    previewDirty = false
    drawPreviews()
  }
})
watch(
  [images, framing, cellRects],
  () => {
    previewDirty = true
  },
  { deep: true, flush: 'post' },
)
watch(layoutId, () => {
  resetLayout()
  pointers.clear()
  gesture = undefined
  dividerDrag = undefined
  active.value = Math.min(active.value, layout.value.cells.length - 1)
})
async function importPhoto(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  const index = active.value,
    version = ++importVersion
  if (file.size > 30 * 1024 * 1024) {
    error.value = 'Chọn ảnh nhỏ hơn 30 MB nhé.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const bitmap = await createImageBitmap(file)
    try {
      if (disposed || version !== importVersion) return
      const target = document.createElement('canvas'),
        scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
      target.width = Math.round(bitmap.width * scale)
      target.height = Math.round(bitmap.height * scale)
      target.getContext('2d')!.drawImage(bitmap, 0, 0, target.width, target.height)
      images.value = images.value.map((image, i) => (i === index ? target : image))
      resetFrame(index)
    } finally {
      bitmap.close()
    }
  } catch {
    error.value = 'Không đọc được ảnh. Hãy thử JPEG, PNG hoặc WebP.'
  } finally {
    if (version === importVersion) busy.value = false
  }
}
function closeCamera() {
  cameraVersion++
  stop()
  cameraSlot.value = undefined
  cameraReady.value = false
  cameraBusy.value = false
  if (cameraVideo.value) cameraVideo.value.srcObject = null
}
async function openCamera(index = active.value) {
  const version = ++cameraVersion
  stop()
  cameraSlot.value = index
  cameraBusy.value = true
  cameraReady.value = false
  error.value = ''
  try {
    const stream = await start()
    if (disposed || version !== cameraVersion) {
      stream?.getTracks().forEach((track) => track.stop())
      return
    }
    await nextTick()
    if (!stream || !cameraVideo.value) throw new Error('Camera unavailable')
    cameraVideo.value.srcObject = stream
    await cameraVideo.value.play()
    cameraReady.value = true
  } catch {
    if (version === cameraVersion) {
      closeCamera()
      error.value =
        'Không mở được camera. Cần HTTPS/localhost và quyền camera; bạn vẫn có thể chọn ảnh.'
    }
  } finally {
    if (version === cameraVersion) cameraBusy.value = false
  }
}
function flipCamera() {
  facing.value = facing.value === 'user' ? 'environment' : 'user'
  void openCamera(cameraSlot.value)
}
function shoot() {
  const video = cameraVideo.value,
    index = cameraSlot.value
  if (!video?.videoWidth || index === undefined) return
  const target = document.createElement('canvas')
  target.width = video.videoWidth
  target.height = video.videoHeight
  const ctx = target.getContext('2d')!
  if (facing.value === 'user') {
    ctx.translate(target.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0)
  images.value = images.value.map((image, i) => (i === index ? target : image))
  resetFrame(index)
  active.value = index
  closeCamera()
  message.value = `Đã chụp ảnh vào ô ${index + 1}.`
}
const pointers = new Map<number, { x: number; y: number }>()
let gesture:
  | {
      index: number
      x: number
      y: number
      distance: number
      framing: Framing
      width: number
      height: number
    }
  | undefined
function startGesture(index: number, element: HTMLElement) {
  const points = [...pointers.values()],
    rect = element.getBoundingClientRect()
  if (!points[0]) {
    gesture = undefined
    return
  }
  gesture = {
    index,
    x: points[0].x,
    y: points[0].y,
    distance: points[1] ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) : 0,
    framing: { ...framing[index]! },
    width: rect.width,
    height: rect.height,
  }
}
useEventListener(board, 'pointerdown', (event: PointerEvent) => {
  if (!(event.target instanceof Element) || busy.value) return
  const handle = event.target.closest<HTMLElement>('[data-divider]')
  if (handle && board.value && !gesture && !dividerDrag) {
    const divider = dividers.value[Number(handle.dataset.divider)]!
    const rect = board.value.getBoundingClientRect()
    dividerDrag = {
      id: event.pointerId,
      divider: { ...divider },
      cells: customCells.value.map((cell) => ({ ...cell })),
      x: event.clientX,
      y: event.clientY,
      width: (rect.width * (360 - 2 * border.value)) / 360,
      height: (rect.height * (360 / ratio.value - 2 * border.value)) / (360 / ratio.value),
    }
    handle.setPointerCapture(event.pointerId)
    event.preventDefault()
    return
  }
  if (dividerDrag) return
  const element = event.target.closest<HTMLElement>('[data-slot]')
  if (!element) return
  const index = Number(element.dataset.slot)
  if (gesture && gesture.index !== index) return
  active.value = index
  if (!images.value[index]) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  element.setPointerCapture(event.pointerId)
  startGesture(index, element)
  event.preventDefault()
})
useEventListener(board, 'pointermove', (event: PointerEvent) => {
  if (dividerDrag?.id === event.pointerId) {
    const drag = dividerDrag
    const delta =
      drag.divider.axis === 'x'
        ? (event.clientX - drag.x) / drag.width
        : (event.clientY - drag.y) / drag.height
    customCells.value = resizeFrames(drag.cells, drag.divider, drag.divider.position + delta)
    event.preventDefault()
    return
  }
  if (!gesture || !pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  const points = [...pointers.values()],
    image = images.value[gesture.index]!
  if (points[1] && points[0] && gesture.distance > 0) {
    framing[gesture.index]!.zoom = Math.max(
      1,
      Math.min(
        4,
        (gesture.framing.zoom * Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)) /
          gesture.distance,
      ),
    )
  } else if (points[0]) {
    Object.assign(
      framing[gesture.index]!,
      panFraming(
        gesture.framing,
        points[0].x - gesture.x,
        points[0].y - gesture.y,
        gesture.width,
        gesture.height,
        image.width / image.height,
        gesture.width / gesture.height,
      ),
    )
  }
  event.preventDefault()
})
useEventListener(
  board,
  ['pointerup', 'pointercancel', 'lostpointercapture'],
  (event: PointerEvent) => {
    if (dividerDrag?.id === event.pointerId) dividerDrag = undefined
    pointers.delete(event.pointerId)
    if (gesture && event.target instanceof HTMLElement) startGesture(gesture.index, event.target)
    if (!pointers.size) gesture = undefined
  },
)
useEventListener(
  board,
  'wheel',
  (event: WheelEvent) => {
    if (!(event.target instanceof Element)) return
    const element = event.target.closest<HTMLElement>('[data-slot]')
    if (!element || !images.value[Number(element.dataset.slot)]) return
    active.value = Number(element.dataset.slot)
    const frame = framing[active.value]!
    frame.zoom = Math.max(1, Math.min(4, frame.zoom - event.deltaY * 0.002))
    event.preventDefault()
  },
  { passive: false },
)
async function save() {
  if (busy.value) return
  if (customCells.value.some((_, i) => !images.value[i])) {
    error.value = 'Thêm ảnh vào tất cả các ô trước khi lưu nhé.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const target = document.createElement('canvas'),
      scale = 1080 / 360
    target.width = 1080
    target.height = Math.round(1080 / ratio.value)
    const ctx = target.getContext('2d')!
    ctx.fillStyle = paper.value
    ctx.fillRect(0, 0, target.width, target.height)
    customCells.value.forEach((cell, index) => {
      const rect = frameRect(
          cell,
          target.width,
          target.height,
          gap.value * scale,
          border.value * scale,
        ),
        image = images.value[index]!
      const crop = sourceRect(image.width, image.height, rect.w / rect.h, framing[index]!)
      ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, rect.x, rect.y, rect.w, rect.h)
    })
    const blob = await new Promise<Blob | null>((resolve) =>
      target.toBlob(resolve, 'image/jpeg', 0.95),
    )
    if (!blob || disposed) return
    download.value = blob
    await nextTick()
    if (!downloadUrl.value) return
    const link = document.createElement('a')
    link.href = downloadUrl.value
    link.download = `HACHI-collage-${Date.now()}.jpg`
    link.click()
    message.value = 'Đã lưu ảnh ghép. Ảnh chỉ được xử lý trên thiết bị.'
  } catch {
    error.value = 'Không lưu được ảnh. Hãy thử lại.'
  } finally {
    busy.value = false
  }
}
function exit() {
  closeCamera()
  emit('close')
}
useEventListener(root, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && cameraSlot.value !== undefined) closeCamera()
})
onScopeDispose(() => {
  disposed = true
  importVersion++
  closeCamera()
})
</script>

<template>
  <section ref="root" class="collage-studio">
    <header>
      <button aria-label="Quay lại Studio" @click="exit"><Icon icon="lucide:arrow-left" /></button>
      <h2>
        HACHI <span>GHÉP ẢNH · {{ filledCount }}/{{ customCells.length }}</span>
      </h2>
      <button :disabled="busy" class="save" @click="save">
        <Icon icon="lucide:download" />{{ busy ? 'Đang xử lý' : 'Lưu' }}
      </button>
    </header>
    <div class="collage-body">
      <div ref="boardWrap" class="board-wrap">
        <div ref="board" class="board" :style="boardStyle">
          <button
            v-for="(rect, index) in cellRects"
            :key="index"
            class="slot"
            :class="{ selected: active === index, filled: images[index] }"
            :data-slot="index"
            :aria-label="`Chọn ô ảnh ${index + 1}`"
            :aria-pressed="active === index"
            :style="{
              left: (rect.x / 360) * 100 + '%',
              top: (rect.y / (360 / ratio)) * 100 + '%',
              width: (rect.w / 360) * 100 + '%',
              height: (rect.h / (360 / ratio)) * 100 + '%',
            }"
            @click="active = index"
          >
            <canvas
              :ref="
                (element) => {
                  previews[index] = element as HTMLCanvasElement
                }
              "
            />
            <span v-if="!images[index]"><Icon icon="lucide:image-plus" />Ô {{ index + 1 }}</span>
            <small v-else>{{ index + 1 }}</small>
          </button>
          <div
            v-for="(divider, index) in dividers"
            :key="index"
            class="divider-handle"
            :class="divider.axis === 'x' ? 'divider-vertical' : 'divider-horizontal'"
            :data-divider="index"
            :style="dividerStyle(divider)"
            role="separator"
            tabindex="0"
            :aria-label="
              divider.axis === 'x' ? 'Kéo chia chiều rộng các ô' : 'Kéo chia chiều cao các ô'
            "
            :aria-orientation="divider.axis === 'x' ? 'vertical' : 'horizontal'"
            :aria-valuenow="Math.round(divider.position * 100)"
            :aria-valuemin="12"
            :aria-valuemax="88"
            @keydown="resizeKey($event, divider)"
          >
            <Icon
              :icon="divider.axis === 'x' ? 'lucide:grip-vertical' : 'lucide:grip-horizontal'"
            />
          </div>
        </div>
      </div>
      <p class="hint">Kéo ảnh để căn · Kéo tay nắm để đổi kích thước ô</p>
      <p v-if="error || message" :role="error ? 'alert' : 'status'" class="notice">
        {{ error || message }}
      </p>
      <div class="slot-controls">
        <strong>Ô {{ active + 1 }}</strong>
        <button :disabled="busy" @click="chooseFile">
          <Icon icon="lucide:image" />{{ images[active] ? 'Đổi ảnh' : 'Chọn ảnh' }}
        </button>
        <button :disabled="busy" @click="openCamera()">
          <Icon icon="lucide:camera" />Chụp mới
        </button>
        <button
          :disabled="!images[active] || busy"
          aria-label="Xóa ảnh trong ô"
          @click="removePhoto"
        >
          <Icon icon="lucide:trash-2" />
        </button>
      </div>
      <div v-if="images[active]" class="zoom-row">
        <label for="collage-zoom">Zoom {{ framing[active]!.zoom.toFixed(1) }}×</label
        ><input
          id="collage-zoom"
          v-model.number="framing[active]!.zoom"
          type="range"
          min="1"
          max="4"
          step=".01"
        /><button @click="resetFrame()">Căn lại</button>
      </div>
      <div v-if="panel === 'ratio'" class="ratios editor-panel" aria-label="Tỷ lệ ảnh ghép">
        <button
          v-for="option in [
            { name: 'Story 9:16', value: 9 / 16 },
            { name: 'Post 4:5', value: 4 / 5 },
            { name: 'Vuông', value: 1 },
            { name: 'Photo strip', value: 1 / 3 },
          ]"
          :key="option.name"
          :aria-pressed="ratio === option.value"
          @click="selectRatio(option.value)"
        >
          {{ option.name }}
        </button>
      </div>
      <div
        v-if="panel === 'layout'"
        class="layout-strip editor-panel"
        aria-label="Bố cục khung ảnh"
      >
        <button
          v-for="item in collageLayouts"
          :key="item.id"
          :aria-pressed="layoutId === item.id"
          @click="selectLayout(item.id)"
        >
          <span class="layout-preview"
            ><i
              v-for="(cell, i) in item.cells"
              :key="i"
              :style="{
                left: cell.x * 100 + '%',
                top: cell.y * 100 + '%',
                width: cell.w * 100 + '%',
                height: cell.h * 100 + '%',
              }" /></span
          >{{ item.name }}
        </button>
      </div>
      <section v-if="panel === 'paper'" class="paper-panel editor-panel" aria-label="Nền và viền">
        <div class="paper-options">
          <button
            v-for="color in ['#fffaf3', '#26211d', '#efb6a6', '#dfc99c', '#a4bcc8', '#ffffff']"
            :key="color"
            :style="{ background: color }"
            :aria-label="`Màu nền ${color}`"
            :aria-pressed="paper === color"
            @click="paper = color"
          /><label>Màu riêng<input v-model="paper" type="color" /></label>
        </div>
        <label for="collage-gap">Khoảng cách</label
        ><input id="collage-gap" v-model.number="gap" type="range" min="0" max="24" /><label
          for="collage-border"
          >Viền ngoài</label
        ><input id="collage-border" v-model.number="border" type="range" min="0" max="36" />
      </section>
      <nav class="collage-toolbar" aria-label="Công cụ ghép ảnh">
        <button :aria-pressed="panel === 'layout'" @click="togglePanel('layout')">
          <Icon icon="lucide:panels-top-left" /><span>Khung</span>
        </button>
        <button :aria-pressed="panel === 'ratio'" @click="togglePanel('ratio')">
          <Icon icon="lucide:ratio" /><span>Tỷ lệ</span>
        </button>
        <button :aria-pressed="panel === 'paper'" @click="togglePanel('paper')">
          <Icon icon="lucide:palette" /><span>Nền / viền</span>
        </button>
        <button @click="resetLayout">
          <Icon icon="lucide:rotate-ccw" /><span>Đặt lại ô</span>
        </button>
      </nav>
    </div>
    <input ref="fileInput" hidden type="file" accept="image/*" @change="importPhoto" />
    <div
      v-if="cameraSlot !== undefined"
      class="capture-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Chụp ảnh cho khung"
    >
      <header>
        <button aria-label="Đóng camera" @click="closeCamera"><Icon icon="lucide:x" /></button
        ><strong>Chụp cho ô {{ cameraSlot + 1 }}</strong
        ><button :disabled="cameraBusy" aria-label="Đổi camera" @click="flipCamera">
          <Icon icon="lucide:switch-camera" />
        </button>
      </header>
      <div class="capture-area">
        <div
          class="capture-frame"
          :style="{ aspectRatio: String(cameraRatio), width: `min(100%, ${60 * cameraRatio}dvh)` }"
        >
          <video
            ref="cameraVideo"
            autoplay
            muted
            playsinline
            :class="{ mirrored: facing === 'user' }"
          />
          <div class="capture-grid" />
          <span v-if="!cameraReady">Đang mở camera…</span>
        </div>
      </div>
      <p>Ảnh sẽ được căn đúng khung này. Bạn vẫn có thể kéo và zoom sau khi chụp.</p>
      <button class="shutter" :disabled="!cameraReady" aria-label="Chụp ảnh vào ô" @click="shoot">
        <Icon icon="lucide:camera" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.collage-studio {
  width: min(100%, 480px);
  height: min(100dvh, 920px);
  background: var(--color-bg-surface);
  display: flex;
  flex-direction: column;
  color: var(--color-text-primary);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  gap: 8px;
  flex-shrink: 0;
}
header h2 {
  font-family: var(--font-display);
  font-size: 17px;
  letter-spacing: 0.1em;
}
header h2 span {
  font-size: 10px;
  color: var(--color-accent-coral);
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px;
  font-size: 12px;
  cursor: pointer;
}
button svg {
  width: 18px;
  height: 18px;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.save {
  color: var(--color-accent-coral);
  font-weight: 600;
}
.collage-body {
  overflow: auto;
  padding: 0 14px 24px;
  scrollbar-width: thin;
}
.board-wrap {
  display: flex;
  justify-content: center;
  background: var(--color-bg-deep);
  padding: 10px;
}
.board {
  position: relative;
  width: min(100%, calc(48dvh * v-bind(ratio)));
  max-width: 360px;
  flex-shrink: 0;
}
.slot {
  position: absolute;
  overflow: hidden;
  padding: 0;
  min-height: 0;
  background: var(--color-bg-elevated);
  touch-action: none;
  user-select: none;
}
.slot.selected {
  outline: 2px solid var(--color-accent-coral);
  outline-offset: -2px;
  z-index: 1;
}
.slot.filled {
  cursor: grab;
}
.slot canvas {
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.slot > span {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-dim);
}
.slot small {
  position: absolute;
  top: 5px;
  left: 5px;
  padding: 2px 6px;
  background: var(--color-bg-surface);
  font-size: 10px;
}
.hint,
.notice {
  font-size: 11px;
  line-height: 1.6;
  margin: 10px 0;
  color: var(--color-text-secondary);
}
.notice {
  color: var(--color-accent-coral);
}
.slot-controls,
.zoom-row,
.ratios {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0;
}
.slot-controls strong {
  font-size: 12px;
  margin-right: auto;
}
.slot-controls button,
.ratios button {
  border: 1px solid var(--color-border-default);
}
.ratios {
  flex-wrap: wrap;
}
.ratios button[aria-pressed='true'],
.layout-strip button[aria-pressed='true'] {
  border-color: var(--color-accent-coral);
  color: var(--color-accent-coral);
}
.zoom-row {
  font-size: 11px;
}
.zoom-row input {
  flex: 1;
  min-width: 30px;
}
input[type='range'] {
  accent-color: var(--color-accent-coral);
  touch-action: pan-y;
}
.layout-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0 14px;
  cursor: grab;
  user-select: none;
}
.layout-strip button {
  flex-shrink: 0;
  flex-direction: column;
  border: 1px solid var(--color-border-default);
  font-size: 10px;
  width: 100px;
}
.layout-preview {
  display: block;
  position: relative;
  width: 44px;
  height: 60px;
  background: var(--color-bg-deep);
}
.layout-preview i {
  position: absolute;
  background: var(--color-text-dim);
  border: 2px solid var(--color-bg-surface);
}
details {
  border-top: 1px solid var(--color-border-default);
  padding-top: 12px;
  font-size: 12px;
}
summary {
  cursor: pointer;
  min-height: 40px;
}
details > input {
  display: block;
  width: 100%;
  margin: 10px 0;
}
.paper-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.paper-options button {
  width: 30px;
  min-height: 30px;
  border: 1px solid var(--color-border-default);
}
.paper-options button[aria-pressed='true'] {
  outline: 2px solid var(--color-accent-coral);
}
.paper-options label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.capture-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-deep);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: max(8px, env(safe-area-inset-top)) 12px max(20px, env(safe-area-inset-bottom));
}
.capture-overlay header {
  width: min(100%, 480px);
}
.capture-area {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(100%, 480px);
}
.capture-frame {
  position: relative;
  overflow: hidden;
  background: var(--color-text-primary);
}
.capture-frame video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.mirrored {
  transform: scaleX(-1);
}
.capture-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(
      to right,
      transparent 33%,
      #ffffff55 33%,
      #ffffff55 33.3%,
      transparent 33.3%,
      transparent 66%,
      #ffffff55 66%,
      #ffffff55 66.3%,
      transparent 66.3%
    ),
    linear-gradient(
      to bottom,
      transparent 33%,
      #ffffff55 33%,
      #ffffff55 33.3%,
      transparent 33.3%,
      transparent 66%,
      #ffffff55 66%,
      #ffffff55 66.3%,
      transparent 66.3%
    );
}
.capture-frame > span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-bg-surface);
}
.capture-overlay p {
  font-size: 11px;
  text-align: center;
  max-width: 360px;
  margin: 12px;
}
.shutter {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-accent-coral);
  color: var(--color-bg-surface);
}
@media (min-width: 640px) {
  .collage-studio {
    height: min(900px, calc(100dvh - 48px));
    border: 1px solid var(--color-border-default);
  }
}
.collage-studio {
  position: relative;
  overflow: hidden;
}
.collage-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0 12px max(8px, env(safe-area-inset-bottom));
}
.board-wrap {
  flex: 1;
  min-height: 0;
  align-items: center;
  padding: 0;
  background: radial-gradient(ellipse at center, var(--color-bg-elevated), var(--color-bg-deep));
}
.board {
  max-width: none;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-text-primary) 10%, transparent);
}
.hint {
  flex-shrink: 0;
  text-align: center;
  margin: 6px 0;
  font-size: 10px;
}
.notice {
  position: absolute;
  top: 62px;
  left: 16px;
  right: 16px;
  z-index: 10;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  padding: 6px 10px;
  pointer-events: none;
}
.slot-controls {
  flex-shrink: 0;
  margin: 4px 0;
}
.slot-controls button {
  background: var(--color-bg-deep);
}
.slot-controls button:nth-child(2) {
  color: var(--color-accent-coral);
  border-color: var(--color-accent-coral);
}
.zoom-row {
  flex-shrink: 0;
  min-height: 36px;
  margin: 0;
}
.collage-toolbar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  flex-shrink: 0;
  border-top: 1px solid var(--color-border-default);
  margin-top: 6px;
}
.collage-toolbar button {
  flex-direction: column;
  gap: 4px;
  min-height: 54px;
  font-size: 10px;
}
.collage-toolbar button[aria-pressed='true'] {
  color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
}
.editor-panel {
  flex-shrink: 0;
  background: var(--color-bg-deep);
  padding: 10px;
  margin: 6px 0 0;
  max-height: min(27dvh, 190px);
  overflow: auto;
  overscroll-behavior: contain;
}
.layout-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.layout-strip button {
  width: auto;
  min-width: 0;
  padding: 6px 2px;
  font-size: 9px;
}
.layout-preview {
  width: 28px;
  height: 36px;
}
.ratios {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}
.paper-panel {
  font-size: 11px;
}
.paper-panel > input {
  display: block;
  width: 100%;
  margin: 4px 0;
}
.paper-options {
  margin: 0 0 8px;
}
.divider-handle {
  position: absolute;
  z-index: 4;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  touch-action: none;
  user-select: none;
  color: var(--color-bg-surface);
  outline: none;
}
.divider-handle svg {
  width: 24px;
  height: 24px;
  padding: 3px;
  background: var(--color-accent-coral);
  border: 1px solid var(--color-bg-surface);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-text-primary) 20%, transparent);
  pointer-events: none;
}
.divider-horizontal {
  width: 48px;
  height: 32px;
  cursor: row-resize;
}
.divider-vertical {
  width: 32px;
  height: 48px;
  cursor: col-resize;
}
.divider-handle:focus-visible svg,
.divider-handle:hover svg {
  outline: 2px solid var(--color-text-primary);
}
@media (max-height: 560px) {
  header {
    padding: 4px 12px;
  }
  .collage-toolbar button {
    min-height: 42px;
  }
  .hint {
    display: none;
  }
  .editor-panel {
    max-height: 100px;
  }
}
</style>
