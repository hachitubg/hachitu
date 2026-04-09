import type {
  CreateRoomInput,
  JoinRoomInput,
  LeaveRoomInput,
  StartRoomInput,
} from './room-types'

const ROOM_ID_RE = /^[a-z0-9-]{6,64}$/

export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
}

export function isValidRoomId(roomId: string): boolean {
  return ROOM_ID_RE.test(roomId)
}

export function createRoomId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function createSessionId(): string {
  return crypto.randomUUID()
}

export function createPlayerId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function normalizeCreateRoomInput(input: Partial<CreateRoomInput>): CreateRoomInput {
  const gameType = input.gameType?.trim() || 'party-room'
  const displayName = input.displayName?.trim() || 'Host'
  const maxPlayers = Number.isInteger(input.maxPlayers) ? Number(input.maxPlayers) : 4

  return {
    gameType,
    displayName,
    maxPlayers: Math.min(Math.max(maxPlayers, 2), 16),
  }
}

export function normalizeJoinRoomInput(input: Partial<JoinRoomInput>): JoinRoomInput {
  return {
    displayName: input.displayName?.trim() || 'Guest',
    sessionId: input.sessionId?.trim() || createSessionId(),
    playerId: input.playerId?.trim() || createPlayerId(),
  }
}

export function normalizeLeaveRoomInput(input: Partial<LeaveRoomInput>): LeaveRoomInput {
  return {
    playerId: input.playerId?.trim() || '',
  }
}

export function normalizeStartRoomInput(input: Partial<StartRoomInput>): StartRoomInput {
  return {
    requestedByPlayerId: input.requestedByPlayerId?.trim() || '',
  }
}
