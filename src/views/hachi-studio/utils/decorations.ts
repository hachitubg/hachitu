export const textFonts = [
  { id: 'classic', name: 'Classic', family: '"Be Vietnam Pro", sans-serif', weight: 600 },
  { id: 'editorial', name: 'Editorial', family: 'Georgia, serif', weight: 400 },
  { id: 'typewriter', name: 'Typewriter', family: '"Courier New", monospace', weight: 600 },
  { id: 'bold', name: 'Bold', family: '"Anybody", sans-serif', weight: 800 },
  { id: 'modern', name: 'Modern', family: '"Trebuchet MS", sans-serif', weight: 400 },
] as const

export interface Decorations {
  text: string
  color: string
  font: (typeof textFonts)[number]['id']
  style: 'plain' | 'label' | 'outline'
  align: 'left' | 'center' | 'right'
  opacity: number
  size: number
  x: number
  y: number
}
export interface TextBounds {
  x: number
  y: number
  width: number
  height: number
}

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    lines.push(line)
  }
  return lines.slice(0, 5)
}

export function decorate(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  options: Decorations,
): TextBounds | undefined {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  if (!options.text.trim()) return
  ctx.save()
  const font = textFonts.find((item) => item.id === options.font) ?? textFonts[0]
  const size = (width * options.size) / 100
  const padding = size * 0.45
  ctx.font = `${font.weight} ${size}px ${font.family}`
  const maxWidth = width * 0.8 - padding * 2
  const lines = wrap(ctx, options.text, maxWidth)
  const blockWidth = Math.min(
    maxWidth,
    Math.max(...lines.map((line) => ctx.measureText(line).width)),
  )
  const lineHeight = size * 1.3
  const blockHeight = lineHeight * lines.length
  const boxWidth = blockWidth + padding * 2
  const boxHeight = blockHeight + padding * 2
  const centerX = Math.max(boxWidth / 2, Math.min(width - boxWidth / 2, options.x * width))
  const centerY = Math.max(boxHeight / 2, Math.min(height - boxHeight / 2, options.y * height))
  const bounds = {
    x: centerX - boxWidth / 2,
    y: centerY - boxHeight / 2,
    width: boxWidth,
    height: boxHeight,
  }
  ctx.globalAlpha = Math.max(0, Math.min(100, options.opacity)) / 100
  if (options.style === 'label') {
    ctx.fillStyle = options.color === '#2f241f' ? '#fffaf4' : '#2f241f'
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
  }
  ctx.fillStyle = options.color
  ctx.textAlign = options.align
  ctx.textBaseline = 'middle'
  if (options.style === 'plain') {
    ctx.shadowColor = 'rgba(0,0,0,.6)'
    ctx.shadowBlur = size * 0.15
  }
  const x =
    options.align === 'left'
      ? centerX - blockWidth / 2
      : options.align === 'right'
        ? centerX + blockWidth / 2
        : centerX
  lines.forEach((line, index) => {
    const y = centerY - blockHeight / 2 + lineHeight * (index + 0.5)
    if (options.style === 'outline') {
      ctx.strokeStyle = '#2f241f'
      ctx.lineWidth = Math.max(1, size * 0.065)
      ctx.lineJoin = 'round'
      ctx.strokeText(line, x, y, maxWidth)
    }
    ctx.fillText(line, x, y, maxWidth)
  })
  ctx.restore()
  return bounds
}
