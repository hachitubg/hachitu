export interface ChatParticipant {
  participantId: string
  sessionId: string
  displayName: string
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

export interface ChatConnectionAttachment {
  participantId: string
  sessionId: string
  displayName: string
}

export interface CreateChatRoomInput {
  displayName: string
  roomName: string
}

export interface JoinChatRoomInput {
  displayName: string
  sessionId: string
  participantId: string
}

export interface LeaveChatRoomInput {
  participantId: string
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

export interface ClientHelloMessage {
  type: 'hello'
}

export interface ClientPingMessage {
  type: 'ping'
  clientTime: number
}

export interface ClientTypingMessage {
  type: 'typing'
}

export interface ClientSendTextMessage {
  type: 'send_message'
  kind: 'text'
  text: string
}

export interface ClientSendIconMessage {
  type: 'send_message'
  kind: 'icon'
  icon: ChatMediaAttachment
}

export interface ClientSendMemeMessage {
  type: 'send_message'
  kind: 'meme'
  meme: ChatMediaAttachment
}

export interface ClientSendImageMessage {
  type: 'send_message'
  kind: 'image'
  image: ChatMediaAttachment
}

export interface ClientSendVideoMessage {
  type: 'send_message'
  kind: 'video'
  video: ChatMediaAttachment
}

export type ChatClientMessage =
  | ClientHelloMessage
  | ClientPingMessage
  | ClientTypingMessage
  | ClientSendTextMessage
  | ClientSendIconMessage
  | ClientSendMemeMessage
  | ClientSendImageMessage
  | ClientSendVideoMessage

export interface ServerInitialStateMessage {
  type: 'initial_state'
  room: ChatRoomRecord
  serverTime: number
}

export interface ServerParticipantJoinedMessage {
  type: 'participant_joined'
  participant: ChatParticipant
  serverTime: number
}

export interface ServerParticipantLeftMessage {
  type: 'participant_left'
  participantId: string
  serverTime: number
}

export interface ServerPresenceMessage {
  type: 'presence_updated'
  participants: ChatParticipant[]
  serverTime: number
}

export interface ServerTypingMessage {
  type: 'typing_updated'
  participantId: string
  lastTypingAt: number
  serverTime: number
}

export interface ServerMessageCreatedMessage {
  type: 'message_created'
  message: ChatMessage
  roomVersion: number
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

export type ChatServerMessage =
  | ServerInitialStateMessage
  | ServerParticipantJoinedMessage
  | ServerParticipantLeftMessage
  | ServerPresenceMessage
  | ServerTypingMessage
  | ServerMessageCreatedMessage
  | ServerActionRejectedMessage
  | ServerPongMessage
  | ServerRoomExpiringMessage
