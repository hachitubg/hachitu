import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { createGlobalState, useEventListener, useScriptTag } from '@vueuse/core'
import type { FxCanvas, FxTexture, PhotoEffects } from '../utils/effects'
import { applyEffectRecipe, hasEffects } from '../utils/effects'
declare global {
  interface Window {
    fx?: { canvas(): FxCanvas }
  }
}
const useFxLoader = createGlobalState(() => {
  const { load } = useScriptTag('/hachi-studio/vendor/glfx/glfx.js', undefined, { manual: true })
  return async () => {
    if (!window.fx) await load()
    if (!window.fx) throw new Error('Không tải được thư viện hiệu ứng. Hãy tải lại trang.')
  }
})
export function usePhotoEffects() {
  const load = useFxLoader(),
    engine = shallowRef<FxCanvas>()
  const loading = ref(false),
    error = ref('')
  const ready = computed(() => !!engine.value && !error.value)
  let texture: FxTexture | undefined,
    pending: Promise<boolean> | undefined,
    disposed = false
  async function start() {
    if (ready.value) return true
    if (pending) return pending
    if (engine.value) release()
    loading.value = true
    error.value = ''
    pending = (async () => {
      try {
        await load()
        if (disposed) return false
        engine.value = window.fx!.canvas()
        return true
      } catch {
        error.value =
          'Thiết bị chưa chạy được WebGL hiệu ứng. Bạn vẫn có thể chỉnh màu, chữ và crop.'
        return false
      } finally {
        loading.value = false
        pending = undefined
      }
    })()
    return pending
  }
  function apply(source: HTMLCanvasElement, target: HTMLCanvasElement, settings: PhotoEffects) {
    if (!hasEffects(settings)) return false
    const fx = engine.value
    if (!fx || !ready.value) return false
    try {
      const gl = fx._.gl
      if (gl.isContextLost()) throw new Error('WebGL context lost')
      const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      if (source.width > limit || source.height > limit)
        throw new Error('Image exceeds texture limit')
      if (texture) texture.loadContentsOf(source)
      else texture = fx.texture(source)
      fx.draw(texture)
      applyEffectRecipe(fx, settings, source.width, source.height)
      fx.update()
      if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL filter failed')
      if (target.width !== source.width) target.width = source.width
      if (target.height !== source.height) target.height = source.height
      const ctx = target.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.clearRect(0, 0, target.width, target.height)
      const blend =
        ['mono', 'comic', 'magazine'].includes(settings.effect) && settings.amount > 0
          ? Math.max(0, Math.min(1, settings.amount / 100))
          : 1
      if (blend < 1) ctx.drawImage(source, 0, 0)
      ctx.globalAlpha = blend
      ctx.drawImage(fx, 0, 0)
      ctx.globalAlpha = 1
      return true
    } catch {
      error.value =
        'Không xử lý được hiệu ứng trên thiết bị này. Hãy tắt hiệu ứng hoặc thử lại trước khi lưu ảnh.'
      return false
    }
  }
  useEventListener(engine, 'webglcontextlost', (event: Event) => {
    if (event.target !== engine.value || disposed) return
    event.preventDefault()
    error.value = 'Bộ xử lý ảnh đã tạm dừng. Bấm Thử lại hoặc tắt hiệu ứng.'
  })
  function release() {
    texture?.destroy()
    texture = undefined
    const old = engine.value
    engine.value = undefined
    old?._.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  async function retry() {
    release()
    return start()
  }
  onScopeDispose(() => {
    disposed = true
    release()
  })
  return { start, apply, retry, ready, loading, error }
}
