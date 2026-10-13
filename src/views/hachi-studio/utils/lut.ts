export interface LutTexture {
  image: HTMLImageElement
  grid: number
}
const cache = new Map<string, Promise<LutTexture>>()
export function loadLut(path: string): Promise<LutTexture> {
  const cached = cache.get(path)
  if (cached) return cached
  const promise = (async () => {
    const image = new Image()
    image.src = path
    await image.decode()
    if (image.naturalWidth !== 256 || image.naturalHeight !== 128)
      throw new Error('File màu không đúng định dạng.')
    return { image, grid: 32 }
  })().catch((error) => {
    cache.delete(path)
    throw error
  })
  cache.set(path, promise)
  return promise
}
