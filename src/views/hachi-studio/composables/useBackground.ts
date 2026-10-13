import { onScopeDispose, ref, shallowRef } from 'vue'
export interface BackgroundEffect {
  mask: HTMLCanvasElement
  color: string | null
  blur?: number
}
interface SegmentResult {
  confidenceMasks?: Array<{ width: number; height: number; getAsFloat32Array(): Float32Array }>
  close(): void
}
interface SegmentEngine {
  segment(image: HTMLCanvasElement): SegmentResult
  close(): void
}
interface SegmentRuntime {
  FilesetResolver: {
    forVisionTasks(path: string): Promise<{ wasmLoaderPath: string; wasmBinaryPath: string }>
  }
  ImageSegmenter: {
    createFromOptions(
      files: { wasmLoaderPath: string; wasmBinaryPath: string },
      options: {
        baseOptions: { modelAssetPath: string; delegate: string }
        runningMode: string
        outputConfidenceMasks: boolean
        outputCategoryMask: boolean
      },
    ): Promise<SegmentEngine>
  }
}
export function useBackground() {
  const mask = shallowRef<HTMLCanvasElement>()
  const enabled = ref(false)
  const color = ref<string | null>(null)
  const loading = ref(false)
  const message = ref('')
  let engine: SegmentEngine | undefined
  let pending: Promise<SegmentEngine> | undefined
  let version = 0
  let disposed = false
  async function remove(source: HTMLCanvasElement | HTMLImageElement) {
    if (loading.value) return
    const request = ++version
    loading.value = true
    message.value = ''
    try {
      if (!pending)
        pending = (async () => {
          const root = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21'
          const runtime: SegmentRuntime = await import(
            /* @vite-ignore */ `${root}/vision_bundle.mjs`
          )
          const files = await runtime.FilesetResolver.forVisionTasks(`${root}/wasm`)
          const model = await runtime.ImageSegmenter.createFromOptions(files, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            outputConfidenceMasks: true,
            outputCategoryMask: false,
          })
          if (disposed) {
            model.close()
            throw new Error('Studio đã đóng.')
          }
          engine = model
          return model
        })().catch((reason) => {
          pending = undefined
          throw reason
        })
      const model = await pending
      if (disposed || request !== version) return
      const input = document.createElement('canvas')
      const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width
      const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height
      const scale = Math.min(1, 1024 / Math.max(w, h))
      input.width = Math.round(w * scale)
      input.height = Math.round(h * scale)
      input.getContext('2d')?.drawImage(source, 0, 0, input.width, input.height)
      const result = model.segment(input)
      try {
        // The official selfie multiclass model defines channel 0 as background.
        const confidence = result.confidenceMasks?.[0]
        if (!confidence) throw new Error('Không tách được chủ thể.')
        const values = confidence.getAsFloat32Array()
        const output = document.createElement('canvas')
        output.width = confidence.width
        output.height = confidence.height
        const ctx = output.getContext('2d')!
        const pixels = ctx.createImageData(output.width, output.height)
        let foreground = 0
        for (let i = 0; i < values.length; i++) {
          const amount = Math.max(0, Math.min(1, (1 - values[i]! - 0.15) / 0.7))
          if (amount > 0.5) foreground++
          pixels.data[i * 4] =
            pixels.data[i * 4 + 1] =
            pixels.data[i * 4 + 2] =
              Math.round(amount * 255)
          pixels.data[i * 4 + 3] = 255
        }
        if (foreground < values.length * 0.005) {
          message.value = 'Chưa tìm thấy người trong ảnh. Hãy thử ảnh chân dung rõ, đủ sáng.'
          return
        }
        ctx.putImageData(pixels, 0, 0)
        mask.value = output
        enabled.value = true
        message.value = 'Đã tách người khỏi nền. Chọn trong suốt hoặc màu nền.'
      } finally {
        result.close()
      }
    } catch {
      if (request === version && !disposed)
        message.value = 'Chưa xóa được phông. Kiểm tra mạng rồi thử lại.'
    } finally {
      if (request === version) loading.value = false
    }
  }
  function reset() {
    version++
    mask.value = undefined
    enabled.value = false
    loading.value = false
    color.value = null
    message.value = ''
  }
  onScopeDispose(() => {
    disposed = true
    version++
    engine?.close()
  })
  return { mask, enabled, color, loading, message, remove, reset }
}
