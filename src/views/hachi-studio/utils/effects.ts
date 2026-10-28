// These are parameter recipes for upstream glfx.js filters, not custom shaders.
export const effectPresets = [
  {
    id: 'none',
    name: 'Không hiệu ứng',
    group: 'Tất cả',
    icon: 'lucide:circle-off',
    hint: 'Giữ màu ảnh hiện tại',
  },
  {
    id: 'miniature',
    name: 'Thành phố tí hon',
    group: 'Phong cảnh',
    icon: 'lucide:building-2',
    hint: 'Tilt-shift, nét ở dải giữa ảnh',
  },
  {
    id: 'dream',
    name: 'Mơ màng',
    group: 'Phong cảnh',
    icon: 'lucide:cloud',
    hint: 'Mềm ánh sáng, giảm tương phản',
  },
  {
    id: 'zoom',
    name: 'Chuyển động',
    group: 'Phong cảnh',
    icon: 'lucide:move-up-right',
    hint: 'Zoom blur từ tâm bạn chọn',
  },
  {
    id: 'lens',
    name: 'Ống kính',
    group: 'Phong cảnh',
    icon: 'lucide:aperture',
    hint: 'Viền tối như ống kính ảnh',
  },
  {
    id: 'sepia',
    name: 'Ảnh xưa',
    group: 'Hoài niệm',
    icon: 'lucide:history',
    hint: 'Sắc sepia ấm cổ điển',
  },
  {
    id: 'grain',
    name: 'Hạt film',
    group: 'Hoài niệm',
    icon: 'lucide:film',
    hint: 'Hạt nhiễu của ảnh film',
  },
  {
    id: 'sunset',
    name: 'Chiều muộn',
    group: 'Hoài niệm',
    icon: 'lucide:sunset',
    hint: 'Sepia nhẹ và viền tối',
  },
  {
    id: 'mono',
    name: 'Báo cũ',
    group: 'Hoài niệm',
    icon: 'lucide:newspaper',
    hint: 'Chấm in báo đơn sắc',
  },
  {
    id: 'ink',
    name: 'Nét mực',
    group: 'Chất chơi',
    icon: 'lucide:pen-tool',
    hint: 'Nhấn đường nét như tranh mực',
  },
  {
    id: 'comic',
    name: 'Comic',
    group: 'Chất chơi',
    icon: 'lucide:palette',
    hint: 'Halftone bốn màu CMYK',
  },
  {
    id: 'pixel',
    name: 'Pixel tổ ong',
    group: 'Chất chơi',
    icon: 'lucide:hexagon',
    hint: 'Chia ảnh thành ô lục giác',
  },
  {
    id: 'swirl',
    name: 'Xoáy',
    group: 'Biến dạng',
    icon: 'lucide:wind',
    hint: 'Xoáy quanh tâm bạn chọn',
  },
  {
    id: 'bulge',
    name: 'Mắt cá',
    group: 'Biến dạng',
    icon: 'lucide:scan-eye',
    hint: 'Phồng ảnh theo ống kính mắt cá',
  },
  {
    id: 'pinch',
    name: 'Hút tâm',
    group: 'Biến dạng',
    icon: 'lucide:shrink',
    hint: 'Thu ảnh về điểm trung tâm',
  },
  {
    id: 'bokeh',
    name: 'Bokeh ống kính',
    group: 'Phong cảnh',
    icon: 'lucide:aperture',
    hint: 'Mờ lục giác bằng Lens Blur',
  },
  {
    id: 'edge',
    name: 'Khắc đường nét',
    group: 'Nghệ thuật',
    icon: 'lucide:scan-line',
    hint: 'Tách đường biên với Edge Work',
  },
  {
    id: 'negative',
    name: 'Âm bản',
    group: 'Nghệ thuật',
    icon: 'lucide:contrast',
    hint: 'Đảo sáng tối như âm bản film',
  },
  {
    id: 'solarize',
    name: 'Solarize',
    group: 'Nghệ thuật',
    icon: 'lucide:eclipse',
    hint: 'Đảo vùng sáng bằng đường cong tone',
  },
  {
    id: 'cyanotype',
    name: 'In xanh Cyanotype',
    group: 'Nghệ thuật',
    icon: 'lucide:stamp',
    hint: 'Bản in đơn sắc xanh lam',
  },
  {
    id: 'coralprint',
    name: 'In hai màu Coral',
    group: 'Nghệ thuật',
    icon: 'lucide:paintbrush',
    hint: 'Duotone nâu và coral',
  },
  {
    id: 'goldprint',
    name: 'Bản in vàng',
    group: 'Nghệ thuật',
    icon: 'lucide:medal',
    hint: 'Đơn sắc vàng trên bóng nâu',
  },
  {
    id: 'vibrant',
    name: 'Rực rỡ tự nhiên',
    group: 'Ánh sáng',
    icon: 'lucide:flower-2',
    hint: 'Vibrance nhấn màu nhạt',
  },
  {
    id: 'noir',
    name: 'Noir tương phản',
    group: 'Ánh sáng',
    icon: 'lucide:moon',
    hint: 'Đen trắng sâu với viền tối',
  },
  {
    id: 'highkey',
    name: 'High-key',
    group: 'Ánh sáng',
    icon: 'lucide:sun',
    hint: 'Sáng mềm theo phong cách studio',
  },
  {
    id: 'lowkey',
    name: 'Low-key',
    group: 'Ánh sáng',
    icon: 'lucide:moon-star',
    hint: 'Giảm sáng và tăng chiều sâu',
  },
  {
    id: 'crossprocess',
    name: 'Cross Process',
    group: 'Hoài niệm',
    icon: 'lucide:flask-conical',
    hint: 'Đường cong RGB kiểu tráng film chéo',
  },
  {
    id: 'bleach',
    name: 'Bleach Contrast',
    group: 'Hoài niệm',
    icon: 'lucide:clapperboard',
    hint: 'Giảm màu, tăng tương phản gắt',
  },
  {
    id: 'filmfade',
    name: 'Film bạc màu',
    group: 'Hoài niệm',
    icon: 'lucide:camera',
    hint: 'Nâng bóng tối, nén sáng và hạt nhẹ',
  },
  {
    id: 'popart',
    name: 'Pop Art',
    group: 'Chất chơi',
    icon: 'lucide:paint-bucket',
    hint: 'Màu bão hòa và nét mực',
  },
  {
    id: 'pencil',
    name: 'Phác thảo chì',
    group: 'Nghệ thuật',
    icon: 'lucide:pencil',
    hint: 'Đường biên đơn sắc bằng Edge Work',
  },
  {
    id: 'magazine',
    name: 'Bản in tạp chí',
    group: 'Chất chơi',
    icon: 'lucide:book-open',
    hint: 'Halftone, nét mực và hạt in',
  },
  {
    id: 'radialink',
    name: 'Tốc độ truyện tranh',
    group: 'Chất chơi',
    icon: 'lucide:zap',
    hint: 'Zoom blur kết hợp nét mực',
  },
] as const
export const effectGroups = [
  'Tất cả',
  ...new Set(effectPresets.map((p) => p.group).filter((g) => g !== 'Tất cả')),
]
export const normalizeEffectSearch = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
export type CurvePoint = [number, number]
const curve = (points: CurvePoint[], amount: number): CurvePoint[] =>
  points.map(([x, y]) => [x, x + (y - x) * amount])
export type EffectId = (typeof effectPresets)[number]['id']
export interface PhotoEffects {
  effect: EffectId
  amount: number
  scale: number
  centerX: number
  centerY: number
  sharpness: number
  sharpenRadius: number
  denoise: number
}
export const defaultEffects = (): PhotoEffects => ({
  effect: 'none',
  amount: 50,
  scale: 35,
  centerX: 50,
  centerY: 50,
  sharpness: 0,
  sharpenRadius: 25,
  denoise: 0,
})
export const hasEffects = (s: PhotoEffects) =>
  (s.effect !== 'none' && s.amount > 0) || s.sharpness > 0 || s.denoise > 0
export interface FxTexture {
  loadContentsOf(source: HTMLCanvasElement): void
  destroy(): void
}
export interface FxCanvas extends HTMLCanvasElement {
  _: { gl: WebGLRenderingContext }
  texture(source: HTMLCanvasElement): FxTexture
  draw(texture: FxTexture): FxCanvas
  update(): FxCanvas
  triangleBlur(radius: number): FxCanvas
  brightnessContrast(brightness: number, contrast: number): FxCanvas
  hueSaturation(hue: number, saturation: number): FxCanvas
  sepia(amount: number): FxCanvas
  noise(amount: number): FxCanvas
  vignette(size: number, amount: number): FxCanvas
  ink(strength: number): FxCanvas
  dotScreen(x: number, y: number, angle: number, size: number): FxCanvas
  colorHalftone(x: number, y: number, angle: number, size: number): FxCanvas
  hexagonalPixelate(x: number, y: number, scale: number): FxCanvas
  swirl(x: number, y: number, radius: number, angle: number): FxCanvas
  bulgePinch(x: number, y: number, radius: number, strength: number): FxCanvas
  zoomBlur(x: number, y: number, strength: number): FxCanvas
  tiltShift(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    blur: number,
    gradient: number,
  ): FxCanvas
  unsharpMask(radius: number, strength: number): FxCanvas
  denoise(exponent: number): FxCanvas
  lensBlur(radius: number, brightness: number, angle: number): FxCanvas
  edgeWork(radius: number): FxCanvas
  vibrance(amount: number): FxCanvas
  curves(red: CurvePoint[], green?: CurvePoint[], blue?: CurvePoint[]): FxCanvas
}
const unit = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100
export type EffectFilters = Pick<
  FxCanvas,
  | 'triangleBlur'
  | 'brightnessContrast'
  | 'hueSaturation'
  | 'sepia'
  | 'noise'
  | 'vignette'
  | 'ink'
  | 'dotScreen'
  | 'colorHalftone'
  | 'hexagonalPixelate'
  | 'swirl'
  | 'bulgePinch'
  | 'zoomBlur'
  | 'tiltShift'
  | 'unsharpMask'
  | 'denoise'
  | 'lensBlur'
  | 'edgeWork'
  | 'vibrance'
  | 'curves'
>
export function applyEffectRecipe(
  fx: EffectFilters,
  s: PhotoEffects,
  width: number,
  height: number,
) {
  const amount = unit(s.amount),
    scale = unit(s.scale),
    pixel = Math.min(width, height) / 720
  const x = unit(s.centerX) * width,
    y = unit(s.centerY) * height
  if (s.denoise > 0) fx.denoise(50 - unit(s.denoise) * 40)
  if (amount > 0)
    switch (s.effect) {
      case 'miniature':
        fx.tiltShift(
          0,
          y,
          width,
          y,
          amount * 24 * pixel,
          Math.max(1, height * (0.08 + scale * 0.6)),
        )
        break
      case 'dream':
        fx.triangleBlur(amount * 6 * pixel).brightnessContrast(amount * 0.06, -amount * 0.18)
        break
      case 'zoom':
        fx.zoomBlur(x, y, amount * 0.35)
        break
      case 'lens':
        fx.vignette(0.2 + scale * 0.65, amount * 0.9)
        break
      case 'sepia':
        fx.sepia(amount)
        break
      case 'grain':
        fx.noise(amount * 0.35)
        break
      case 'sunset':
        fx.sepia(amount * 0.65).vignette(0.4, amount * 0.35)
        break
      case 'mono':
        fx.dotScreen(x, y, 0.5, Math.max(0.5, (1 + scale * 9) * pixel))
        break
      case 'ink':
        fx.ink(amount * 0.55)
        break
      case 'comic':
        fx.colorHalftone(x, y, 0.4, Math.max(0.5, (1 + scale * 9) * pixel))
        break
      case 'pixel':
        fx.hexagonalPixelate(x, y, Math.max(0.5, (1 + amount * 24) * pixel))
        break
      case 'swirl':
        fx.swirl(x, y, Math.min(width, height) * (0.15 + scale * 0.6), amount * 5)
        break
      case 'bulge':
        fx.bulgePinch(x, y, Math.min(width, height) * (0.15 + scale * 0.6), amount * 0.8)
        break
      case 'pinch':
        fx.bulgePinch(x, y, Math.min(width, height) * (0.15 + scale * 0.6), -amount * 0.8)
        break
      case 'bokeh':
        fx.lensBlur(amount * (1 + scale * 14) * pixel, 0, scale * Math.PI)
        break
      case 'edge':
        fx.edgeWork((0.5 + amount * 8) * pixel)
        break
      case 'negative':
        fx.curves(
          curve(
            [
              [0, 1],
              [1, 0],
            ],
            amount,
          ),
        )
        break
      case 'solarize':
        fx.curves(
          curve(
            [
              [0, 0],
              [0.5, 1],
              [1, 0],
            ],
            amount,
          ),
        )
        break
      case 'cyanotype':
        fx.hueSaturation(0, -amount).curves(
          curve(
            [
              [0, 0.04],
              [1, 0.8],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.13],
              [1, 0.91],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.33],
              [1, 1],
            ],
            amount,
          ),
        )
        break
      case 'coralprint':
        fx.hueSaturation(0, -amount).curves(
          curve(
            [
              [0, 0.18],
              [1, 1],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.06],
              [1, 0.6],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.04],
              [1, 0.45],
            ],
            amount,
          ),
        )
        break
      case 'goldprint':
        fx.hueSaturation(0, -amount).curves(
          curve(
            [
              [0, 0.16],
              [1, 1],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.08],
              [1, 0.85],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.02],
              [1, 0.4],
            ],
            amount,
          ),
        )
        break
      case 'vibrant':
        fx.vibrance(amount * 0.85).brightnessContrast(0, amount * 0.12)
        break
      case 'noir':
        fx.hueSaturation(0, -amount)
          .brightnessContrast(-amount * 0.03, amount * 0.45)
          .vignette(0.4, amount * 0.5)
        break
      case 'highkey':
        fx.brightnessContrast(amount * 0.2, -amount * 0.12).vibrance(amount * 0.1)
        break
      case 'lowkey':
        fx.brightnessContrast(-amount * 0.26, amount * 0.25).vignette(0.4, amount * 0.45)
        break
      case 'crossprocess':
        fx.curves(
          curve(
            [
              [0, 0],
              [0.3, 0.2],
              [0.7, 0.83],
              [1, 1],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.03],
              [0.4, 0.36],
              [1, 1],
            ],
            amount,
          ),
          curve(
            [
              [0, 0.14],
              [0.6, 0.55],
              [1, 0.91],
            ],
            amount,
          ),
        )
        break
      case 'bleach':
        fx.hueSaturation(0, -amount * 0.75).brightnessContrast(amount * 0.02, amount * 0.5)
        break
      case 'filmfade':
        fx.curves(
          curve(
            [
              [0, 0.16],
              [0.5, 0.54],
              [1, 0.92],
            ],
            amount,
          ),
        ).noise(amount * 0.04)
        break
      case 'popart':
        fx.hueSaturation(amount * 0.15, amount * 0.9).ink(amount * 0.15)
        break
      case 'pencil':
        fx.edgeWork((0.5 + amount * 5) * pixel).hueSaturation(0, -amount)
        break
      case 'magazine':
        fx.colorHalftone(x, y, 0.7, Math.max(0.5, (1 + scale * 9) * pixel))
          .ink(amount * 0.1)
          .noise(amount * 0.04)
        break
      case 'radialink':
        fx.zoomBlur(x, y, amount * 0.2).ink(amount * 0.35)
        break
    }
  // Match spatial radii between the 720px preview and full-resolution export.
  if (s.sharpness > 0)
    fx.unsharpMask((0.5 + unit(s.sharpenRadius) * 5) * pixel, unit(s.sharpness) * 2)
}
