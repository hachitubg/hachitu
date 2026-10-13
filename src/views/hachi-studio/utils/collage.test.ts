import { describe, expect, it } from 'vitest'
import { collageLayouts } from '../data/collage'
import { frameRect, sourceRect, frameDividers, resizeFrames } from './collage'

describe('collage layouts and framing', () => {
  it('resizes equal rows together without changing the outer bounds', () => {
    const cells = collageLayouts[0]!.cells
    const divider = frameDividers(cells)[0]!
    const resized = resizeFrames(cells, divider, 0.7)
    expect(resized[0]!.h).toBeCloseTo(0.7)
    expect(resized[1]!.y).toBeCloseTo(0.7)
    expect(resized[1]!.h).toBeCloseTo(0.3)
    expect(cells[0]!.h).toBe(0.5)
  })
  it('preserves coverage and avoids overlaps when every layout divider moves', () => {
    for (const layout of collageLayouts)
      for (const divider of frameDividers(layout.cells))
        for (const position of [-1, 0.25, 0.75, 2]) {
          const cells = resizeFrames(layout.cells, divider, position)
          expect(cells.reduce((area, cell) => area + cell.w * cell.h, 0)).toBeCloseTo(1)
          cells.forEach((cell, i) => {
            expect(cell.w).toBeGreaterThanOrEqual(0.119999)
            expect(cell.h).toBeGreaterThanOrEqual(0.119999)
            expect(cell.x).toBeGreaterThanOrEqual(-0.000001)
            expect(cell.y).toBeGreaterThanOrEqual(-0.000001)
            expect(cell.x + cell.w).toBeLessThanOrEqual(1.000001)
            expect(cell.y + cell.h).toBeLessThanOrEqual(1.000001)
            for (const other of cells.slice(i + 1)) {
              const overlap =
                Math.max(
                  0,
                  Math.min(cell.x + cell.w, other.x + other.w) - Math.max(cell.x, other.x),
                ) *
                Math.max(
                  0,
                  Math.min(cell.y + cell.h, other.y + other.h) - Math.max(cell.y, other.y),
                )
              expect(overlap).toBeCloseTo(0)
            }
          })
        }
  })
  it('resizes a local mosaic split without changing the other row', () => {
    const cells = collageLayouts.find((item) => item.id === 'four-mosaic')!.cells
    const divider = frameDividers(cells).find((item) => item.axis === 'x' && item.start === 0)!
    const next = resizeFrames(cells, divider, 0.7)
    expect(next[2]).toEqual(cells[2])
    expect(next[3]).toEqual(cells[3])
    expect(next[0]!.w).toBeCloseTo(0.7)
  })
  it('covers the canvas without overlapping cells in every layout', () => {
    for (const layout of collageLayouts) {
      expect(layout.cells.length).toBeGreaterThanOrEqual(2)
      expect(layout.cells.length).toBeLessThanOrEqual(4)
      expect(layout.cells.reduce((area, cell) => area + cell.w * cell.h, 0)).toBeCloseTo(1)
      layout.cells.forEach((cell, i) => {
        expect(cell.x + cell.w).toBeLessThanOrEqual(1.000001)
        expect(cell.y + cell.h).toBeLessThanOrEqual(1.000001)
        for (const other of layout.cells.slice(i + 1)) {
          const intersection =
            Math.max(0, Math.min(cell.x + cell.w, other.x + other.w) - Math.max(cell.x, other.x)) *
            Math.max(0, Math.min(cell.y + cell.h, other.y + other.h) - Math.max(cell.y, other.y))
          expect(intersection).toBeCloseTo(0)
        }
      })
    }
  })
  it('scales preview spacing exactly for export', () => {
    const cell = collageLayouts[10]!.cells[0]!
    const preview = frameRect(cell, 360, 640, 8, 16)
    const output = frameRect(cell, 1080, 1920, 24, 48)
    expect(output.x).toBe(preview.x * 3)
    expect(output.y).toBe(preview.y * 3)
    expect(output.w).toBe(preview.w * 3)
    expect(output.h).toBe(preview.h * 3)
  })
  it('keeps crops inside source at every pan edge and zoom', () => {
    for (const ratio of [0.2, 1, 4])
      for (const zoom of [1, 2, 4])
        for (const x of [-1, 0, 1]) {
          const crop = sourceRect(1200, 800, ratio, { zoom, x, y: x })
          expect(crop.x).toBeGreaterThanOrEqual(0)
          expect(crop.y).toBeGreaterThanOrEqual(0)
          expect(crop.x + crop.w).toBeLessThanOrEqual(1200.000001)
          expect(crop.y + crop.h).toBeLessThanOrEqual(800.000001)
          expect(crop.w / crop.h).toBeCloseTo(ratio)
        }
  })
})
