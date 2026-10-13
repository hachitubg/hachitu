<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onScopeDispose,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import {
  useUserMedia,
  useRafFn,
  useObjectUrl,
  useEventListener,
  useDocumentVisibility,
  useElementSize,
  useLocalStorage,
} from '@vueuse/core'
import { groups, looks } from './data/looks'
import { demoScene, dispose, render } from './utils/renderer'
import { decorate, textFonts } from './utils/decorations'
import type { Decorations, TextBounds } from './utils/decorations'
import { useMakeup } from './composables/useMakeup'
import { colorControls, NEUTRAL_COLOR } from './utils/color'
import type { ColorAdjustments } from './utils/color'
import { useBackground } from './composables/useBackground'

const canvas = ref<HTMLCanvasElement>()
const video = ref<HTMLVideoElement>()
const clip = ref<HTMLVideoElement>()
const overlay = ref<HTMLCanvasElement>()
const stage = ref<HTMLElement>()
const sheet = ref<HTMLDialogElement>()
const { width: stageWidth, height: stageHeight } = useElementSize(stage)
const frameStyle = computed(() => {
  const width = Math.min(stageWidth.value, stageHeight.value * ratio.value)
  return { width: `${width}px`, height: `${width / ratio.value}px` }
})
const textBounds = shallowRef<TextBounds>()
const picker = ref<HTMLInputElement>()
const selected = ref(looks[0]!)
const group = ref('Tất cả')
const strength = ref(100)
const adjustments = reactive<ColorAdjustments>({ ...NEUTRAL_COLOR })
const recipeName = ref('')
interface ColorRecipe {
  id: string
  name: string
  lookId: string
  strength: number
  adjustments: ColorAdjustments
}
const recipes = useLocalStorage<ColorRecipe[]>('hachitu-studio-color-recipes', [])
function resetColor() {
  Object.assign(adjustments, NEUTRAL_COLOR)
}
function saveRecipe() {
  if (!recipeName.value.trim()) return
  recipes.value = [
    ...recipes.value.slice(-19),
    {
      id: crypto.randomUUID(),
      name: recipeName.value.trim().slice(0, 32),
      lookId: selected.value.id,
      strength: strength.value,
      adjustments: { ...adjustments },
    },
  ]
  recipeName.value = ''
  notice.value = 'Đã lưu công thức màu trên thiết bị.'
}
function applyRecipe(recipe: ColorRecipe) {
  selectLook(recipe.lookId)
  strength.value = recipe.strength
  Object.assign(adjustments, recipe.adjustments)
}
function deleteRecipe(id: string) {
  recipes.value = recipes.value.filter((recipe) => recipe.id !== id)
}
const ratio = ref(3 / 4)
const grid = ref(false)
const comparing = ref(false)
const facing = ref<'user' | 'environment'>('environment')
const mode = ref<'demo' | 'camera' | 'photo' | 'video'>('demo')
const area = ref<'camera' | 'studio'>('camera')
const studioMode = ref<'demo' | 'photo' | 'video'>('demo')
const freshCapture = ref(false)
const cameraSettings = shallowRef({ look: looks[0]!, strength: 100, ratio: 3 / 4 })
const studioSettings = shallowRef({ look: looks[0]!, strength: 100, ratio: 3 / 4 })
const tool = ref<'color' | 'crop' | 'text' | 'makeup' | 'background' | 'erase' | null>(null)
const toolTitle = computed(() =>
  tool.value === 'color'
    ? 'Màu của khoảnh khắc'
    : tool.value === 'text'
      ? 'Thêm một dòng cảm xúc'
      : tool.value === 'makeup'
        ? 'Makeup của bạn'
        : tool.value === 'background'
          ? 'Xóa phông'
          : tool.value === 'erase'
            ? 'Xóa vật nhỏ'
            : 'Chọn khung hình',
)
const background = useBackground()
const backgroundEffect = computed(() =>
  background.enabled.value && background.mask.value
    ? { mask: background.mask.value, color: background.color.value }
    : undefined,
)
const eraseMode = ref(false)
const eraseSize = ref(6)
const eraseMask = shallowRef<HTMLCanvasElement>()
const eraseHasMask = ref(false)
const eraseBusy = ref(false)
const eraseUndo = shallowRef<Array<HTMLCanvasElement | HTMLImageElement>>([])
let eraser: Worker | undefined
let eraseVersion = 0
const makeup = useMakeup()
const makeupEffect = computed(() =>
  makeup.face.value && makeup.settings.enabled
    ? { settings: makeup.settings, face: makeup.face.value }
    : undefined,
)
const makeupReady = computed(() => makeup.status.value === 'ready')
const framing = reactive({ zoom: 1, x: 0, y: 0 })
const decorations = reactive<Decorations>({
  text: '',
  color: '#fffaf4',
  font: 'classic',
  style: 'plain',
  align: 'center',
  opacity: 100,
  x: 0.5,
  y: 0.72,
  size: 6,
})
const recording = ref(false)
const clipPlaying = ref(false)
const clipTime = ref(0)
const clipDuration = ref(0)
const recordingProgress = computed(() =>
  Math.round((100 * clipTime.value) / Math.max(1, clipDuration.value)),
)
let recorder: MediaRecorder | undefined
let outputStream: MediaStream | undefined
let discardRecording = false
const composite = document.createElement('canvas')
const exportOverlay = document.createElement('canvas')
const busy = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const still = shallowRef<HTMLCanvasElement | HTMLImageElement>()
watch(still, () => makeup.reset())
const demo = shallowRef<HTMLCanvasElement>()
const photoMirrored = ref(false)
const preserveAlpha = ref(false)
const thumbnails = ref<Record<string, string>>({})
const upload = shallowRef<Blob>()
const uploadUrl = useObjectUrl(upload)
const downloadBlob = shallowRef<Blob>()
const downloadUrl = useObjectUrl(downloadBlob)
const exportCanvas = document.createElement('canvas')
const visibleLooks = computed(() =>
  looks.filter((item) => group.value === 'Tất cả' || item.group === group.value),
)
const constraints = computed<MediaStreamConstraints>(() => ({
  audio: false,
  video: { facingMode: { ideal: facing.value }, width: { ideal: 1920 }, height: { ideal: 1440 } },
}))
const { start, stop, isSupported } = useUserMedia({ constraints, autoSwitch: false })
let disposed = false
const visibility = useDocumentVisibility()

function draw() {
  const source =
    mode.value === 'camera'
      ? video.value
      : mode.value === 'video'
        ? clip.value
        : mode.value === 'photo'
          ? still.value
          : demo.value
  if (!source || !canvas.value) return
  if (source instanceof HTMLVideoElement && source.readyState < 2) return
  try {
    render(
      canvas.value,
      source,
      selected.value,
      comparing.value ? 0 : strength.value / 100,
      ratio.value,
      720,
      mode.value === 'camera' ? facing.value === 'user' : photoMirrored.value,
      area.value === 'camera' ? { zoom: 1, x: 0, y: 0 } : framing,
      area.value === 'studio' && mode.value === 'photo' && !comparing.value
        ? makeupEffect.value
        : undefined,
      area.value === 'studio' && !comparing.value ? adjustments : undefined,
      area.value === 'studio' && mode.value === 'photo' && !comparing.value
        ? backgroundEffect.value
        : undefined,
    )
    if (overlay.value)
      textBounds.value = decorate(
        overlay.value,
        canvas.value.width,
        canvas.value.height,
        comparing.value || area.value === 'camera' ? { ...decorations, text: '' } : decorations,
      )
    if (overlay.value && eraseMode.value && eraseMask.value && !comparing.value) {
      const ctx = overlay.value.getContext('2d')!
      const cx =
        Math.min(1, ratio.value / (eraseMask.value.width / eraseMask.value.height)) / framing.zoom
      const cy =
        Math.min(1, eraseMask.value.width / eraseMask.value.height / ratio.value) / framing.zoom
      const left = 0.5 + ((photoMirrored.value ? -1 : 1) * framing.x * (1 - cx)) / 2 - cx / 2
      const top = 0.5 + (framing.y * (1 - cy)) / 2 - cy / 2
      ctx.save()
      ctx.globalAlpha = 0.6
      if (photoMirrored.value) {
        ctx.translate(overlay.value.width, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(
        eraseMask.value,
        left * eraseMask.value.width,
        top * eraseMask.value.height,
        cx * eraseMask.value.width,
        cy * eraseMask.value.height,
        0,
        0,
        overlay.value.width,
        overlay.value.height,
      )
      ctx.restore()
    }
    if (recording.value) {
      const ctx = composite.getContext('2d')
      ctx?.drawImage(canvas.value, 0, 0)
      if (overlay.value) ctx?.drawImage(overlay.value, 0, 0)
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Không thể hiển thị ảnh.'
  }
}

let lastFrame = 0
useRafFn(({ timestamp }) => {
  if (
    !['camera', 'video'].includes(mode.value) ||
    visibility.value !== 'visible' ||
    timestamp - lastFrame < (recording.value ? 40 : 65)
  )
    return
  lastFrame = timestamp
  draw()
})
watch(
  [
    selected,
    strength,
    ratio,
    comparing,
    mode,
    still,
    framing,
    decorations,
    area,
    makeupEffect,
    adjustments,
    backgroundEffect,
    eraseMode,
  ],
  () => {
    draw()
  },
  { flush: 'post', deep: true },
)

function resetEdits() {
  background.reset()
  eraseVersion++
  eraser?.terminate()
  eraser = undefined
  eraseMode.value = false
  eraseBusy.value = false
  eraseMask.value = undefined
  eraseHasMask.value = false
  eraseUndo.value = []
  resetColor()
  makeup.reset()
  Object.assign(framing, { zoom: 1, x: 0, y: 0 })
  Object.assign(decorations, { text: '', x: 0.5, y: 0.72 })
}

function closeSheet() {
  tool.value = null
}
function switchArea(next: 'camera' | 'studio') {
  if (next === area.value || busy.value || saving.value || recording.value || eraseBusy.value)
    return
  finishErase()
  closeSheet()
  stop()
  clip.value?.pause()
  error.value = ''
  notice.value = ''
  const settings = { look: selected.value, strength: strength.value, ratio: ratio.value }
  if (area.value === 'studio') {
    studioSettings.value = settings
    if (mode.value !== 'camera') studioMode.value = mode.value
  } else cameraSettings.value = settings
  const target =
    next === 'studio' && freshCapture.value
      ? settings
      : next === 'studio'
        ? studioSettings.value
        : cameraSettings.value
  selected.value = target.look
  strength.value = target.strength
  ratio.value = target.ratio
  area.value = next
  mode.value = next === 'studio' ? (freshCapture.value ? 'photo' : studioMode.value) : 'demo'
  if (next === 'studio' && freshCapture.value) {
    studioMode.value = 'photo'
    freshCapture.value = false
  }
}
function openStudioImport() {
  switchArea('studio')
  chooseImage()
}
function openTool(next: 'color' | 'crop' | 'text' | 'makeup' | 'background' | 'erase') {
  if (area.value === 'camera' && next !== 'color') return
  tool.value = next
  if (next === 'background' && still.value && !background.mask.value)
    void background.remove(still.value)
  if (next === 'makeup' && mode.value === 'photo' && still.value && makeup.status.value === 'idle')
    void makeup.detect(still.value)
}
function retryBackground() {
  if (still.value) void background.remove(still.value)
}
function clearErase() {
  eraseMask.value?.getContext('2d')?.clearRect(0, 0, eraseMask.value.width, eraseMask.value.height)
  eraseHasMask.value = false
  draw()
}
function beginErase() {
  if (!still.value || eraseBusy.value) return
  const source = still.value
  if (!eraseMask.value) {
    const m = document.createElement('canvas')
    m.width = source instanceof HTMLImageElement ? source.naturalWidth : source.width
    m.height = source instanceof HTMLImageElement ? source.naturalHeight : source.height
    eraseMask.value = m
  }
  closeSheet()
  eraseMode.value = true
  notice.value = 'Tô lên chi tiết cần xóa, rồi bấm Xóa vùng.'
}
function finishErase() {
  clearErase()
  eraseMode.value = false
  notice.value = ''
}
function undoErase() {
  const previous = eraseUndo.value[eraseUndo.value.length - 1]
  if (previous) {
    eraseUndo.value = eraseUndo.value.slice(0, -1)
    still.value = previous
    clearErase()
  }
}
function applyErase() {
  if (!still.value || !eraseMask.value || !eraseHasMask.value || eraseBusy.value) return
  const source = still.value,
    mask = eraseMask.value,
    request = ++eraseVersion
  const input = document.createElement('canvas')
  input.width = mask.width
  input.height = mask.height
  const ctx = input.getContext('2d')!
  ctx.drawImage(source, 0, 0, input.width, input.height)
  const pixels = ctx.getImageData(0, 0, input.width, input.height)
  const marked = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height)
  eraser?.terminate()
  eraser = new Worker(new URL('./utils/inpaint.worker.ts', import.meta.url), { type: 'module' })
  eraseBusy.value = true
  error.value = ''
  notice.value = 'Đang xóa vùng đã tô…'
  eraser.onmessage = (event: MessageEvent<{ result?: Uint8ClampedArray; error?: string }>) => {
    if (request !== eraseVersion) return
    eraseBusy.value = false
    eraser?.terminate()
    eraser = undefined
    if (event.data.error) {
      error.value = event.data.error
      notice.value = ''
      return
    }
    if (!event.data.result) return
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(event.data.result), input.width, input.height),
      0,
      0,
    )
    eraseUndo.value = [...eraseUndo.value.slice(-1), source]
    still.value = input
    clearErase()
    notice.value = 'Đã xóa. Có thể Hoàn tác nếu chưa ưng ý.'
  }
  eraser.onerror = () => {
    eraseBusy.value = false
    eraser?.terminate()
    eraser = undefined
    error.value = 'Không xử lý được vùng này. Hãy thử vùng nhỏ hơn.'
  }
  eraser.postMessage(
    { image: pixels.data, mask: marked.data, width: input.width, height: input.height },
    [pixels.data.buffer, marked.data.buffer],
  )
}
let erasePoint: { x: number; y: number; id: number } | undefined
function paintErase(event: PointerEvent) {
  if (!eraseMask.value || !overlay.value) return
  const rect = overlay.value.getBoundingClientRect(),
    u = (event.clientX - rect.left) / rect.width,
    v = (event.clientY - rect.top) / rect.height
  const cx =
    Math.min(1, ratio.value / (eraseMask.value.width / eraseMask.value.height)) / framing.zoom
  const cy =
    Math.min(1, eraseMask.value.width / eraseMask.value.height / ratio.value) / framing.zoom
  let x = (u - 0.5) * cx + 0.5 + (framing.x * (1 - cx)) / 2
  if (photoMirrored.value) x = 1 - x
  const y = (v - 0.5) * cy + 0.5 + (framing.y * (1 - cy)) / 2
  const point = { x: x * eraseMask.value.width, y: y * eraseMask.value.height, id: event.pointerId }
  const ctx = eraseMask.value.getContext('2d')!
  ctx.strokeStyle = '#d9654f'
  ctx.fillStyle = '#d9654f'
  ctx.lineWidth = (eraseSize.value / 100) * cx * eraseMask.value.width
  ctx.lineCap = 'round'
  if (erasePoint) {
    ctx.beginPath()
    ctx.moveTo(erasePoint.x, erasePoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(point.x, point.y, ctx.lineWidth / 2, 0, Math.PI * 2)
  ctx.fill()
  erasePoint = point
  eraseHasMask.value = true
  draw()
}
function retryMakeup() {
  if (still.value && mode.value === 'photo') void makeup.detect(still.value)
}
watch(tool, async (value) => {
  await nextTick()
  if (value && !sheet.value?.open) sheet.value?.showModal()
  else if (!value && sheet.value?.open) sheet.value.close()
})
function dismissBackdrop(event: MouseEvent) {
  if (event.target !== sheet.value || !sheet.value) return
  const box = sheet.value.getBoundingClientRect()
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    closeSheet()
}
function resetCrop() {
  Object.assign(framing, { zoom: 1, x: 0, y: 0 })
}
function deleteText() {
  decorations.text = ''
  closeSheet()
}
function saveMedia() {
  closeSheet()
  if (mode.value === 'video') void saveVideo()
  else void savePhoto()
}
let drag: { id: number; startX: number; startY: number; x: number; y: number } | undefined
useEventListener(overlay, 'pointerdown', (event: PointerEvent) => {
  if (eraseMode.value && !eraseBusy.value && !tool.value && overlay.value) {
    overlay.value.setPointerCapture(event.pointerId)
    paintErase(event)
    event.preventDefault()
    return
  }
  if (!overlay.value || !textBounds.value || tool.value || recording.value || saving.value) return
  const rect = overlay.value.getBoundingClientRect()
  const x = ((event.clientX - rect.left) * overlay.value.width) / rect.width
  const y = ((event.clientY - rect.top) * overlay.value.height) / rect.height
  const box = textBounds.value
  if (x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height) return
  drag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: decorations.x,
    y: decorations.y,
  }
  overlay.value.setPointerCapture(event.pointerId)
  event.preventDefault()
})
useEventListener(overlay, 'pointermove', (event: PointerEvent) => {
  if (eraseMode.value && erasePoint?.id === event.pointerId && !eraseBusy.value) {
    paintErase(event)
    return
  }
  if (!drag || !overlay.value || event.pointerId !== drag.id) return
  const rect = overlay.value.getBoundingClientRect()
  decorations.x = Math.max(0, Math.min(1, drag.x + (event.clientX - drag.startX) / rect.width))
  decorations.y = Math.max(0, Math.min(1, drag.y + (event.clientY - drag.startY) / rect.height))
})
useEventListener(overlay, ['pointerup', 'pointercancel', 'lostpointercapture'], () => {
  erasePoint = undefined
  drag = undefined
})

async function toggleClip() {
  if (!clip.value || recording.value) return
  if (clip.value.paused) {
    try {
      await clip.value.play()
    } catch {
      error.value = 'Không phát được video này.'
    }
  } else clip.value.pause()
}

function stopRecording(discard = false) {
  discardRecording = discard
  if (recorder && recorder.state !== 'inactive') recorder.stop()
}

async function saveVideo() {
  const source = clip.value
  if (!source || !canvas.value || recording.value) return
  if (!Number.isFinite(source.duration) || source.duration <= 0 || source.duration > 60) {
    error.value = 'Hãy chọn clip hợp lệ tối đa 60 giây.'
    return
  }
  if (typeof MediaRecorder === 'undefined' || !composite.captureStream) {
    error.value =
      'Trình duyệt này chưa hỗ trợ xuất video. Bạn có thể xem thử màu hoặc dùng Chrome/Safari mới hơn.'
    return
  }
  const mimeType = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  )
  if (!mimeType) {
    error.value = 'Thiết bị không có định dạng xuất video phù hợp.'
    return
  }
  error.value = ''
  notice.value = ''
  discardRecording = false
  comparing.value = false
  source.pause()
  source.currentTime = 0
  source.loop = false
  composite.width = canvas.value.width
  composite.height = canvas.value.height
  outputStream = composite.captureStream(24)
  const chunks: Blob[] = []
  try {
    recorder = new MediaRecorder(outputStream, { mimeType, videoBitsPerSecond: 4000000 })
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    recorder.onstop = async () => {
      recording.value = false
      source.pause()
      outputStream?.getTracks().forEach((track) => track.stop())
      if (discardRecording || disposed) return
      const blob = new Blob(chunks, { type: mimeType })
      if (!blob.size) {
        error.value = 'Không tạo được video. Hãy thử lại.'
        return
      }
      downloadBlob.value = blob
      await nextTick()
      if (!downloadUrl.value) return
      const link = document.createElement('a')
      link.href = downloadUrl.value
      link.download = `HACHI-${selected.value.id}-${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`
      link.click()
      notice.value = 'Đã xuất video màu không tiếng.'
    }
    recorder.onerror = () => {
      error.value = 'Xuất video thất bại. Hãy thử clip ngắn hơn.'
      stopRecording(true)
    }
    recording.value = true
    draw()
    recorder.start(500)
    await source.play()
  } catch {
    error.value = 'Không thể xuất video trên thiết bị này.'
    stopRecording(true)
    recording.value = false
    outputStream?.getTracks().forEach((track) => track.stop())
  }
}

useEventListener(clip, 'ended', () => {
  clipPlaying.value = false
  if (recording.value) stopRecording()
})
useEventListener(clip, 'play', () => {
  clipPlaying.value = true
})
useEventListener(clip, 'pause', () => {
  clipPlaying.value = false
})
useEventListener(clip, 'timeupdate', () => {
  clipTime.value = clip.value?.currentTime ?? 0
})
watch(visibility, (value) => {
  if (value !== 'visible' && recording.value) {
    stopRecording(true)
    notice.value = 'Đã hủy xuất khi bạn rời màn hình. Giữ trang mở khi xuất video nhé.'
  }
})

async function openCamera() {
  if (busy.value) return
  if (!isSupported.value || !window.isSecureContext) {
    error.value = 'Camera cần HTTPS và trình duyệt có hỗ trợ. Bạn vẫn có thể chọn ảnh từ máy.'
    return
  }
  busy.value = true
  error.value = ''
  notice.value = ''
  clip.value?.pause()
  stop()
  try {
    const media = await start()
    if (disposed) {
      stop()
      return
    }
    if (!media || !video.value) throw new Error('Không thể mở camera.')
    video.value.srcObject = media
    await video.value.play()
    mode.value = 'camera'
    closeSheet()
    photoMirrored.value = false
  } catch (reason) {
    stop()
    mode.value = still.value ? 'photo' : 'demo'
    const name = reason instanceof Error ? reason.name : ''
    error.value =
      name === 'NotAllowedError'
        ? 'Chưa được cấp quyền camera. Cho phép camera trong cài đặt trình duyệt rồi thử lại.'
        : name === 'NotFoundError'
          ? 'Không tìm thấy camera. Hãy chọn ảnh từ máy để thử màu.'
          : 'Không mở được camera. Camera có thể đang được ứng dụng khác sử dụng.'
  } finally {
    busy.value = false
  }
}

async function switchCamera() {
  facing.value = facing.value === 'user' ? 'environment' : 'user'
  await openCamera()
}

function capture() {
  preserveAlpha.value = false
  const source = video.value
  if (mode.value !== 'camera' || !source?.videoWidth || busy.value) return
  const raw = document.createElement('canvas')
  const scale = Math.min(1, 2560 / Math.max(source.videoWidth, source.videoHeight))
  raw.width = Math.round(source.videoWidth * scale)
  raw.height = Math.round(source.videoHeight * scale)
  raw.getContext('2d')?.drawImage(source, 0, 0, raw.width, raw.height)
  still.value = raw
  resetEdits()
  studioMode.value = 'photo'
  freshCapture.value = true
  photoMirrored.value = facing.value === 'user'
  mode.value = 'photo'
  stop()
  notice.value = 'Đã chụp. Lưu ảnh hoặc mở Studio để chỉnh tiếp.'
}

function chooseImage() {
  picker.value?.click()
}
function importImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    error.value = 'Hãy chọn một file ảnh hoặc video.'
    return
  }
  if (file.size > (file.type.startsWith('video/') ? 120 : 30) * 1024 * 1024) {
    error.value = 'Hãy chọn ảnh dưới 30 MB hoặc video dưới 120 MB.'
    return
  }
  upload.value = file
  input.value = ''
}
let importVersion = 0
watch(uploadUrl, async (url) => {
  if (!url) return
  const version = ++importVersion
  busy.value = true
  error.value = ''
  notice.value = ''
  if (upload.value?.type.startsWith('video/')) {
    const source = clip.value
    if (!source) {
      busy.value = false
      return
    }
    source.pause()
    source.src = url
    source.load()
    return
  }
  const image = new Image()
  image.src = url
  try {
    await image.decode()
    if (version !== importVersion) return
    const raw = document.createElement('canvas')
    const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight))
    raw.width = Math.round(image.naturalWidth * scale)
    raw.height = Math.round(image.naturalHeight * scale)
    raw.getContext('2d')?.drawImage(image, 0, 0, raw.width, raw.height)
    stop()
    clip.value?.pause()
    resetEdits()
    still.value = raw
    preserveAlpha.value = upload.value?.type === 'image/png'
    photoMirrored.value = false
    mode.value = 'photo'
    studioMode.value = 'photo'
    area.value = 'studio'
    closeSheet()
  } catch {
    error.value = 'Không đọc được ảnh này. Hãy thử JPEG, PNG hoặc WebP.'
  } finally {
    if (version === importVersion) busy.value = false
  }
})

useEventListener(clip, 'loadeddata', () => {
  const source = clip.value
  if (!source) return
  busy.value = false
  if (!Number.isFinite(source.duration) || source.duration > 60 || source.duration <= 0) {
    mode.value = still.value ? 'photo' : 'demo'
    error.value = 'Bản này hỗ trợ clip tối đa 60 giây. Hãy chọn clip ngắn hơn.'
    return
  }
  stop()
  resetEdits()
  still.value = undefined
  photoMirrored.value = false
  clipDuration.value = source.duration
  clipTime.value = 0
  mode.value = 'video'
  studioMode.value = 'video'
  area.value = 'studio'
  closeSheet()
  ratio.value = source.videoWidth / source.videoHeight
  draw()
})
useEventListener(clip, 'error', () => {
  busy.value = false
  if (mode.value === 'video') mode.value = still.value ? 'photo' : 'demo'
  error.value = 'Không đọc được video. Hãy thử MP4 hoặc WebM.'
})

async function savePhoto() {
  if (!still.value || mode.value !== 'photo' || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const source = still.value
    const size = Math.min(
      2560,
      source instanceof HTMLImageElement
        ? Math.max(source.naturalWidth, source.naturalHeight)
        : Math.max(source.width, source.height),
    )
    render(
      exportCanvas,
      source,
      selected.value,
      strength.value / 100,
      ratio.value,
      size,
      photoMirrored.value,
      framing,
      area.value === 'studio' ? makeupEffect.value : undefined,
      area.value === 'studio' ? adjustments : undefined,
      area.value === 'studio' ? backgroundEffect.value : undefined,
    )
    await document.fonts.ready
    const output = document.createElement('canvas')
    output.width = exportCanvas.width
    output.height = exportCanvas.height
    const ctx = output.getContext('2d')
    ctx?.drawImage(exportCanvas, 0, 0)
    decorate(exportOverlay, output.width, output.height, decorations)
    ctx?.drawImage(exportOverlay, 0, 0)
    const transparent =
      area.value === 'studio' &&
      (backgroundEffect.value ? backgroundEffect.value.color === null : preserveAlpha.value)
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, transparent ? 'image/png' : 'image/jpeg', 0.95),
    )
    if (!blob) throw new Error('Không thể tạo ảnh.')
    downloadBlob.value = blob
    await nextTick()
    if (!downloadUrl.value) throw new Error('Không thể tải ảnh.')
    const link = document.createElement('a')
    link.href = downloadUrl.value
    link.download = `HACHI-${selected.value.id}-${Date.now()}.${transparent ? 'png' : 'jpg'}`
    link.click()
    notice.value = 'Ảnh đã sẵn sàng trong mục tải xuống của trình duyệt.'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Không thể lưu ảnh.'
  } finally {
    saving.value = false
  }
}

function selectLook(id: string) {
  selected.value = looks.find((item) => item.id === id) ?? looks[0]!
}
useEventListener(window, 'pointerup', () => {
  comparing.value = false
})
useEventListener(window, 'blur', () => {
  comparing.value = false
})
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (
    event.key !== ' ' ||
    event.repeat ||
    (event.target instanceof HTMLElement && event.target.closest('button, input, a, select'))
  )
    return
  if (mode.value === 'camera') {
    event.preventDefault()
    capture()
  }
})

onMounted(() => {
  demo.value = demoScene()
  const thumb = document.createElement('canvas')
  try {
    for (const look of looks) {
      render(thumb, demo.value, look, 1, 3 / 4, 110)
      thumbnails.value[look.id] = thumb.toDataURL('image/jpeg', 0.8)
    }
    draw()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Không tải được bộ màu.'
  } finally {
    dispose(thumb)
  }
})
onScopeDispose(() => {
  eraseVersion++
  eraser?.terminate()
  disposed = true
  importVersion++
  stop()
  stopRecording(true)
  outputStream?.getTracks().forEach((track) => track.stop())
  clip.value?.pause()
  if (canvas.value) dispose(canvas.value)
  dispose(exportCanvas)
})
</script>

<template>
  <div class="studio-app font-body">
    <div class="camera-phone">
      <header class="app-top">
        <RouterLink to="/" class="chrome-button" aria-label="Về trang chủ"
          ><Icon icon="lucide:arrow-left" class="size-5"
        /></RouterLink>
        <div class="app-brand">
          HACHI<span>{{ area === 'camera' ? 'CAMERA' : 'STUDIO' }}</span>
        </div>
        <button
          v-if="mode === 'photo' || mode === 'video'"
          class="top-save"
          :disabled="busy || saving || eraseMode || eraseBusy"
          @click="recording ? stopRecording(true) : saveMedia()"
        >
          <Icon
            :icon="recording ? 'lucide:x' : saving ? 'lucide:loader-circle' : 'lucide:download'"
            class="size-4"
            :class="{ 'animate-spin': saving }"
          />
          {{ recording ? 'Hủy ' + recordingProgress + '%' : saving ? 'Đang lưu' : 'Lưu' }}
        </button>
        <button
          v-else
          class="chrome-button"
          aria-label="Bật tắt lưới bố cục"
          :aria-pressed="grid"
          @click="grid = !grid"
        >
          <Icon icon="lucide:grid-3x3" class="size-5" />
        </button>
      </header>

      <nav class="workspace-switch" aria-label="Chọn không gian">
        <button
          :aria-pressed="area === 'camera'"
          :class="{ active: area === 'camera' }"
          :disabled="busy || saving || recording"
          @click="switchArea('camera')"
        >
          <Icon icon="lucide:camera" class="size-4" />Camera
        </button>
        <button
          :aria-pressed="area === 'studio'"
          :class="{ active: area === 'studio' }"
          :disabled="busy || saving || recording"
          @click="switchArea('studio')"
        >
          <Icon icon="lucide:sliders-horizontal" class="size-4" />Studio
        </button>
      </nav>

      <main
        ref="stage"
        class="camera-stage"
        :class="{ 'transparent-bg': area === 'studio' && backgroundEffect?.color === null }"
      >
        <div class="media-frame" :style="frameStyle">
          <canvas ref="canvas" class="photo-canvas" aria-label="Ảnh xem trước với màu đã chọn" />
          <canvas
            ref="overlay"
            class="text-overlay"
            :class="{ draggable: area === 'studio' && (decorations.text || eraseMode) }"
            aria-label="Chữ trên ảnh, kéo để thay đổi vị trí"
          />
          <video ref="video" muted playsinline class="hidden-video" aria-hidden="true" />
          <video
            ref="clip"
            muted
            playsinline
            preload="metadata"
            class="hidden-video"
            aria-hidden="true"
          />
          <div v-if="grid" class="composition-grid" aria-hidden="true"><i /><i /><i /><i /></div>
          <div v-if="mode === 'demo'" class="camera-start">
            <span class="start-mark"><Icon icon="lucide:aperture" class="size-10" /></span>
            <h1>
              {{ area === 'camera' ? 'Mỗi khoảnh khắc.' : 'Một tấm ảnh.' }}<br />{{
                area === 'camera' ? 'Một màu riêng.' : 'Câu chuyện của bạn.'
              }}
            </h1>
            <p>
              {{
                area === 'camera'
                  ? looks.length + ' màu. Chọn, ngắm và chụp.'
                  : 'Màu, chữ và khung hình trong một studio.'
              }}
            </p>
            <button
              v-if="area === 'camera'"
              class="start-camera"
              :disabled="busy"
              @click="openCamera"
            >
              <Icon icon="lucide:camera" class="size-5" />{{ busy ? 'Đang mở…' : 'Mở camera' }}
            </button>
            <button v-else class="start-camera" :disabled="busy" @click="chooseImage">
              <Icon icon="lucide:image-plus" class="size-5" />Chọn ảnh hoặc video
            </button>
            <button
              v-if="area === 'camera'"
              class="start-import"
              :disabled="busy"
              @click="switchArea('studio')"
            >
              Chỉnh ảnh trong Studio <Icon icon="lucide:arrow-up-right" class="size-4" />
            </button>
            <small>Khung minh họa màu</small>
          </div>
          <div v-if="mode !== 'demo'" class="frame-badges">
            <span
              ><i v-if="mode === 'camera'" />{{
                mode === 'camera' ? 'LIVE' : mode === 'video' ? 'VIDEO' : 'ẢNH'
              }}</span
            ><span>{{ selected.name }}</span>
          </div>
        </div>
        <button
          v-if="mode === 'video'"
          class="video-play"
          :disabled="recording"
          :aria-label="clipPlaying ? 'Tạm dừng video' : 'Phát video'"
          @click="toggleClip"
        >
          <Icon :icon="clipPlaying ? 'lucide:pause' : 'lucide:play'" class="size-5" />{{
            Math.floor(clipTime)
          }}
          / {{ Math.ceil(clipDuration) }}s
        </button>
        <div v-if="busy" class="loading-mask" role="status">
          <Icon icon="lucide:loader-circle" class="size-7 animate-spin" />Đang chuẩn bị…
        </div>
      </main>

      <div
        v-if="error || notice"
        class="app-feedback"
        :class="{ error }"
        :role="error ? 'alert' : 'status'"
      >
        {{ error || notice }}
      </div>
      <footer class="camera-dock">
        <div v-if="area === 'camera'" class="camera-color-bar">
          <button :disabled="busy || saving" @click="openTool('color')">
            <Icon icon="lucide:palette" class="size-5" /><span>{{ selected.name }}</span
            ><Icon icon="lucide:chevron-up" class="size-4" /></button
          ><span>{{ looks.length }} màu</span>
        </div>
        <div v-else-if="!eraseMode" class="tool-shortcuts">
          <button :disabled="recording || saving" @click="openTool('color')">
            <Icon icon="lucide:palette" class="size-5" /><span>Màu</span>
          </button>
          <button
            :disabled="recording || saving || mode !== 'photo'"
            @click="openTool('background')"
          >
            <Icon icon="lucide:scissors" class="size-5" /><span>Xóa phông</span>
          </button>
          <button :disabled="recording || saving || mode !== 'photo'" @click="openTool('erase')">
            <Icon icon="lucide:eraser" class="size-5" /><span>Xóa vật</span>
          </button>
          <button :disabled="recording || saving || mode !== 'photo'" @click="openTool('makeup')">
            <Icon icon="lucide:sparkles" class="size-5" /><span>Makeup</span
            ><i v-if="makeupReady && makeup.settings.enabled" />
          </button>
          <button :disabled="recording || saving || mode === 'demo'" @click="openTool('text')">
            <span class="type-icon">Aa</span><span>Chữ</span><i v-if="decorations.text" />
          </button>
          <button :disabled="recording || saving || mode === 'demo'" @click="openTool('crop')">
            <Icon icon="lucide:crop" class="size-5" /><span>Crop</span>
          </button>
          <button
            :disabled="recording || saving"
            aria-label="Giữ để xem ảnh gốc"
            @pointerdown.prevent="comparing = true"
            @pointercancel="comparing = false"
            @keydown.space.prevent="comparing = true"
            @keyup.space.prevent="comparing = false"
            @keydown.enter.prevent="comparing = true"
            @keyup.enter.prevent="comparing = false"
            @blur="comparing = false"
          >
            <Icon icon="lucide:split-square-horizontal" class="size-5" /><span>Ảnh gốc</span>
          </button>
        </div>
        <div v-if="area === 'camera'" class="shutter-row">
          <button
            class="dock-button"
            :disabled="busy || recording || saving"
            aria-label="Mở ảnh trong Studio"
            @click="openStudioImport"
          >
            <Icon icon="lucide:image-plus" class="size-6" />
          </button>
          <button
            v-if="mode === 'demo' || mode === 'camera'"
            class="shutter"
            :disabled="busy"
            :aria-label="mode === 'camera' ? 'Chụp ảnh' : 'Mở camera'"
            @click="mode === 'camera' ? capture() : openCamera()"
          >
            <span />
          </button>
          <button
            v-else
            class="new-shot"
            :disabled="busy || recording || saving"
            @click="openCamera"
          >
            <Icon icon="lucide:camera" class="size-6" /><span>Chụp mới</span>
          </button>
          <button
            v-if="mode === 'demo' || mode === 'camera'"
            class="dock-button"
            :disabled="busy || mode === 'demo'"
            aria-label="Đổi camera trước sau"
            @click="switchCamera"
          >
            <Icon icon="lucide:switch-camera" class="size-6" />
          </button>
          <button
            v-else
            class="dock-button"
            :disabled="recording || saving"
            aria-label="Bật tắt lưới bố cục"
            :aria-pressed="grid"
            @click="grid = !grid"
          >
            <Icon icon="lucide:grid-3x3" class="size-5" />
          </button>
        </div>
        <button
          v-if="area === 'camera' && mode === 'photo'"
          class="edit-capture"
          @click="switchArea('studio')"
        >
          <Icon icon="lucide:sliders-horizontal" class="size-4" />Chỉnh ảnh này trong Studio<Icon
            icon="lucide:arrow-right"
            class="size-4"
          />
        </button>
        <div v-if="area === 'studio' && !eraseMode" class="studio-source-row">
          <button :disabled="busy || recording || saving" @click="chooseImage">
            <Icon icon="lucide:image-plus" class="size-5" />{{
              mode === 'demo' ? 'Chọn ảnh / video' : 'Đổi ảnh / video'
            }}</button
          ><button :disabled="recording || saving" @click="switchArea('camera')">
            <Icon icon="lucide:camera" class="size-5" />Chụp ảnh mới
          </button>
        </div>
        <div v-if="eraseMode" class="erase-dock">
          <label class="slider-label" for="erase-brush"
            >Cỡ cọ<span>{{ eraseSize }}%</span></label
          ><input
            id="erase-brush"
            v-model.number="eraseSize"
            type="range"
            min="2"
            max="15"
            :disabled="eraseBusy"
          />
          <div>
            <button :disabled="eraseBusy || !eraseHasMask" @click="clearErase">Xóa nét tô</button
            ><button :disabled="eraseBusy || !eraseUndo.length" @click="undoErase">
              <Icon icon="lucide:undo-2" class="size-4" />Hoàn tác</button
            ><button :disabled="eraseBusy || !eraseHasMask" class="erase-apply" @click="applyErase">
              {{ eraseBusy ? 'Đang xử lý…' : 'Xóa vùng' }}</button
            ><button :disabled="eraseBusy" @click="finishErase">Xong</button>
          </div>
        </div>
        <p class="dock-hint">
          {{
            mode === 'video'
              ? 'Clip tối đa 60 giây · Xuất không tiếng'
              : area === 'studio' && decorations.text
                ? 'Kéo chữ trên ảnh để đổi vị trí'
                : mode === 'camera'
                  ? 'Chạm nút tròn để giữ khoảnh khắc'
                  : 'Ảnh của bạn. Sắc màu của bạn.'
          }}
        </p>
      </footer>

      <dialog
        ref="sheet"
        class="editor-sheet"
        aria-labelledby="sheet-title"
        @close="closeSheet"
        @click="dismissBackdrop"
      >
        <div class="sheet-grip" aria-hidden="true" />
        <div class="sheet-top">
          <h2 id="sheet-title">{{ toolTitle }}</h2>
          <button class="done-button" @click="closeSheet">
            Xong <Icon icon="lucide:check" class="size-4" />
          </button>
        </div>
        <div class="sheet-content">
          <template v-if="tool === 'background'">
            <div v-if="background.loading.value" class="makeup-loading" role="status">
              <Icon icon="lucide:loader-circle" class="size-6 animate-spin" /><strong
                >Đang tách người khỏi nền…</strong
              ><span>Lần đầu cần tải model. Ảnh được xử lý trên thiết bị.</span>
            </div>
            <template v-else
              ><p class="makeup-note">
                {{
                  background.message.value ||
                  'Tách người khỏi nền. Phù hợp ảnh chân dung và ảnh toàn thân.'
                }}
              </p>
              <button v-if="!background.mask.value" class="done-button" @click="retryBackground">
                Thử lại</button
              ><template v-else
                ><div class="background-options">
                  <button
                    :aria-pressed="background.color.value === null"
                    @click="background.color.value = null"
                  >
                    Trong suốt (PNG)</button
                  ><button
                    v-for="item in [
                      { color: '#fffaf4', name: 'Nền kem' },
                      { color: '#2f241f', name: 'Nền tối' },
                      { color: '#d9654f', name: 'Nền coral' },
                    ]"
                    :key="item.color"
                    :aria-pressed="background.color.value === item.color"
                    @click="background.color.value = item.color"
                  >
                    {{ item.name }}
                  </button>
                </div>
                <label class="background-picker"
                  >Màu nền tùy ý<input
                    type="color"
                    :value="background.color.value || '#fffaf4'"
                    @input="
                      background.color.value = ($event.target as HTMLInputElement).value
                    " /></label
                ><button
                  class="done-button"
                  @click="background.enabled.value = !background.enabled.value"
                >
                  {{ background.enabled.value ? 'Khôi phục phông gốc' : 'Áp dụng xóa phông' }}
                </button>
                <p class="makeup-note">
                  Nền trong suốt lưu bằng PNG. Tóc, vật che khuất và ánh sáng yếu có thể cần tinh
                  chỉnh thêm.
                </p></template
              ></template
            >
          </template>
          <template v-if="tool === 'erase'"
            ><div class="makeup-loading">
              <Icon icon="lucide:eraser" class="size-7" /><strong>Tô chi tiết muốn xóa</strong
              ><span
                >Tốt nhất với vết nhỏ, dây hoặc vật nhỏ trên nền đơn giản. Vùng lớn và nền nhiều họa
                tiết có thể bị nhòe.</span
              ><button class="done-button" @click="beginErase">
                Bắt đầu tô<Icon icon="lucide:arrow-right" class="size-4" />
              </button></div
          ></template>
          <template v-if="tool === 'makeup'">
            <div v-if="makeup.status.value === 'loading'" class="makeup-loading" role="status">
              <Icon icon="lucide:loader-circle" class="size-6 animate-spin" /><strong
                >Đang chuẩn bị Makeup…</strong
              ><span>Lần đầu cần tải bộ nhận diện. Ảnh vẫn ở trên thiết bị của bạn.</span>
            </div>
            <div v-else-if="!makeupReady" class="makeup-loading" role="status">
              <Icon icon="lucide:scan-face" class="size-7" /><strong>{{
                makeup.status.value === 'no-face' ? 'Chưa thấy khuôn mặt' : 'Chưa tải được Makeup'
              }}</strong
              ><span>{{ makeup.message.value }}</span
              ><button class="done-button" @click="retryMakeup">Thử lại</button>
            </div>
            <template v-else>
              <div class="makeup-actions">
                <span><Icon icon="lucide:scan-face" class="size-4" />1 khuôn mặt</span
                ><button
                  :aria-pressed="makeup.settings.enabled"
                  @click="makeup.settings.enabled = !makeup.settings.enabled"
                >
                  {{ makeup.settings.enabled ? 'Đang bật' : 'Đã tắt' }}
                </button>
              </div>
              <div class="makeup-presets">
                <button @click="makeup.natural">
                  Tự nhiên <Icon icon="lucide:sparkles" class="size-4" /></button
                ><button @click="makeup.resetLevels">Đặt lại</button>
              </div>
              <fieldset :disabled="!makeup.settings.enabled" class="makeup-sliders">
                <label class="slider-label" for="beauty-smooth"
                  >Mịn da <span>{{ makeup.settings.smooth }}%</span></label
                ><input
                  id="beauty-smooth"
                  v-model.number="makeup.settings.smooth"
                  type="range"
                  min="0"
                  max="100"
                />
                <label class="slider-label" for="beauty-bright"
                  >Sáng da <span>{{ makeup.settings.brighten }}%</span></label
                ><input
                  id="beauty-bright"
                  v-model.number="makeup.settings.brighten"
                  type="range"
                  min="0"
                  max="100"
                />
                <label class="slider-label" for="beauty-slim"
                  >Thon mặt <span>{{ makeup.settings.slim }}%</span></label
                ><input
                  id="beauty-slim"
                  v-model.number="makeup.settings.slim"
                  type="range"
                  min="0"
                  max="100"
                />
                <label class="slider-label" for="beauty-lips"
                  >Son môi <span>{{ makeup.settings.lipstick }}%</span></label
                ><input
                  id="beauty-lips"
                  v-model.number="makeup.settings.lipstick"
                  type="range"
                  min="0"
                  max="100"
                />
                <div class="makeup-colors" aria-label="Màu son">
                  <button
                    v-for="item in [
                      { hex: '#b6414a', name: 'Đỏ hồng' },
                      { hex: '#cf746b', name: 'Cam đào' },
                      { hex: '#954954', name: 'Hồng đất' },
                      { hex: '#a8323e', name: 'Đỏ trầm' },
                    ]"
                    :key="item.hex"
                    :style="{ background: item.hex }"
                    :aria-label="item.name"
                    :aria-pressed="makeup.settings.lipColor === item.hex"
                    @click="makeup.settings.lipColor = item.hex"
                  />
                </div>
                <label class="slider-label" for="beauty-blush"
                  >Má hồng <span>{{ makeup.settings.blush }}%</span></label
                ><input
                  id="beauty-blush"
                  v-model.number="makeup.settings.blush"
                  type="range"
                  min="0"
                  max="100"
                />
                <div class="makeup-colors" aria-label="Màu má hồng">
                  <button
                    v-for="item in [
                      { hex: '#d87b78', name: 'Hồng dịu' },
                      { hex: '#e49a78', name: 'Đào ấm' },
                      { hex: '#b96773', name: 'Hồng rose' },
                    ]"
                    :key="item.hex"
                    :style="{ background: item.hex }"
                    :aria-label="item.name"
                    :aria-pressed="makeup.settings.blushColor === item.hex"
                    @click="makeup.settings.blushColor = item.hex"
                  />
                </div>
              </fieldset>
              <p class="makeup-note">
                Bấm Xong, giữ Ảnh gốc để so sánh. Mịn da làm dịu khuyết điểm nhỏ; chưa có xóa từng
                nốt mụn.
              </p>
            </template>
          </template>
          <template v-if="tool === 'color'">
            <div
              v-if="area === 'studio' && recipes.length"
              class="saved-recipes"
              aria-label="Công thức màu đã lưu"
            >
              <div v-for="recipe in recipes" :key="recipe.id">
                <button @click="applyRecipe(recipe)">{{ recipe.name }}</button
                ><button
                  :aria-label="'Xóa công thức ' + recipe.name"
                  @click="deleteRecipe(recipe.id)"
                >
                  <Icon icon="lucide:x" class="size-3" />
                </button>
              </div>
            </div>
            <div class="collection-tabs" aria-label="Nhóm màu">
              <button
                v-for="item in groups"
                :key="item"
                :aria-pressed="group === item"
                :class="{ active: group === item }"
                @click="group = item"
              >
                {{ item }}
              </button>
            </div>
            <div class="film-strip" aria-label="Thư viện màu">
              <button
                v-for="look in visibleLooks"
                :key="look.id"
                class="film-look"
                :aria-pressed="selected.id === look.id"
                :class="{ active: selected.id === look.id }"
                @click="selectLook(look.id)"
              >
                <div>
                  <img :src="thumbnails[look.id]" alt="" loading="lazy" /><span
                    v-if="selected.id === look.id"
                    ><Icon icon="lucide:check" class="size-3"
                  /></span>
                </div>
                <span>{{ look.name }}</span>
              </button>
            </div>
            <p class="look-description">
              <strong>{{ selected.name }}</strong
              >{{ selected.note }}
            </p>
            <label class="slider-label" for="color-strength"
              >Độ mạnh <span>{{ strength }}%</span></label
            ><input
              id="color-strength"
              v-model.number="strength"
              type="range"
              min="0"
              max="100"
              :disabled="selected.id === 'original'"
            />
            <details v-if="area === 'studio'" class="custom-grade">
              <summary>
                <Icon icon="lucide:sliders-horizontal" class="size-4" />Tự chỉnh màu<Icon
                  icon="lucide:chevron-down"
                  class="size-4"
                />
              </summary>
              <div v-for="control in colorControls" :key="control.key">
                <label class="slider-label" :for="'grade-' + control.key"
                  >{{ control.label }}<span>{{ adjustments[control.key] }}</span></label
                ><input
                  :id="'grade-' + control.key"
                  v-model.number="adjustments[control.key]"
                  type="range"
                  :min="control.min"
                  :max="control.max"
                  :step="control.step"
                />
              </div>
              <button class="done-button" @click="resetColor">Đặt lại tùy chỉnh</button>
              <form class="recipe-form" @submit.prevent="saveRecipe">
                <input
                  v-model="recipeName"
                  maxlength="32"
                  aria-label="Tên công thức màu"
                  placeholder="Đặt tên màu của bạn…"
                /><button :disabled="!recipeName.trim()">Lưu màu</button>
              </form>
              <p>Giữ Ảnh gốc để so sánh. Công thức được lưu trên thiết bị này.</p>
            </details>
          </template>

          <template v-if="tool === 'text'">
            <textarea
              id="photo-text"
              v-model="decorations.text"
              aria-label="Chữ trên ảnh"
              maxlength="160"
              rows="2"
              placeholder="Viết điều bạn muốn nhớ…"
              class="text-entry"
            />
            <div class="font-strip" aria-label="Kiểu font chữ">
              <button
                v-for="font in textFonts"
                :key="font.id"
                :style="{ fontFamily: font.family, fontWeight: font.weight }"
                :class="{ active: decorations.font === font.id }"
                :aria-pressed="decorations.font === font.id"
                @click="decorations.font = font.id"
              >
                {{ font.name }}
              </button>
            </div>
            <div class="text-options">
              <div class="style-choices" aria-label="Kiểu hiển thị chữ">
                <button
                  v-for="item in [
                    { id: 'plain', label: 'Thường' },
                    { id: 'label', label: 'Nền' },
                    { id: 'outline', label: 'Viền' },
                  ] as const"
                  :key="item.id"
                  :class="{ active: decorations.style === item.id }"
                  :aria-pressed="decorations.style === item.id"
                  @click="decorations.style = item.id"
                >
                  {{ item.label }}
                </button>
              </div>
              <div class="align-choices">
                <button
                  v-for="align in ['left', 'center', 'right'] as const"
                  :key="align"
                  :aria-label="
                    align === 'left' ? 'Căn trái' : align === 'right' ? 'Căn phải' : 'Căn giữa'
                  "
                  :aria-pressed="decorations.align === align"
                  :class="{ active: decorations.align === align }"
                  @click="decorations.align = align"
                >
                  <Icon :icon="'lucide:align-' + align" class="size-4" />
                </button>
              </div>
            </div>
            <div class="color-swatches" aria-label="Màu chữ">
              <button
                v-for="color in [
                  { hex: '#fffaf4', name: 'Trắng kem' },
                  { hex: '#2f241f', name: 'Đen nâu' },
                  { hex: '#d9654f', name: 'Coral' },
                  { hex: '#f5ce7a', name: 'Vàng' },
                  { hex: '#3f7ea6', name: 'Xanh trời' },
                  { hex: '#bd6c45', name: 'Màu đất' },
                ]"
                :key="color.hex"
                :style="{ background: color.hex }"
                :class="{ active: decorations.color === color.hex }"
                :aria-label="color.name"
                :aria-pressed="decorations.color === color.hex"
                @click="decorations.color = color.hex"
              /><label class="custom-color" aria-label="Màu tùy chọn"
                ><Icon icon="lucide:plus" class="size-4" /><input
                  v-model="decorations.color"
                  type="color"
                  aria-label="Chọn màu chữ tùy ý"
              /></label>
            </div>
            <div class="text-sliders">
              <div>
                <label class="slider-label" for="text-size"
                  >Cỡ chữ <span>{{ decorations.size }}</span></label
                ><input
                  id="text-size"
                  v-model.number="decorations.size"
                  type="range"
                  min="3"
                  max="10"
                  step=".5"
                />
              </div>
              <div>
                <label class="slider-label" for="text-opacity"
                  >Độ rõ <span>{{ decorations.opacity }}%</span></label
                ><input
                  id="text-opacity"
                  v-model.number="decorations.opacity"
                  type="range"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div class="text-bottom">
              <span>Bấm Xong, rồi kéo chữ trên ảnh.</span
              ><button class="delete-text" :disabled="!decorations.text" @click="deleteText">
                <Icon icon="lucide:trash-2" class="size-4" />Xóa chữ
              </button>
            </div>
          </template>

          <template v-if="tool === 'crop'">
            <div class="ratio-choices" aria-label="Tỷ lệ khung ảnh">
              <button
                v-for="option in [
                  { label: '3:4', value: 3 / 4 },
                  { label: '1:1', value: 1 },
                  { label: '4:3', value: 4 / 3 },
                  { label: '9:16', value: 9 / 16 },
                ]"
                :key="option.label"
                :class="{ active: ratio === option.value }"
                :aria-pressed="ratio === option.value"
                @click="ratio = option.value"
              >
                <Icon icon="lucide:crop" class="size-4" />{{ option.label }}
              </button>
            </div>
            <label class="slider-label" for="crop-zoom"
              >Phóng to <span>{{ framing.zoom.toFixed(1) }}×</span></label
            ><input
              id="crop-zoom"
              v-model.number="framing.zoom"
              type="range"
              min="1"
              max="3"
              step=".05"
            />
            <label class="slider-label" for="crop-x">Dịch ngang</label
            ><input
              id="crop-x"
              v-model.number="framing.x"
              type="range"
              min="-1"
              max="1"
              step=".02"
            />
            <label class="slider-label" for="crop-y">Dịch dọc</label
            ><input
              id="crop-y"
              v-model.number="framing.y"
              type="range"
              min="-1"
              max="1"
              step=".02"
            />
            <div class="crop-bottom">
              <span>Giữ lại phần bạn muốn nhớ.</span
              ><button @click="resetCrop">
                <Icon icon="lucide:rotate-ccw" class="size-4" />Đặt lại
              </button>
            </div>
          </template>
        </div>
      </dialog>
      <input
        ref="picker"
        type="file"
        accept="image/*,video/*"
        class="hidden"
        @change="importImage"
      />
    </div>
  </div>
</template>

<style scoped>
.studio-app {
  min-height: 100svh;
  background: var(--color-bg-deep);
  color: var(--color-text-primary);
  display: grid;
  place-items: center;
}
.camera-stage.transparent-bg {
  background-color: var(--color-bg-surface);
  background-image: conic-gradient(
    var(--color-border-default) 25%,
    transparent 0 50%,
    var(--color-border-default) 0 75%,
    transparent 0
  );
  background-size: 20px 20px;
}
.background-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 20px 0;
}
.background-options button {
  border: 1px solid var(--color-border-default);
  padding: 12px 8px;
  min-height: 44px;
  font-size: 11px;
}
.background-options button[aria-pressed='true'] {
  color: var(--color-accent-coral);
  border-color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
}
.background-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  min-height: 44px;
}
.background-picker input {
  width: 48px;
  height: 32px;
}
.erase-dock > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.erase-dock button {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 8px 6px;
  font-size: 10px;
}
.erase-dock .erase-apply {
  color: var(--color-bg-surface);
  background: var(--color-accent-coral);
}
.custom-grade {
  border-top: 1px solid var(--color-border-default);
  padding-top: 12px;
  margin-top: 12px;
}
.custom-grade summary {
  display: flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  min-height: 44px;
  font-size: 12px;
  font-weight: 600;
}
.custom-grade summary svg:last-child {
  margin-left: auto;
}
.custom-grade p {
  font-size: 10px;
  line-height: 1.6;
  color: var(--color-text-dim);
  margin-top: 10px;
}
.recipe-form {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.recipe-form input {
  min-width: 0;
  flex: 1;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-deep);
  padding: 10px;
  font-size: 16px;
}
.recipe-form button {
  padding: 10px 12px;
  background: var(--color-accent-coral);
  color: var(--color-bg-surface);
  font-size: 11px;
}
.saved-recipes {
  display: flex;
  gap: 8px;
  overflow: auto;
  margin-bottom: 12px;
}
.saved-recipes > div {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-elevated);
}
.saved-recipes button {
  min-height: 38px;
  padding: 8px;
  font-size: 11px;
}
.makeup-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 12px;
  text-align: center;
  color: var(--color-text-secondary);
}
.makeup-loading strong {
  font-size: 13px;
}
.makeup-loading span {
  font-size: 11px;
  line-height: 1.7;
  max-width: 300px;
}
.makeup-actions,
.makeup-presets {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 0 12px;
  font-size: 11px;
}
.makeup-actions > span,
.makeup-presets > button:first-child {
  display: flex;
  align-items: center;
  gap: 6px;
}
.makeup-actions button,
.makeup-presets button {
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--color-border-default);
  color: var(--color-accent-coral);
}
.makeup-presets > button:first-child {
  background: var(--color-bg-elevated);
}
.makeup-sliders {
  border: 0;
  padding: 0;
}
.makeup-sliders:disabled {
  opacity: 0.4;
}
.makeup-colors {
  display: flex;
  gap: 12px;
  padding: 8px 3px 12px;
}
.makeup-colors button {
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-bg-surface);
  border-radius: 50%;
}
.makeup-colors button[aria-pressed='true'] {
  outline: 2px solid var(--color-accent-coral);
  outline-offset: 2px;
}
.makeup-note {
  font-size: 10px;
  line-height: 1.7;
  color: var(--color-text-dim);
  margin: 12px 0 0;
}
.camera-phone {
  width: min(100%, 480px);
  height: min(100dvh, 920px);
  min-height: 420px;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  position: relative;
  overflow: hidden;
  box-shadow: 0 12px 60px color-mix(in srgb, var(--color-text-primary) 8%, transparent);
}
.app-top {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 16px;
}
.app-brand {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.12em;
  display: flex;
  align-items: baseline;
  gap: 7px;
}
.app-brand span {
  font-size: 9px;
  font-weight: 500;
  color: var(--color-accent-coral);
  letter-spacing: 0.2em;
}
.chrome-button,
.dock-button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--color-text-secondary);
}
.chrome-button[aria-pressed='true'] {
  color: var(--color-accent-coral);
}
.top-save {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-bg-surface);
  background: var(--color-accent-coral);
}
.camera-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-text-primary);
  overflow: hidden;
}
.workspace-switch {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 0 16px 10px;
  flex-shrink: 0;
}
.workspace-switch button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 8px 20px;
  color: var(--color-text-dim);
  font-size: 12px;
  border-bottom: 2px solid transparent;
}
.workspace-switch button.active {
  color: var(--color-accent-coral);
  border-bottom-color: var(--color-accent-coral);
}
.camera-color-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10px;
  font-size: 10px;
  color: var(--color-text-dim);
}
.camera-color-bar button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  font-size: 12px;
  color: var(--color-text-primary);
}
.studio-source-row {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  gap: 8px;
  margin-top: 10px;
}
.studio-source-row button,
.edit-capture {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 11px;
  min-height: 44px;
  padding: 8px;
  color: var(--color-accent-coral);
}
.edit-capture {
  width: 100%;
  margin-top: 5px;
}
.media-frame {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}
.photo-canvas,
.text-overlay {
  display: block;
  width: 100%;
  height: 100%;
}
.text-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.text-overlay.draggable {
  pointer-events: auto;
  touch-action: none;
  cursor: grab;
}
.text-overlay.draggable:active {
  cursor: grabbing;
}
.hidden-video {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.frame-badges {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
  display: flex;
  justify-content: space-between;
  color: var(--color-bg-surface);
  pointer-events: none;
  font-size: 9px;
  letter-spacing: 0.1em;
}
.frame-badges span {
  background: color-mix(in srgb, var(--color-text-primary) 45%, transparent);
  padding: 6px 9px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.frame-badges i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent-coral);
}
.camera-start {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 32px;
  background: color-mix(in srgb, var(--color-text-primary) 25%, transparent);
  color: var(--color-bg-surface);
  text-align: center;
}
.start-mark {
  margin-bottom: 24px;
}
.camera-start h1 {
  font-family: var(--font-display);
  font-size: clamp(24px, 5vw, 34px);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.15;
}
.camera-start p {
  font-size: 12px;
  margin: 14px 0 28px;
  opacity: 0.85;
}
.start-camera {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  padding: 14px 22px;
  min-height: 48px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 13px;
}
.start-import {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 14px;
  font-size: 11px;
}
.camera-start small {
  position: absolute;
  bottom: 16px;
  font-size: 9px;
  opacity: 0.65;
}
.camera-dock {
  flex-shrink: 0;
  padding: 12px 18px max(10px, env(safe-area-inset-bottom));
}
.tool-shortcuts {
  display: flex;
  justify-content: flex-start;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 8px;
}
.tool-shortcuts button {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 56px;
  min-height: 50px;
  justify-content: center;
  color: var(--color-text-secondary);
}
.tool-shortcuts button > span:last-of-type {
  font-size: 9px;
}
.type-icon {
  font-family: Georgia, serif;
  font-size: 22px;
  line-height: 20px;
}
.tool-shortcuts i {
  position: absolute;
  top: 7px;
  right: 10px;
  width: 5px;
  height: 5px;
  background: var(--color-accent-coral);
  border-radius: 50%;
}
.shutter-row {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  gap: 24px;
  margin-top: 12px;
}
.shutter {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  border: 2px solid var(--color-accent-coral);
  padding: 5px;
}
.shutter span {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--color-accent-coral);
  border-radius: 50%;
}
.shutter:active span {
  transform: scale(0.92);
}
.new-shot {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  width: 66px;
  height: 66px;
  color: var(--color-accent-coral);
  border: 1px solid var(--color-border-default);
  border-radius: 50%;
}
.new-shot span {
  font-size: 8px;
}
.dock-hint {
  color: var(--color-text-dim);
  font-size: 9px;
  text-align: center;
  margin: 10px 0 0;
}
.app-feedback {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 11px;
  line-height: 1.5;
  background: var(--color-bg-elevated);
  color: var(--color-accent-sky);
}
.app-feedback.error {
  color: var(--color-accent-coral);
}
.video-play {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  color: var(--color-bg-surface);
  background: color-mix(in srgb, var(--color-text-primary) 70%, transparent);
  font-size: 11px;
  min-height: 44px;
}
.loading-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: color-mix(in srgb, var(--color-text-primary) 60%, transparent);
  color: var(--color-bg-surface);
  font-size: 12px;
}
.composition-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.composition-grid i {
  position: absolute;
  background: color-mix(in srgb, var(--color-bg-surface) 40%, transparent);
}
.composition-grid i:nth-child(1),
.composition-grid i:nth-child(2) {
  width: 1px;
  height: 100%;
  left: 33.333%;
}
.composition-grid i:nth-child(2) {
  left: 66.666%;
}
.composition-grid i:nth-child(3),
.composition-grid i:nth-child(4) {
  width: 100%;
  height: 1px;
  top: 33.333%;
}
.composition-grid i:nth-child(4) {
  top: 66.666%;
}
.editor-sheet {
  position: fixed;
  inset: auto 0 0;
  margin: 0 auto;
  width: min(100%, 480px);
  max-width: 480px;
  max-height: min(65dvh, 600px);
  border: 0;
  border-top: 1px solid var(--color-border-default);
  padding: 0;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  overflow-y: auto;
  scrollbar-width: thin;
  box-shadow: 0 -8px 40px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}
.editor-sheet[open] {
  animation: sheet-up 0.2s ease-out;
}
.editor-sheet::backdrop {
  background: color-mix(in srgb, var(--color-text-primary) 18%, transparent);
}
.sheet-grip {
  width: 32px;
  height: 3px;
  background: var(--color-border-default);
  margin: 10px auto 0;
  border-radius: 3px;
}
.sheet-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 18px 12px;
  position: sticky;
  top: 0;
  background: var(--color-bg-surface);
  z-index: 1;
}
.sheet-top h2 {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
}
.done-button {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-accent-coral);
  min-height: 40px;
  padding: 8px;
}
.sheet-content {
  padding: 0 18px max(18px, env(safe-area-inset-bottom));
}
.collection-tabs,
.film-strip,
.font-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 4px 2px 12px;
}
.collection-tabs::-webkit-scrollbar,
.film-strip::-webkit-scrollbar,
.font-strip::-webkit-scrollbar {
  display: none;
}
.collection-tabs button {
  white-space: nowrap;
  min-height: 36px;
  padding: 8px 10px;
  font-size: 11px;
  border: 1px solid var(--color-border-default);
}
.collection-tabs button.active {
  color: var(--color-bg-surface);
  background: var(--color-text-primary);
  border-color: var(--color-text-primary);
}
.film-look {
  flex: 0 0 70px;
  text-align: center;
}
.film-look > div {
  aspect-ratio: 3/4;
  position: relative;
  background: var(--color-bg-elevated);
}
.film-look img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.film-look > span {
  display: block;
  font-size: 9px;
  margin-top: 6px;
}
.film-look.active > div {
  outline: 2px solid var(--color-accent-coral);
  outline-offset: 2px;
}
.film-look > div > span {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: var(--color-accent-coral);
  color: var(--color-bg-surface);
  padding: 2px;
}
.look-description {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--color-text-secondary);
  font-size: 10px;
  margin: 6px 0 14px;
}
.look-description strong {
  color: var(--color-text-primary);
  font-size: 12px;
}
.slider-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin: 10px 0 0;
}
.slider-label span {
  color: var(--color-accent-coral);
  font-variant-numeric: tabular-nums;
}
input[type='range'] {
  width: 100%;
  height: 30px;
  accent-color: var(--color-accent-coral);
  cursor: pointer;
}
.text-entry {
  width: 100%;
  resize: vertical;
  max-height: 130px;
  min-height: 65px;
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-deep);
  padding: 12px;
  font-size: 16px;
  outline-color: var(--color-accent-coral);
  margin-bottom: 12px;
}
.font-strip button {
  flex-shrink: 0;
  min-height: 42px;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--color-border-default);
}
.font-strip button.active {
  border-color: var(--color-accent-coral);
  color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
}
.text-options {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.style-choices,
.align-choices {
  display: flex;
  gap: 3px;
}
.style-choices button,
.align-choices button {
  min-height: 38px;
  min-width: 34px;
  padding: 8px;
  font-size: 11px;
  border: 1px solid var(--color-border-default);
}
.align-choices button {
  display: grid;
  place-items: center;
}
.style-choices button.active,
.align-choices button.active {
  background: var(--color-bg-elevated);
  color: var(--color-accent-coral);
  border-color: var(--color-accent-coral);
}
.color-swatches {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px 12px;
}
.color-swatches > button {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border-default);
  border-radius: 50%;
}
.color-swatches > button.active {
  outline: 2px solid var(--color-accent-coral);
  outline-offset: 3px;
}
.custom-color {
  position: relative;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border-default);
  border-radius: 50%;
  overflow: hidden;
}
.custom-color input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.text-sliders {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.text-bottom,
.crop-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 10px;
  color: var(--color-text-dim);
}
.delete-text,
.crop-bottom button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 40px;
  padding: 8px;
  color: var(--color-accent-coral);
  font-size: 11px;
}
.ratio-choices {
  display: flex;
  gap: 8px;
  margin: 4px 0 16px;
}
.ratio-choices button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 12px 6px;
  min-height: 44px;
  font-size: 11px;
  border: 1px solid var(--color-border-default);
}
.ratio-choices button.active {
  border-color: var(--color-accent-coral);
  color: var(--color-accent-coral);
  background: var(--color-bg-elevated);
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-accent-sky);
  outline-offset: 3px;
}
@keyframes sheet-up {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
@media (min-width: 700px) {
  .studio-app {
    padding: 24px;
  }
  .camera-phone {
    height: min(900px, calc(100dvh - 48px));
    border: 1px solid var(--color-border-default);
  }
  .editor-sheet {
    bottom: 24px;
  }
}
@media (max-height: 650px) {
  .app-top {
    height: 52px;
  }
  .camera-dock {
    padding-top: 8px;
  }
  .shutter-row {
    margin-top: 4px;
  }
  .shutter,
  .new-shot {
    width: 54px;
    height: 54px;
  }
  .dock-hint {
    margin-top: 5px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .editor-sheet[open],
  .animate-spin {
    animation: none;
  }
}
</style>
