import { NEUTRAL_COLOR } from './color'
import type { ColorAdjustments } from './color'
export interface AutoColorResult {
  adjustments: ColorAdjustments
  brightness: number
  neutralPixels: number
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export function analyzeColor(data: Uint8ClampedArray): AutoColorResult {
  const histogram = new Uint32Array(256)
  let count = 0,
    saturation = 0,
    neutral = 0,
    red = 0,
    green = 0,
    blue = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue
    const r = data[i]! / 255,
      g = data[i + 1]! / 255,
      b = data[i + 2]! / 255
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b,
      high = Math.max(r, g, b),
      low = Math.min(r, g, b)
    const s = high > 0 ? (high - low) / high : 0
    histogram[Math.round(l * 255)]!++
    count++
    saturation += s
    if (s < 0.18 && l > 0.12 && l < 0.9) {
      neutral++
      red += r
      green += g
      blue += b
    }
  }
  if (!count) throw new Error('Ảnh không có vùng đủ rõ để cân màu.')
  function percentile(f: number) {
    let sum = 0
    for (let i = 0; i < 256; i++) {
      sum += histogram[i]!
      if (sum >= Math.max(1, count * f)) return i / 255
    }
    return 1
  }
  const median = percentile(0.5),
    high = percentile(0.95),
    range = high - percentile(0.05)
  const adjustments: ColorAdjustments = { ...NEUTRAL_COLOR }
  adjustments.exposure =
    Math.round(clamp(Math.log2(0.48 / Math.max(0.03, median)) * 0.55, -0.75, 0.85) * 20) / 20
  const headroom = Math.max(0, Math.log2(0.9 / Math.max(0.03, high)))
  if (adjustments.exposure > 0)
    adjustments.exposure = Math.floor(Math.min(adjustments.exposure, headroom) * 20) / 20
  adjustments.shadows = range > 0.2 ? Math.round(clamp((0.35 - median) * 100, 0, 22)) : 0
  adjustments.highlights = Math.round(clamp((0.9 - high) * 100, -18, 0))
  adjustments.contrast = range > 0.08 ? Math.round(clamp((0.65 / range - 1) * 25, -15, 25)) : 0
  adjustments.saturation = Math.round(clamp((0.22 - saturation / count) * 45, -12, 12))
  if (neutral > Math.max(8, count * 0.025)) {
    adjustments.warmth = Math.round(clamp(((blue - red) / neutral) * 220, -28, 28))
    adjustments.tint = Math.round(clamp(((green - (red + blue) / 2) / neutral) * 240, -20, 20))
  }
  return { adjustments, brightness: median, neutralPixels: neutral }
}
