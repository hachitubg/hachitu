import type { ChatRoomRecord } from './types'

const CHAT_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CHAT_ALARM_INTERVAL_MS = 60 * 60 * 1000

export function computeChatExpiresAt(now: number): number {
  return now + CHAT_ROOM_TTL_MS
}

export function getChatAlarmAt(room: ChatRoomRecord): number {
  const nextCheckAt = room.lastActiveAt + CHAT_ALARM_INTERVAL_MS
  return Math.min(nextCheckAt, room.expiresAt)
}

export function shouldExpireChatRoom(room: ChatRoomRecord, now: number): boolean {
  return now >= room.expiresAt
}
