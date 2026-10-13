import { onScopeDispose, reactive, ref, shallowRef } from 'vue'

interface Point {
  x: number
  y: number
  z: number
}
interface FaceEngine {
  detect(source: HTMLCanvasElement | HTMLImageElement): { faceLandmarks: Point[][] }
  close(): void
}
interface VisionModule {
  FilesetResolver: {
    forVisionTasks(path: string): Promise<{ wasmLoaderPath: string; wasmBinaryPath: string }>
  }
  FaceLandmarker: {
    createFromOptions(
      files: { wasmLoaderPath: string; wasmBinaryPath: string },
      options: {
        baseOptions: { modelAssetPath: string; delegate: string }
        runningMode: string
        numFaces: number
      },
    ): Promise<FaceEngine>
  }
}
export interface MakeupSettings {
  enabled: boolean
  smooth: number
  brighten: number
  slim: number
  lipstick: number
  blush: number
  lipColor: string
  blushColor: string
}
export interface FaceMask {
  mask: HTMLCanvasElement
  cheeks: [number, number, number, number]
  radius: number
}
export interface MakeupEffect {
  settings: MakeupSettings
  face: FaceMask
}

const DEFAULTS: MakeupSettings = {
  enabled: true,
  smooth: 0,
  brighten: 0,
  slim: 0,
  lipstick: 0,
  blush: 0,
  lipColor: '#b6414a',
  blushColor: '#d87b78',
}
const OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]
const LEFT_EYE = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380]
const LIPS = [61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91]
const INNER_LIPS = [78, 81, 13, 311, 308, 402, 14, 178]

function createMask(points: Point[], source: HTMLCanvasElement | HTMLImageElement): FaceMask {
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const scale = Math.min(1, 768 / Math.max(width, height))
  const mask = document.createElement('canvas')
  mask.width = Math.round(width * scale)
  mask.height = Math.round(height * scale)
  const ctx = mask.getContext('2d')
  if (!ctx) throw new Error('Không tạo được vùng trang điểm.')
  const polygon = (indices: number[], color: string) => {
    ctx.beginPath()
    indices.forEach((index, i) => {
      const p = points[index]
      if (p) {
        if (!i) ctx.moveTo(p.x * mask.width, p.y * mask.height)
        else ctx.lineTo(p.x * mask.width, p.y * mask.height)
      }
    })
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, mask.width, mask.height)
  polygon(OVAL, '#ff0000')
  polygon(LEFT_EYE, '#000000')
  polygon(RIGHT_EYE, '#000000')
  polygon(LIPS, '#000000')
  polygon(LIPS, '#00ff00')
  polygon(INNER_LIPS, '#000000')
  const left = points[132]
  const right = points[361]
  if (!left || !right) throw new Error('Không xác định được đường nét khuôn mặt.')
  const radius = Math.max(0.02, Math.hypot(right.x - left.x, right.y - left.y) * 0.24)
  ctx.globalCompositeOperation = 'lighter'
  for (const index of [50, 280]) {
    const p = points[index]
    if (!p) continue
    const x = p.x * mask.width
    const y = p.y * mask.height
    const r = radius * mask.width
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, 'rgba(0,0,255,.9)')
    gradient.addColorStop(1, 'rgba(0,0,255,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  return { mask, cheeks: [left.x, 1 - left.y, right.x, 1 - right.y], radius }
}

export function useMakeup() {
  const settings = reactive<MakeupSettings>({ ...DEFAULTS })
  const face = shallowRef<FaceMask>()
  const status = ref<'idle' | 'loading' | 'ready' | 'no-face' | 'error'>('idle')
  const message = ref('')
  let engine: FaceEngine | undefined
  let loadingEngine: Promise<FaceEngine> | undefined
  let version = 0
  let disposed = false
  async function loadEngine() {
    if (engine) return engine
    if (!loadingEngine)
      loadingEngine = (async () => {
        const base = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21'
        const vision: VisionModule = await import(/* @vite-ignore */ `${base}/vision_bundle.mjs`)
        const files = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`)
        const result = await vision.FaceLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          numFaces: 1,
        })
        if (disposed) {
          result.close()
          throw new Error('Đã đóng Studio.')
        }
        engine = result
        return result
      })().catch((reason) => {
        loadingEngine = undefined
        throw reason
      })
    return loadingEngine
  }
  async function detect(source: HTMLCanvasElement | HTMLImageElement) {
    if (status.value === 'loading') return
    const request = ++version
    status.value = 'loading'
    message.value = ''
    face.value = undefined
    try {
      const model = await loadEngine()
      if (request !== version || disposed) return
      // Detection is run once per photo on a downscaled copy, never on camera frames.
      const input = document.createElement('canvas')
      const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width
      const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height
      const scale = Math.min(1, 1024 / Math.max(width, height))
      input.width = Math.round(width * scale)
      input.height = Math.round(height * scale)
      input.getContext('2d')?.drawImage(source, 0, 0, input.width, input.height)
      const points = model.detect(input).faceLandmarks[0]
      if (!points) {
        status.value = 'no-face'
        message.value = 'Chưa thấy khuôn mặt. Hãy chọn ảnh chân dung rõ, đủ sáng.'
        return
      }
      face.value = createMask(points, source)
      settings.enabled = true
      status.value = 'ready'
      message.value = 'Đã nhận diện khuôn mặt. Chọn mức độ bạn thích.'
    } catch {
      if (request === version && !disposed) {
        status.value = 'error'
        message.value = 'Chưa tải được Makeup. Kiểm tra mạng rồi thử lại.'
      }
    }
  }
  function reset() {
    version++
    face.value = undefined
    status.value = 'idle'
    message.value = ''
    Object.assign(settings, DEFAULTS)
  }
  function resetLevels() {
    Object.assign(settings, DEFAULTS)
  }
  function natural() {
    Object.assign(settings, {
      enabled: true,
      smooth: 25,
      brighten: 10,
      slim: 8,
      lipstick: 18,
      blush: 15,
    })
  }
  onScopeDispose(() => {
    disposed = true
    version++
    engine?.close()
  })
  return { settings, face, status, message, detect, reset, resetLevels, natural }
}
