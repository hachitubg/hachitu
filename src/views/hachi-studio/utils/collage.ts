import type { Framing } from './crop'
import type { FrameCell } from '../data/collage'
export interface FrameDivider {
  axis: 'x' | 'y'
  position: number
  start: number
  end: number
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.00001

export function frameDividers(cells: FrameCell[]): FrameDivider[] {
  const edges: FrameDivider[] = []
  for (const a of cells)
    for (const b of cells) {
      if (a === b) continue
      if (near(a.x + a.w, b.x)) {
        const start = Math.max(a.y, b.y),
          end = Math.min(a.y + a.h, b.y + b.h)
        if (end > start + 0.00001) edges.push({ axis: 'x', position: b.x, start, end })
      }
      if (near(a.y + a.h, b.y)) {
        const start = Math.max(a.x, b.x),
          end = Math.min(a.x + a.w, b.x + b.w)
        if (end > start + 0.00001) edges.push({ axis: 'y', position: b.y, start, end })
      }
    }
  const result: FrameDivider[] = []
  for (const edge of edges.sort((a, b) => a.position - b.position || a.start - b.start)) {
    const shared = result.find(
      (item) =>
        item.axis === edge.axis &&
        near(item.position, edge.position) &&
        edge.start <= item.end + 0.00001 &&
        edge.end >= item.start - 0.00001,
    )
    if (shared) {
      shared.start = Math.min(shared.start, edge.start)
      shared.end = Math.max(shared.end, edge.end)
    } else result.push({ ...edge })
  }
  return result
}

export function resizeFrames(
  cells: FrameCell[],
  divider: FrameDivider,
  position: number,
): FrameCell[] {
  const axis = divider.axis,
    size = axis === 'x' ? 'w' : 'h',
    other = axis === 'x' ? 'y' : 'x',
    otherSize = axis === 'x' ? 'h' : 'w'
  const touches = (cell: FrameCell) =>
    cell[other] < divider.end - 0.00001 && cell[other] + cell[otherSize] > divider.start + 0.00001
  let min = 0,
    max = 1
  for (const cell of cells) {
    if (!touches(cell)) continue
    if (near(cell[axis] + cell[size], divider.position)) min = Math.max(min, cell[axis] + 0.12)
    if (near(cell[axis], divider.position)) max = Math.min(max, cell[axis] + cell[size] - 0.12)
  }
  const delta = Math.max(min, Math.min(max, position)) - divider.position
  return cells.map((cell) => {
    const next = { ...cell }
    if (!touches(cell)) return next
    if (near(cell[axis] + cell[size], divider.position)) next[size] += delta
    else if (near(cell[axis], divider.position)) {
      next[axis] += delta
      next[size] -= delta
    }
    return next
  })
}
export function frameRect(
  cell: FrameCell,
  width: number,
  height: number,
  gap: number,
  border: number,
) {
  const w = width - border * 2,
    h = height - border * 2
  const left = cell.x === 0 ? 0 : gap / 2
  const top = cell.y === 0 ? 0 : gap / 2
  const right = cell.x + cell.w >= 0.999 ? 0 : gap / 2
  const bottom = cell.y + cell.h >= 0.999 ? 0 : gap / 2
  return {
    x: border + cell.x * w + left,
    y: border + cell.y * h + top,
    w: Math.max(1, cell.w * w - left - right),
    h: Math.max(1, cell.h * h - top - bottom),
  }
}
export function sourceRect(width: number, height: number, ratio: number, framing: Framing) {
  const w = Math.min(width, height * ratio) / framing.zoom
  const h = w / ratio
  return { x: ((width - w) * (framing.x + 1)) / 2, y: ((height - h) * (framing.y + 1)) / 2, w, h }
}
