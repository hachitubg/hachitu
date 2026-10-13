export interface FrameCell {
  x: number
  y: number
  w: number
  h: number
}
export interface CollageLayout {
  id: string
  name: string
  cells: FrameCell[]
}
const cell = (x: number, y: number, w: number, h: number): FrameCell => ({ x, y, w, h })
function rows(count: number) {
  return Array.from({ length: count }, (_, i) => cell(0, i / count, 1, 1 / count))
}
function columns(count: number) {
  return Array.from({ length: count }, (_, i) => cell(i / count, 0, 1 / count, 1))
}
export const collageLayouts: CollageLayout[] = [
  { id: 'two-rows', name: '2 · Trên dưới', cells: rows(2) },
  { id: 'two-columns', name: '2 · Song song', cells: columns(2) },
  { id: 'two-banner', name: '2 · Panorama', cells: [cell(0, 0, 1, 0.7), cell(0, 0.7, 1, 0.3)] },
  { id: 'two-side', name: '2 · Editorial', cells: [cell(0, 0, 0.65, 1), cell(0.65, 0, 0.35, 1)] },
  { id: 'three-rows', name: '3 · Photobooth', cells: rows(3) },
  { id: 'three-columns', name: '3 · Triptych', cells: columns(3) },
  {
    id: 'three-top',
    name: '3 · Hero trên',
    cells: [cell(0, 0, 1, 0.6), cell(0, 0.6, 0.5, 0.4), cell(0.5, 0.6, 0.5, 0.4)],
  },
  {
    id: 'three-bottom',
    name: '3 · Hero dưới',
    cells: [cell(0, 0, 0.5, 0.4), cell(0.5, 0, 0.5, 0.4), cell(0, 0.4, 1, 0.6)],
  },
  {
    id: 'three-left',
    name: '3 · Bìa tạp chí',
    cells: [cell(0, 0, 0.6, 1), cell(0.6, 0, 0.4, 0.5), cell(0.6, 0.5, 0.4, 0.5)],
  },
  {
    id: 'three-right',
    name: '3 · Nhật ký',
    cells: [cell(0, 0, 0.4, 0.5), cell(0, 0.5, 0.4, 0.5), cell(0.4, 0, 0.6, 1)],
  },
  {
    id: 'four-grid',
    name: '4 · Ô vuông',
    cells: [
      cell(0, 0, 0.5, 0.5),
      cell(0.5, 0, 0.5, 0.5),
      cell(0, 0.5, 0.5, 0.5),
      cell(0.5, 0.5, 0.5, 0.5),
    ],
  },
  { id: 'four-rows', name: '4 · Photo strip', cells: rows(4) },
  { id: 'four-columns', name: '4 · Contact sheet', cells: columns(4) },
  {
    id: 'four-top',
    name: '4 · Spotlight',
    cells: [
      cell(0, 0, 1, 0.6),
      cell(0, 0.6, 1 / 3, 0.4),
      cell(1 / 3, 0.6, 1 / 3, 0.4),
      cell(2 / 3, 0.6, 1 / 3, 0.4),
    ],
  },
  {
    id: 'four-left',
    name: '4 · Fashion',
    cells: [
      cell(0, 0, 0.6, 1),
      cell(0.6, 0, 0.4, 1 / 3),
      cell(0.6, 1 / 3, 0.4, 1 / 3),
      cell(0.6, 2 / 3, 0.4, 1 / 3),
    ],
  },
  {
    id: 'four-mosaic',
    name: '4 · Mosaic',
    cells: [
      cell(0, 0, 0.6, 0.6),
      cell(0.6, 0, 0.4, 0.6),
      cell(0, 0.6, 0.4, 0.4),
      cell(0.4, 0.6, 0.6, 0.4),
    ],
  },
]
