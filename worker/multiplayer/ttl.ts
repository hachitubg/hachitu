import type { GameRoomRecord, RoomStatus } from './room-types'

export const WAITING_ROOM_TTL_MS = 24 * 60 * 60 * 1000
export const ACTIVE_ROOM_TTL_MS = 24 * 60 * 60 * 1000
export const FINISHED_ROOM_TTL_MS = 6 * 60 * 60 * 1000

export function getRoomTtlMs(status: RoomStatus): number {
  switch (status) {
    case 'waiting':
    case 'countdown':
      return WAITING_ROOM_TTL_MS
    case 'playing':
      return ACTIVE_ROOM_TTL_MS
    case 'finished':
    case 'abandoned':
      return FINISHED_ROOM_TTL_MS
  }
}

export function computeExpiresAt(status: RoomStatus, lastActiveAt: number): number {
  return lastActiveAt + getRoomTtlMs(status)
}

export function shouldExpireRoom(room: GameRoomRecord, now: number): boolean {
  return room.expiresAt <= now
}

export function getNextAlarmAt(room: GameRoomRecord): number {
  return room.expiresAt
}
