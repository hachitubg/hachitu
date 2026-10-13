export interface Framing {
  zoom: number
  x: number
  y: number
}
const clamp = (value: number) => Math.max(-1, Math.min(1, value))
export function panFraming(
  start: Framing,
  dx: number,
  dy: number,
  frameWidth: number,
  frameHeight: number,
  sourceRatio: number,
  targetRatio: number,
): Framing {
  const cropX = Math.min(1, targetRatio / sourceRatio) / start.zoom
  const cropY = Math.min(1, sourceRatio / targetRatio) / start.zoom
  return {
    zoom: start.zoom,
    x:
      cropX >= 0.999
        ? 0
        : clamp(start.x - (((2 * dx) / Math.max(1, frameWidth)) * cropX) / (1 - cropX)),
    y:
      cropY >= 0.999
        ? 0
        : clamp(start.y - (((2 * dy) / Math.max(1, frameHeight)) * cropY) / (1 - cropY)),
  }
}
