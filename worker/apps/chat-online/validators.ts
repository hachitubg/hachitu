import type {
  ChatMediaAttachment,
  ClientSendImageMessage,
  ClientSendIconMessage,
  ClientSendMemeMessage,
  ClientSendTextMessage,
  ClientSendVideoMessage,
  CreateChatRoomInput,
  JoinChatRoomInput,
  LeaveChatRoomInput,
} from './types'
import { createPlayerId, createSessionId } from '../../multiplayer/validators'

const MAX_ROOM_NAME_LENGTH = 48
const MAX_DISPLAY_NAME_LENGTH = 24
const MAX_TEXT_LENGTH = 500

function trimToLength(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength)
}

function isSafeMediaUrl(value: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(value) || /^\/chat-online\/[^\s]+$/i.test(value)
}

export function normalizeCreateChatRoomInput(
  input: Partial<CreateChatRoomInput>,
): CreateChatRoomInput {
  return {
    displayName: trimToLength(input.displayName ?? '', MAX_DISPLAY_NAME_LENGTH) || 'Host',
    roomName: trimToLength(input.roomName ?? '', MAX_ROOM_NAME_LENGTH) || 'HACHITU Chat Room',
  }
}

export function normalizeJoinChatRoomInput(input: Partial<JoinChatRoomInput>): JoinChatRoomInput {
  return {
    displayName: trimToLength(input.displayName ?? '', MAX_DISPLAY_NAME_LENGTH) || 'Guest',
    sessionId: trimToLength(input.sessionId ?? '', 64) || createSessionId(),
    participantId: trimToLength(input.participantId ?? '', 64) || createPlayerId(),
  }
}

export function normalizeLeaveChatRoomInput(
  input: Partial<LeaveChatRoomInput>,
): LeaveChatRoomInput {
  return {
    participantId: trimToLength(input.participantId ?? '', 64),
  }
}

export function validateTextMessage(input: ClientSendTextMessage): string | null {
  const text = trimToLength(input.text, MAX_TEXT_LENGTH)
  return text ? text : null
}

export function validateIconMessage(input: ClientSendIconMessage): string | null {
  return validateChatAttachment(input.icon, ['gif'])
}

export function validateMemeMessage(input: ClientSendMemeMessage): ChatMediaAttachment | null {
  return validateChatAttachment(input.meme, ['gif', 'image', 'video'])
}

export function validateImageMessage(input: ClientSendImageMessage): ChatMediaAttachment | null {
  return validateChatAttachment(input.image, ['image', 'gif'])
}

export function validateVideoMessage(input: ClientSendVideoMessage): ChatMediaAttachment | null {
  return validateChatAttachment(input.video, ['video'])
}

function validateChatAttachment(
  attachment: ChatMediaAttachment | null | undefined,
  allowedKinds: Array<'image' | 'gif' | 'video'>,
): ChatMediaAttachment | null {
  if (!attachment) {
    return null
  }

  const templateId = trimToLength(attachment.templateId, 32)
  const title = trimToLength(attachment.title, 80)
  const mediaUrl = trimToLength(attachment.mediaUrl, 500)
  const previewUrl = trimToLength(attachment.previewUrl ?? '', 500)
  const pageUrl = trimToLength(attachment.pageUrl ?? '', 500)
  const mediaKind = allowedKinds.includes(attachment.mediaKind) ? attachment.mediaKind : null

  if (!templateId || !title || !mediaUrl || !mediaKind) {
    return null
  }

  if (!isSafeMediaUrl(mediaUrl)) {
    return null
  }

  if (previewUrl && !isSafeMediaUrl(previewUrl)) {
    return null
  }

  if (pageUrl && !isSafeMediaUrl(pageUrl)) {
    return null
  }

  return {
    templateId,
    title,
    mediaUrl,
    previewUrl: previewUrl || null,
    pageUrl: pageUrl || null,
    mediaKind,
  }
}
