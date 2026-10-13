import { useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'

export function useMouseScroll(root: Ref<HTMLElement | undefined>) {
  let drag:
    | { element: HTMLElement; x: number; scroll: number; id: number; moved: boolean }
    | undefined
  let suppressClick = false
  useEventListener(root, 'pointerdown', (event: PointerEvent) => {
    suppressClick = false
    if (event.pointerType !== 'mouse' || event.button !== 0 || !(event.target instanceof Element))
      return
    const element = event.target.closest<HTMLElement>('.film-strip,.collection-tabs,.layout-strip')
    if (!element || element.scrollWidth <= element.clientWidth) return
    drag = {
      element,
      x: event.clientX,
      scroll: element.scrollLeft,
      id: event.pointerId,
      moved: false,
    }
    event.preventDefault()
  })
  useEventListener(root, 'dragstart', (event: DragEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest('.film-strip,.collection-tabs,.layout-strip')
    )
      event.preventDefault()
  })
  useEventListener(window, 'pointermove', (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return
    if (Math.abs(event.clientX - drag.x) > 5) drag.moved = true
    if (!drag.moved) return
    drag.element.setPointerCapture(event.pointerId)
    drag.element.scrollLeft = drag.scroll - (event.clientX - drag.x)
    event.preventDefault()
  })
  useEventListener(window, ['pointerup', 'pointercancel'], () => {
    suppressClick = !!drag?.moved
    if (drag?.element.hasPointerCapture(drag.id)) drag.element.releasePointerCapture(drag.id)
    drag = undefined
  })
  useEventListener(
    root,
    'click',
    (event: MouseEvent) => {
      if (!suppressClick) return
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    },
    { capture: true },
  )
}
