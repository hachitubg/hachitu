import type { ChatClientMessage, ChatServerMessage } from './types'

export function parseChatClientMessage(raw: string): ChatClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ChatClientMessage>
    if (typeof parsed.type !== 'string') {
      return null
    }
    return parsed as ChatClientMessage
  } catch {
    return null
  }
}

export function serializeChatServerMessage(message: ChatServerMessage): string {
  return JSON.stringify(message)
}
