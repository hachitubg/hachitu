import { describe, expect, it } from 'vitest'
import {
  applyEffectRecipe,
  defaultEffects,
  effectPresets,
  hasEffects,
  normalizeEffectSearch,
  effectGroups,
} from './effects'
import type { FxCanvas } from './effects'
function recorder() {
  const calls: Array<{ name: string; args: number[] }> = []
  const names = [
    'triangleBlur',
    'brightnessContrast',
    'hueSaturation',
    'sepia',
    'noise',
    'vignette',
    'ink',
    'dotScreen',
    'colorHalftone',
    'hexagonalPixelate',
    'swirl',
    'bulgePinch',
    'zoomBlur',
    'tiltShift',
    'unsharpMask',
    'denoise',
    'lensBlur',
    'edgeWork',
    'vibrance',
    'curves',
  ]
  const methods = Object.fromEntries(
    names.map((name) => [
      name,
      (...args: (number | number[][])[]) => {
        calls.push({ name, args: args.flatMap((arg) => (Array.isArray(arg) ? arg.flat() : [arg])) })
        return fx
      },
    ]),
  )
  const fx = document.createElement('canvas') as FxCanvas
  Object.assign(fx, methods)
  return { fx, calls }
}
describe('upstream glfx.js effect recipes', () => {
  it('provides 32 unique effects, searchable with Vietnamese accents removed', () => {
    expect(effectPresets.length - 1).toBe(32)
    expect(new Set(effectPresets.map((p) => p.id)).size).toBe(effectPresets.length)
    expect(normalizeEffectSearch('  ÂM BẢN ĐẸP  ')).toBe('am ban dep')
    expect(effectGroups).toContain('Nghệ thuật')
  })
  it('defaults are non-destructive and do not trigger any filter', () => {
    const { fx, calls } = recorder(),
      settings = defaultEffects()
    expect(hasEffects(settings)).toBe(false)
    applyEffectRecipe(fx, settings, 720, 960)
    expect(calls).toEqual([])
  })
  it.each(effectPresets.filter((p) => p.id !== 'none'))(
    '$id delegates to real glfx filter names with finite bounded parameters',
    (preset) => {
      const { fx, calls } = recorder(),
        settings = { ...defaultEffects(), effect: preset.id }
      applyEffectRecipe(fx, settings, 720, 960)
      expect(hasEffects(settings)).toBe(true)
      expect(calls.length).toBeGreaterThan(0)
      expect(calls.every((c) => c.args.every(Number.isFinite))).toBe(true)
    },
  )
  it('zero effect amount bypasses the artistic filter but keeps independent sharpening', () => {
    const { fx, calls } = recorder()
    applyEffectRecipe(
      fx,
      { ...defaultEffects(), effect: 'swirl', amount: 0, sharpness: 35 },
      720,
      960,
    )
    expect(calls.map((c) => c.name)).toEqual(['unsharpMask'])
  })
  it('denoises before artistic effects and sharpens last, with spatial radii scaled for export', () => {
    const a = recorder(),
      b = recorder(),
      s = { ...defaultEffects(), effect: 'sepia' as const, sharpness: 35, denoise: 20 }
    applyEffectRecipe(a.fx, s, 720, 960)
    applyEffectRecipe(b.fx, s, 1440, 1920)
    expect(a.calls.map((c) => c.name)).toEqual(['denoise', 'sepia', 'unsharpMask'])
    expect(b.calls[2]!.args[0]).toBe(a.calls[2]!.args[0]! * 2)
    expect(b.calls[2]!.args[1]).toBe(a.calls[2]!.args[1])
  })
  it('clamps invalid external values instead of sending NaN or huge strengths to WebGL', () => {
    const { fx, calls } = recorder()
    applyEffectRecipe(
      fx,
      {
        ...defaultEffects(),
        effect: 'bulge',
        amount: 900,
        scale: -4,
        centerX: NaN,
        centerY: 200,
        sharpness: 500,
      },
      720,
      960,
    )
    expect(calls[0]).toEqual({ name: 'bulgePinch', args: [0, 960, 108, 0.8] })
    expect(calls[calls.length - 1]!.args[1]).toBe(2)
  })
})
