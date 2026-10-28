import { mount } from '@vue/test-utils'
import { defineComponent, h, reactive, ref, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useTextTransform, clampTextSize } from './useTextTransform'
import type { Decorations, TextBounds } from '../utils/decorations'

describe('direct text transforms', () => {
  async function setup() {
    const text = reactive<Decorations>({
      text: 'Đà Lạt',
      font: 'classic',
      style: 'plain',
      color: '#fffaf4',
      align: 'center',
      opacity: 100,
      size: 6,
      x: 0.5,
      y: 0.5,
    })
    const canvas = ref<HTMLCanvasElement>()
    const bounds = ref<TextBounds>({ x: 50, y: 50, width: 100, height: 100 })
    const editable = ref(true)
    let transform: ReturnType<typeof useTextTransform>
    const wrapper = mount(
      defineComponent({
        setup() {
          transform = useTextTransform(canvas, bounds, text, editable)
          return () => h('canvas', { ref: canvas, width: 200, height: 200 })
        },
      }),
    )
    await nextTick()
    const el = canvas.value!
    el.setPointerCapture = vi.fn()
    el.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    function pointer(type: string, id: number, x: number, y: number) {
      const event = new MouseEvent(type, {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: 'touch' } })
      el.dispatchEvent(event)
    }
    return {
      text,
      editable,
      wrapper,
      el,
      pointer,
      get transform() {
        return transform!
      },
    }
  }
  it('moves text in normalized image coordinates and ignores unrelated pointers', async () => {
    const s = await setup()
    s.pointer('pointerdown', 1, 100, 100)
    s.pointer('pointermove', 2, 150, 150)
    expect(s.text.x).toBe(0.5)
    s.pointer('pointermove', 1, 140, 120)
    expect(s.text.x).toBeCloseTo(0.7)
    expect(s.text.y).toBeCloseTo(0.6)
    s.pointer('pointerup', 1, 140, 120)
    s.pointer('pointermove', 1, 180, 180)
    expect(s.text.x).toBeCloseTo(0.7)
    s.wrapper.unmount()
  })
  it('pinches to scale then rebases the remaining pointer without a jump', async () => {
    const s = await setup()
    s.pointer('pointerdown', 1, 75, 100)
    s.pointer('pointerdown', 2, 125, 100)
    s.pointer('pointermove', 2, 175, 100)
    expect(s.text.size).toBeCloseTo(12)
    s.pointer('pointerup', 2, 175, 100)
    s.pointer('pointermove', 1, 75, 100)
    expect(s.text.x).toBeCloseTo(0.625)
    s.wrapper.unmount()
  })
  it('wheel scales only over text, prevents browser scroll and cleans up on disable/unmount', async () => {
    const s = await setup()
    const wheel = new WheelEvent('wheel', {
      clientX: 100,
      clientY: 100,
      deltaY: -100,
      cancelable: true,
    })
    s.el.dispatchEvent(wheel)
    expect(s.text.size).toBeGreaterThan(6)
    expect(wheel.defaultPrevented).toBe(true)
    const size = s.text.size
    s.editable.value = false
    await nextTick()
    s.el.dispatchEvent(
      new WheelEvent('wheel', { clientX: 100, clientY: 100, deltaY: -100, cancelable: true }),
    )
    expect(s.text.size).toBe(size)
    expect(s.transform.selected.value).toBe(false)
    s.wrapper.unmount()
    expect(clampTextSize(100)).toBe(40)
    expect(clampTextSize(0)).toBe(1)
  })
})
