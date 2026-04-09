import type { ChatDiscoveryItem } from './types'

interface ImgflipMeme {
  id: string
  name: string
  url: string
  width: number
  height: number
}

interface ImgflipResponse {
  success: boolean
  data?: {
    memes?: ImgflipMeme[]
  }
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swapIndex] as T
    next[swapIndex] = current as T
  }

  return next
}

function mapImgflipMemes(items: ImgflipMeme[], mediaKind: 'image' | 'gif'): ChatDiscoveryItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.name,
    imageUrl: item.url,
    pageUrl: `https://imgflip.com/memegenerator/${item.id}`,
    width: item.width,
    height: item.height,
    mediaKind: item.url.endsWith('.mp4') || item.url.endsWith('.webm') ? 'video' : mediaKind,
  }))
}

async function fetchImgflipMemes(mediaKind: 'image' | 'gif'): Promise<ChatDiscoveryItem[]> {
  const url = `https://api.imgflip.com/get_memes?type=${mediaKind}`
  const response = await fetch(url)

  if (!response.ok) {
    return []
  }

  const payload = (await response.json()) as ImgflipResponse
  const memes = payload.data?.memes ?? []

  return mapImgflipMemes(memes, mediaKind)
}

export async function getChatDiscoveries(
  kind: 'image' | 'gif' | 'mixed',
  limit: number,
): Promise<ChatDiscoveryItem[]> {
  if (kind === 'image') {
    return shuffle(await fetchImgflipMemes('image')).slice(0, limit)
  }

  if (kind === 'gif') {
    return shuffle(await fetchImgflipMemes('gif')).slice(0, limit)
  }

  const [images, gifs] = await Promise.all([fetchImgflipMemes('image'), fetchImgflipMemes('gif')])
  const merged = shuffle([
    ...images.slice(0, Math.max(limit, 12)),
    ...gifs.slice(0, Math.max(limit, 12)),
  ])

  return merged.slice(0, limit)
}
