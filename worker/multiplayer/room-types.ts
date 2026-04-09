export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished' | 'abandoned'

export interface RoomPlayer {
  playerId: string
  sessionId: string
  displayName: string
  joinedAt: number
  connected: boolean
  isHost: boolean
}

export interface GameRoomRecord {
  roomId: string
  gameType: string
  createdAt: number
  lastActiveAt: number
  expiresAt: number
  status: RoomStatus
  version: number
  maxPlayers: number
  hostPlayerId: string
  gameStateJson: string
  players: RoomPlayer[]
}

export interface ConnectionAttachment {
  playerId: string
  sessionId: string
  displayName: string
  joinedAt: number
}

export interface CreateRoomInput {
  gameType: string
  displayName: string
  maxPlayers: number
}

export interface JoinRoomInput {
  displayName: string
  sessionId: string
  playerId: string
}

export interface LeaveRoomInput {
  playerId: string
}

export interface StartRoomInput {
  requestedByPlayerId: string
}

export interface RoomEnvelope {
  room: GameRoomRecord
}

export interface ClientHelloMessage {
  type: 'hello'
  playerId: string
  sessionId: string
  displayName: string
}

export interface ClientPingMessage {
  type: 'ping'
  clientTime: number
}

export interface ClientPlayerActionMessage {
  type: 'player_action'
  playerId: string
  seq: number
  action: string
  payloadJson: string
}

export type ClientMessage =
  | ClientHelloMessage
  | ClientPingMessage
  | ClientPlayerActionMessage

export interface ServerInitialStateMessage {
  type: 'initial_state'
  room: GameRoomRecord
  serverTime: number
}

export interface ServerStatePatchMessage {
  type: 'state_patch'
  room: GameRoomRecord
  serverTime: number
}

export interface ServerPlayerJoinedMessage {
  type: 'player_joined'
  player: RoomPlayer
  serverTime: number
}

export interface ServerPlayerLeftMessage {
  type: 'player_left'
  playerId: string
  serverTime: number
}

export interface ServerActionRejectedMessage {
  type: 'action_rejected'
  reason: string
  serverTime: number
}

export interface ServerPongMessage {
  type: 'pong'
  clientTime: number
  serverTime: number
}

export interface ServerRoomExpiringMessage {
  type: 'room_expiring'
  expiresAt: number
  serverTime: number
}

export type ServerMessage =
  | ServerInitialStateMessage
  | ServerStatePatchMessage
  | ServerPlayerJoinedMessage
  | ServerPlayerLeftMessage
  | ServerActionRejectedMessage
  | ServerPongMessage
  | ServerRoomExpiringMessage
