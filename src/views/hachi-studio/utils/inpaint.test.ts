import { describe, it, expect } from 'vitest'
import { inpaint } from './inpaint'
describe('Local object removal', () => {
  it('fills a small spot from the background and preserves unmasked pixels', () => {
    const w = 20,
      h = 20,
      data = new Uint8ClampedArray(w * h * 4),
      mask = new Uint8ClampedArray(data.length)
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 50
      data[i * 4 + 1] = 100
      data[i * 4 + 2] = 150
      data[i * 4 + 3] = 255
    }
    const point = 10 * w + 10
    data[point * 4] = 255
    mask[point * 4 + 3] = 255
    const result = inpaint(data, mask, w, h)
    expect(result.slice(point * 4, point * 4 + 4)).toEqual(
      new Uint8ClampedArray([50, 100, 150, 255]),
    )
    expect(result.slice(0, 4)).toEqual(new Uint8ClampedArray([50, 100, 150, 255]))
    expect(data[point * 4]).toBe(255)
  })
  it('rejects an empty mask or an oversized region', () => {
    const data = new Uint8ClampedArray(400)
    expect(() => inpaint(data, new Uint8ClampedArray(400), 10, 10)).toThrow('Hãy tô')
    expect(() => inpaint(data, new Uint8ClampedArray(400).fill(255), 10, 10)).toThrow(
      'Vùng quá lớn',
    )
  })
})
