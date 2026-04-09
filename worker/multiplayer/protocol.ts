import type { ClientMessage, ServerMessage } from './room-types'

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ClientMessage>
    if (typeof parsed.type !== 'string') {
      return null
    }
    return parsed as ClientMessage
  } catch {
    return null
  }
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message)
}
