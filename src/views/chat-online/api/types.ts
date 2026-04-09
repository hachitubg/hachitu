export interface ChatParticipant {
  participantId: string
  sessionId: string
  displayName: string
  avatarPreset: string | null
  joinedAt: number
  lastSeenAt: number
  lastTypingAt: number | null
  connected: boolean
  isHost: boolean
}

export type ChatMessageKind = 'text' | 'icon' | 'meme' | 'image' | 'video'

export interface ChatMediaAttachment {
  templateId: string
  title: string
  mediaUrl: string
  previewUrl: string | null
  mediaKind: 'image' | 'gif' | 'video'
  pageUrl: string | null
}

export interface ChatMessage {
  messageId: string
  participantId: string
  displayName: string
  kind: ChatMessageKind
  text: string
  attachment: ChatMediaAttachment | null
  createdAt: number
}

export interface ChatRoomRecord {
  roomId: string
  roomName: string
  createdAt: number
  lastActiveAt: number
  expiresAt: number
  version: number
  hostParticipantId: string
  participants: ChatParticipant[]
  messages: ChatMessage[]
}

export interface ChatDiscoveryItem {
  id: string
  title: string
  imageUrl: string
  pageUrl: string
  width: number
  height: number
  mediaKind: 'image' | 'gif' | 'video'
}

export interface CreateChatRoomRequest {
  displayName: string
  roomName: string
  avatarPreset: string | null
}

export interface JoinChatRoomRequest {
  displayName: string
  sessionId: string
  participantId: string
  avatarPreset: string | null
}

export interface LeaveChatRoomRequest {
  participantId: string
}

export interface CreateChatRoomResponse {
  roomId: string
  room: ChatRoomRecord
  host: {
    participantId: string
    sessionId: string
    displayName: string
    avatarPreset: string | null
  }
  joinPath: string
  api: {
    room: string
    join: string
    leave: string
    ws: string
  }
}

export interface ChatRoomStateResponse {
  room: ChatRoomRecord
}

export interface JoinChatRoomResponse {
  room: ChatRoomRecord
  participant: ChatParticipant | null
  websocketUrl: string
}

export interface ChatDiscoveriesResponse {
  kind: 'image' | 'gif' | 'mixed'
  discoveries: ChatDiscoveryItem[]
}

export interface ChatSocketHelloMessage {
  type: 'hello'
}

export interface ChatSocketPingMessage {
  type: 'ping'
  clientTime: number
}

export interface ChatSocketTypingMessage {
  type: 'typing'
}

export interface ChatSocketTextMessage {
  type: 'send_message'
  kind: 'text'
  text: string
}

export interface ChatSocketIconMessage {
  type: 'send_message'
  kind: 'icon'
  icon: ChatMediaAttachment
}

export interface ChatSocketMemeMessage {
  type: 'send_message'
  kind: 'meme'
  meme: ChatMediaAttachment
}

export interface ChatSocketImageMessage {
  type: 'send_message'
  kind: 'image'
  image: ChatMediaAttachment
}

export interface ChatSocketVideoMessage {
  type: 'send_message'
  kind: 'video'
  video: ChatMediaAttachment
}

export type ChatSocketClientMessage =
  | ChatSocketHelloMessage
  | ChatSocketPingMessage
  | ChatSocketTypingMessage
  | ChatSocketTextMessage
  | ChatSocketIconMessage
  | ChatSocketMemeMessage
  | ChatSocketImageMessage
  | ChatSocketVideoMessage

export interface ChatSocketInitialStateMessage {
  type: 'initial_state'
  room: ChatRoomRecord
  serverTime: number
}

export interface ChatSocketParticipantJoinedMessage {
  type: 'participant_joined'
  participant: ChatParticipant
  serverTime: number
}

export interface ChatSocketParticipantLeftMessage {
  type: 'participant_left'
  participantId: string
  serverTime: number
}

export interface ChatSocketPresenceMessage {
  type: 'presence_updated'
  participants: ChatParticipant[]
  serverTime: number
}

export interface ChatSocketTypingUpdatedMessage {
  type: 'typing_updated'
  participantId: string
  lastTypingAt: number
  serverTime: number
}

export interface ChatSocketMessageCreatedMessage {
  type: 'message_created'
  message: ChatMessage
  roomVersion: number
  serverTime: number
}

export interface ChatSocketRejectedMessage {
  type: 'action_rejected'
  reason: string
  serverTime: number
}

export interface ChatSocketPongMessage {
  type: 'pong'
  clientTime: number
  serverTime: number
}

export interface ChatSocketRoomExpiringMessage {
  type: 'room_expiring'
  expiresAt: number
  serverTime: number
}

export type ChatSocketServerMessage =
  | ChatSocketInitialStateMessage
  | ChatSocketParticipantJoinedMessage
  | ChatSocketParticipantLeftMessage
  | ChatSocketPresenceMessage
  | ChatSocketTypingUpdatedMessage
  | ChatSocketMessageCreatedMessage
  | ChatSocketRejectedMessage
  | ChatSocketPongMessage
  | ChatSocketRoomExpiringMessage

export interface StoredChatRoomIdentity {
  participantId: string
  sessionId: string
  displayName: string
  avatarPreset: string | null
}

export interface StoredChatProfile {
  globalSessionId: string
  displayName: string
  avatarPreset: string | null
  avatarImageDataUrl: string | null
  rooms: Record<string, StoredChatRoomIdentity>
}

export interface YahooEmoticon {
  id: string
  title: string
  code: string
  imageUrl: string
}

export interface StoredChatSavedRoom {
  roomId: string
  roomName: string
  participantId: string
  sessionId: string
  displayName: string
  avatarPreset: string | null
  role: 'host' | 'member'
  lastVisitedAt: number
}
