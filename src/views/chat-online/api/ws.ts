import { io } from 'socket.io-client'
import type {
  ChatSocketClientMessage,
  ChatSocketServerMessage,
  StoredChatRoomIdentity,
} from './types'

export type ChatSocket = ReturnType<typeof io>

export function connectChatSocket(roomId: string, identity: StoredChatRoomIdentity): ChatSocket {
  return io(window.location.origin, {
    path: '/socket.io',
    transports: ['websocket'],
    query: {
      roomId,
      participantId: identity.participantId,
      sessionId: identity.sessionId,
      displayName: identity.displayName,
      avatarPreset: identity.avatarPreset ?? '',
    },
  })
}

export function sendChatSocketMessage(socket: ChatSocket, message: ChatSocketClientMessage) {
  socket.emit('chat:client', message)
}

export function onChatSocketMessage(
  socket: ChatSocket,
  handler: (message: ChatSocketServerMessage) => void,
) {
  socket.on('chat:event', handler)
}
