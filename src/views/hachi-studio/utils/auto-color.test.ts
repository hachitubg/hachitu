import { describe, expect, it } from 'vitest'
import { analyzeColor } from './auto-color'
function pixels(r: number, g: number, b: number, a = 255) {
  const data = new Uint8ClampedArray(100 * 4)
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, a], i)
  return data
}
describe('Conservative automatic color correction', () => {
  it('protects bright faces in scenes dominated by dark clothing', () => {
    const data = pixels(30, 40, 60)
    for (let i = 240; i < data.length; i += 4) data.set([235, 235, 235, 255], i)
    const result = analyzeColor(data).adjustments
    expect(result.exposure).toBeLessThanOrEqual(0.1)
    expect(result.shadows).toBeGreaterThan(0)
    expect(result.highlights).toBeLessThanOrEqual(0)
  })
  it('brightens dark images and reduces excessive brightness', () => {
    expect(analyzeColor(pixels(40, 40, 40)).adjustments.exposure).toBeGreaterThan(0)
    expect(analyzeColor(pixels(220, 220, 220)).adjustments.exposure).toBeLessThan(0)
  })
  it('keeps neutral gray neutral and does not invent contrast in flat photos', () => {
    const result = analyzeColor(pixels(128, 128, 128))
    expect(result.adjustments.warmth).toBe(0)
    expect(result.adjustments.tint).toBe(0)
    expect(result.adjustments.contrast).toBe(0)
  })
  it('preserves saturated scenes without treating them as a white reference', () => {
    const result = analyzeColor(pixels(200, 70, 25))
    expect(result.adjustments.warmth).toBe(0)
    expect(result.adjustments.tint).toBe(0)
  })
  it('ignores transparent pixels and rejects an entirely empty cutout', () => {
    expect(() => analyzeColor(pixels(0, 0, 0, 0))).toThrow('Ảnh không có')
  })
})
