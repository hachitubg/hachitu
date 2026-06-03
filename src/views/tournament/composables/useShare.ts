import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'
import type { Tournament } from '../types'

function bytesToBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function gzipText(value: string): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null

  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'))
  const buffer = await new Response(stream).arrayBuffer()
  return `gz:${bytesToBase64Url(new Uint8Array(buffer))}`
}

async function gunzipText(value: string): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null

  const bytes = base64UrlToBytes(value)
  const buffer = new ArrayBuffer(bytes.length)
  const cloned = new Uint8Array(buffer)
  cloned.set(bytes)
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

export function useShare() {
  const exporting = ref(false)
  const sharing = ref(false)
  const { copy } = useClipboard()

  async function exportImage(el: HTMLElement, tournamentName: string): Promise<void> {
    if (exporting.value) return
    exporting.value = true
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(el, {
        backgroundColor: '#0F1923',
        pixelRatio: 2,
      })
      const link = document.createElement('a')
      link.download = `${tournamentName.replace(/\s+/g, '-').toLowerCase()}.png`
      link.href = dataUrl
      link.click()
    } finally {
      exporting.value = false
    }
  }

  async function encodeTournament(tournament: Tournament): Promise<string> {
    const json = JSON.stringify(tournament)
    const compressed = await gzipText(json)
    if (compressed) return compressed
    return `raw:${btoa(unescape(encodeURIComponent(json)))}`
  }

  async function decodeTournament(encoded: string): Promise<Tournament | null> {
    try {
      if (encoded.startsWith('gz:')) {
        const json = await gunzipText(encoded.slice(3))
        if (!json) return null
        return JSON.parse(json) as Tournament
      }

      if (encoded.startsWith('raw:')) {
        const json = decodeURIComponent(escape(atob(encoded.slice(4))))
        return JSON.parse(json) as Tournament
      }

      const fallbackJson = decodeURIComponent(escape(atob(encoded)))
      return JSON.parse(fallbackJson) as Tournament
    } catch {
      return null
    }
  }

  async function copyShareLink(tournament: Tournament): Promise<boolean> {
    sharing.value = true
    try {
      const encoded = await encodeTournament(tournament)
      const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`

      if (url.length > 8000) {
        await copy(encoded)
        return false
      }

      await copy(url)
      return true
    } finally {
      sharing.value = false
    }
  }

  async function getSharedTournament(): Promise<Tournament | null> {
    const hash = window.location.hash
    if (!hash.startsWith('#share=')) return null

    const encoded = hash.slice(7)
    const tournament = await decodeTournament(encoded)
    if (tournament) {
      window.location.hash = ''
    }
    return tournament
  }

  return {
    exporting,
    sharing,
    exportImage,
    copyShareLink,
    getSharedTournament,
  }
}
