export function inpaint(
  data: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const total = width * height
  const output = new Uint8ClampedArray(data)
  const pending = new Uint8Array(total)
  let count = 0
  for (let i = 0; i < total; i++)
    if (mask[i * 4 + 3]! > 100) {
      pending[i] = 1
      count++
    }
  if (!count) throw new Error('Hãy tô vùng cần xóa trước.')
  if (count > total * 0.15)
    throw new Error('Vùng quá lớn. Hãy xóa từng chi tiết nhỏ để ảnh tự nhiên hơn.')
  const queue: number[] = []
  const queued = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (!pending[i]) continue
    const x = i % width,
      y = Math.floor(i / width)
    if (
      (x > 0 && !pending[i - 1]) ||
      (x < width - 1 && !pending[i + 1]) ||
      (y > 0 && !pending[i - width]) ||
      (y < height - 1 && !pending[i + width])
    ) {
      queue.push(i)
      queued[i] = 1
    }
  }
  // Propagate surrounding colors inward; this is local inpainting, not generative AI.
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!,
      x = i % width,
      y = Math.floor(i / width)
    let red = 0,
      green = 0,
      blue = 0,
      alpha = 0,
      weights = 0
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx,
          ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || (!dx && !dy)) continue
        const n = ny * width + nx
        if (pending[n]) continue
        const weight = 1 / (dx * dx + dy * dy)
        red += output[n * 4]! * weight
        green += output[n * 4 + 1]! * weight
        blue += output[n * 4 + 2]! * weight
        alpha += output[n * 4 + 3]! * weight
        weights += weight
      }
    if (!weights) continue
    output[i * 4] = red / weights
    output[i * 4 + 1] = green / weights
    output[i * 4 + 2] = blue / weights
    output[i * 4 + 3] = alpha / weights
    pending[i] = 0
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx === undefined || ny === undefined || nx < 0 || ny < 0 || nx >= width || ny >= height)
        continue
      const n = ny * width + nx
      if (pending[n] && !queued[n]) {
        queued[n] = 1
        queue.push(n)
      }
    }
  }
  return output
}
