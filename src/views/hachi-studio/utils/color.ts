export interface ColorAdjustments {
  exposure: number
  contrast: number
  saturation: number
  warmth: number
  tint: number
  fade: number
  sharpness: number
  vignette: number
  shadows: number
  highlights: number
}
export const NEUTRAL_COLOR: ColorAdjustments = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  tint: 0,
  fade: 0,
  sharpness: 0,
  vignette: 0,
  shadows: 0,
  highlights: 0,
}
export const colorControls = [
  { key: 'exposure', label: 'Phơi sáng', min: -2, max: 2, step: 0.05 },
  { key: 'contrast', label: 'Tương phản', min: -50, max: 50, step: 1 },
  { key: 'shadows', label: 'Vùng tối', min: -50, max: 50, step: 1 },
  { key: 'highlights', label: 'Vùng sáng', min: -50, max: 50, step: 1 },
  { key: 'saturation', label: 'Bão hòa', min: -100, max: 100, step: 1 },
  { key: 'warmth', label: 'Ấm / lạnh', min: -100, max: 100, step: 1 },
  { key: 'tint', label: 'Ám xanh / hồng', min: -100, max: 100, step: 1 },
  { key: 'fade', label: 'Phai màu film', min: 0, max: 50, step: 1 },
  { key: 'sharpness', label: 'Sắc nét', min: 0, max: 100, step: 1 },
  { key: 'vignette', label: 'Tối góc', min: 0, max: 100, step: 1 },
] as const
