import { describe, expect, it } from 'vitest'
import { panFraming } from './crop'
describe('Crop drag gestures', () => {
  it('moves the photo with the pointer, regardless of where the drag begins', () => {
    const result = panFraming({ zoom: 2, x: 0, y: 0 }, 30, 20, 300, 400, 0.75, 0.75)
    expect(result.x).toBeCloseTo(-0.2)
    expect(result.y).toBeCloseTo(-0.1)
  })
  it('clamps dragging at the image edges without exposing empty areas', () => {
    const result = panFraming({ zoom: 2, x: 0, y: 0 }, 999, -999, 300, 400, 0.75, 0.75)
    expect(result.x).toBe(-1)
    expect(result.y).toBe(1)
  })
  it('locks an axis when the whole image already fits at native scale', () => {
    expect(panFraming({ zoom: 1, x: 0, y: 0 }, 20, 30, 300, 400, 0.75, 0.75)).toEqual({
      zoom: 1,
      x: 0,
      y: 0,
    })
  })
})
