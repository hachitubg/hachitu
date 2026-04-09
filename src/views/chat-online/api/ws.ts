import type { ChatSocketClientMessage, ChatSocketServerMessage } from './types'

export function toChatWebSocketUrl(pathname: string): string {
  const url = new URL(pathname, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export function serializeChatSocketMessage(message: ChatSocketClientMessage): string {
  return JSON.stringify(message)
}

export function parseChatSocketMessage(raw: string): ChatSocketServerMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ChatSocketServerMessage>
    if (typeof parsed.type !== 'string') {
      return null
    }
    return parsed as ChatSocketServerMessage
  } catch {
    return null
  }
}
