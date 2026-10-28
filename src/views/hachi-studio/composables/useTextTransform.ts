import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import type { Decorations, TextBounds } from '../utils/decorations'

export const clampTextSize = (size: number) => Math.max(1, Math.min(40, size))
type Point = { x: number; y: number }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function useTextTransform(
  canvas: Ref<HTMLCanvasElement | undefined>,
  bounds: Ref<TextBounds | undefined>,
  text: Decorations,
  editable: Ref<boolean>,
) {
  const selected = ref(false)
  const pointers = new Map<number, Point>()
  let resize = false
  let origin:
    | { point: Point; distance: number; x: number; y: number; size: number; center: Point }
    | undefined
  const selectionStyle = computed(() => {
    const box = bounds.value,
      el = canvas.value
    if (!box || !el) return {}
    return {
      left: `${(100 * box.x) / el.width}%`,
      top: `${(100 * box.y) / el.height}%`,
      width: `${(100 * box.width) / el.width}%`,
      height: `${(100 * box.height) / el.height}%`,
    }
  })
  function hit(event: PointerEvent | WheelEvent) {
    const el = canvas.value,
      box = bounds.value
    if (!el || !box) return false
    const rect = el.getBoundingClientRect()
    const x = ((event.clientX - rect.left) * el.width) / rect.width
    const y = ((event.clientY - rect.top) * el.height) / rect.height
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
  }
  function rebase() {
    const el = canvas.value,
      box = bounds.value,
      points = [...pointers.values()]
    if (!el || !box || !points[0]) {
      origin = undefined
      return
    }
    const rect = el.getBoundingClientRect()
    const center = {
      x: rect.left + ((box.x + box.width / 2) * rect.width) / el.width,
      y: rect.top + ((box.y + box.height / 2) * rect.height) / el.height,
    }
    origin = {
      point: points[1] ? midpoint(points[0], points[1]) : points[0],
      distance: Math.max(
        8,
        resize ? distance(points[0], center) : points[1] ? distance(points[0], points[1]) : 0,
      ),
      x: text.x,
      y: text.y,
      size: text.size,
      center,
    }
  }
  function start(event: PointerEvent, handle = false) {
    if (!editable.value || !canvas.value || (event.pointerType === 'mouse' && event.button !== 0))
      return
    if (!handle && !pointers.size && !hit(event)) {
      selected.value = false
      return
    }
    if (pointers.size >= 2) return
    selected.value = true
    resize = handle || resize
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    canvas.value.setPointerCapture(event.pointerId)
    rebase()
    event.preventDefault()
  }
  useEventListener(canvas, 'pointerdown', (event) => start(event))
  useEventListener(canvas, 'pointermove', (event: PointerEvent) => {
    if (!editable.value || !pointers.has(event.pointerId) || !origin || !canvas.value) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const [a, b] = [...pointers.values()]
    if (!a) return
    const rect = canvas.value.getBoundingClientRect()
    if (resize || b)
      text.size = clampTextSize(
        (origin.size * (resize ? distance(a, origin.center) : distance(a, b!))) / origin.distance,
      )
    if (!resize) {
      const point = b ? midpoint(a, b) : a
      text.x = Math.max(0, Math.min(1, origin.x + (point.x - origin.point.x) / rect.width))
      text.y = Math.max(0, Math.min(1, origin.y + (point.y - origin.point.y) / rect.height))
    }
    event.preventDefault()
  })
  useEventListener(
    canvas,
    ['pointerup', 'pointercancel', 'lostpointercapture'],
    (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      resize = false
      rebase()
    },
  )
  useEventListener(
    canvas,
    'wheel',
    (event: WheelEvent) => {
      if (!editable.value || !hit(event)) return
      selected.value = true
      text.size = clampTextSize(
        text.size * Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * 0.003),
      )
      event.preventDefault()
    },
    { passive: false },
  )
  watch(editable, (value) => {
    if (!value) {
      pointers.clear()
      origin = undefined
      resize = false
      selected.value = false
    }
  })
  return {
    selected,
    selectionStyle,
    startResize: (event: PointerEvent) => start(event, true),
    resizeBy: (factor: number) => {
      text.size = clampTextSize(text.size * factor)
    },
  }
}
