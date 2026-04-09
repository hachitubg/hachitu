import { DurableObject } from 'cloudflare:workers'
import { json, text } from '../multiplayer/http'
import { parseChatClientMessage, serializeChatServerMessage } from '../apps/chat-online/protocol'
import {
  computeChatExpiresAt,
  getChatAlarmAt,
  shouldExpireChatRoom,
} from '../apps/chat-online/ttl'
import {
  validateImageMessage,
  validateIconMessage,
  validateMemeMessage,
  validateTextMessage,
  validateVideoMessage,
} from '../apps/chat-online/validators'
import type {
  ChatClientMessage,
  ChatConnectionAttachment,
  ChatMessage,
  ChatParticipant,
  ChatRoomRecord,
  CreateChatRoomInput,
  JoinChatRoomInput,
  LeaveChatRoomInput,
} from '../apps/chat-online/types'

type Env = Record<string, never>

interface ChatRoomRow {
  room_json: string
}

const MAX_MESSAGES = 180

export class ChatRoomDurableObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ensureSchema()
  }

  private ensureSchema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS chat_room_state (
        singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
        room_json TEXT NOT NULL
      )
    `)
  }

  private readRoom(): ChatRoomRecord | null {
    const cursor = this.ctx.storage.sql.exec(
      'SELECT room_json FROM chat_room_state WHERE singleton_key = 1',
    )
    const row = cursor.next()

    if (row.done) {
      return null
    }

    const data = row.value as ChatRoomRow
    return JSON.parse(data.room_json) as ChatRoomRecord
  }

  private saveRoom(room: ChatRoomRecord) {
    this.ctx.storage.sql.exec('DELETE FROM chat_room_state WHERE singleton_key = 1')
    this.ctx.storage.sql.exec(
      'INSERT INTO chat_room_state (singleton_key, room_json) VALUES (?, ?)',
      1,
      JSON.stringify(room),
    )
  }

  private async scheduleAlarm(room: ChatRoomRecord) {
    const nextAlarmAt = Math.max(Date.now() + 1000, getChatAlarmAt(room))

    try {
      await this.ctx.storage.setAlarm(nextAlarmAt)
    }
    catch (error) {
      console.warn('chat-room: bỏ qua lỗi scheduleAlarm trong local dev', error)
    }
  }

  private getConnectionAttachment(request: Request): ChatConnectionAttachment {
    const url = new URL(request.url)
    return {
      participantId: url.searchParams.get('participantId') ?? '',
      sessionId: url.searchParams.get('sessionId') ?? '',
      displayName: url.searchParams.get('displayName') ?? 'Guest',
      avatarPreset: url.searchParams.get('avatarPreset') ?? null,
    }
  }

  private broadcast(message: Parameters<typeof serializeChatServerMessage>[0], excludeId = '') {
    const payload = serializeChatServerMessage(message)

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as ChatConnectionAttachment | null
      if (attachment && attachment.participantId === excludeId) {
        continue
      }
      socket.send(payload)
    }
  }

  private sendToSocket(socket: WebSocket, message: Parameters<typeof serializeChatServerMessage>[0]) {
    socket.send(serializeChatServerMessage(message))
  }

  private touchParticipant(
    room: ChatRoomRecord,
    participantId: string,
    patch: Partial<ChatParticipant>,
  ): ChatParticipant[] {
    return room.participants.map((participant) =>
      participant.participantId === participantId ? { ...participant, ...patch } : participant,
    )
  }

  private findParticipant(room: ChatRoomRecord, participantId: string): ChatParticipant | null {
    return (
      room.participants.find((participant) => participant.participantId === participantId) ?? null
    )
  }

  private createMessage(
    room: ChatRoomRecord,
    sender: ChatParticipant,
    input: ChatClientMessage,
    now: number,
  ): ChatMessage | null {
    if (input.type !== 'send_message') {
      return null
    }

    if (input.kind === 'text') {
      const text = validateTextMessage(input)
      if (!text) {
        return null
      }

      return {
        messageId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        participantId: sender.participantId,
        displayName: sender.displayName,
        kind: 'text',
        text,
        attachment: null,
        createdAt: now,
      }
    }

    if (input.kind === 'icon') {
      const icon = validateIconMessage(input)
      if (!icon) {
        return null
      }

      return {
        messageId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        participantId: sender.participantId,
        displayName: sender.displayName,
        kind: 'icon',
        text: icon.title,
        attachment: icon,
        createdAt: now,
      }
    }

    if (input.kind === 'meme') {
      const attachment = validateMemeMessage(input)
      if (!attachment) {
        return null
      }

      return {
        messageId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        participantId: sender.participantId,
        displayName: sender.displayName,
        kind: 'meme',
        text: attachment.title,
        attachment,
        createdAt: now,
      }
    }

    if (input.kind === 'image') {
      const attachment = validateImageMessage(input)
      if (!attachment) {
        return null
      }

      return {
        messageId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        participantId: sender.participantId,
        displayName: sender.displayName,
        kind: 'image',
        text: attachment.title,
        attachment,
        createdAt: now,
      }
    }

    const attachment = validateVideoMessage(input)
    if (!attachment) {
      return null
    }

    return {
      messageId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      participantId: sender.participantId,
      displayName: sender.displayName,
      kind: 'video',
      text: attachment.title,
      attachment,
      createdAt: now,
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/internal/create') {
      const input = (await request.json()) as CreateChatRoomInput
      const roomId = url.hostname.split('.')[0] ?? crypto.randomUUID()
      const now = Date.now()
      const hostParticipantId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const hostSessionId = crypto.randomUUID()
      const existingRoom = this.readRoom()

      if (existingRoom) {
        return json({ room: existingRoom })
      }

      const room: ChatRoomRecord = {
        roomId,
        roomName: input.roomName,
        createdAt: now,
        lastActiveAt: now,
        expiresAt: computeChatExpiresAt(now),
        version: 1,
        hostParticipantId,
        participants: [
          {
            participantId: hostParticipantId,
            sessionId: hostSessionId,
            displayName: input.displayName,
            avatarPreset: input.avatarPreset,
            joinedAt: now,
            lastSeenAt: now,
            lastTypingAt: null,
            connected: false,
            isHost: true,
          },
        ],
        messages: [],
      }

      this.saveRoom(room)
      await this.scheduleAlarm(room)

      return json({
        room,
        host: {
          participantId: hostParticipantId,
          sessionId: hostSessionId,
          displayName: input.displayName,
          avatarPreset: input.avatarPreset,
        },
      })
    }

    if (request.method === 'GET' && url.pathname === '/internal/state') {
      const room = this.readRoom()
      if (!room) {
        return text('Room not found', { status: 404 })
      }

      return json({ room })
    }

    if (request.method === 'POST' && url.pathname === '/internal/join') {
      const input = (await request.json()) as JoinChatRoomInput
      const room = this.readRoom()
      if (!room) {
        return text('Room not found', { status: 404 })
      }

      const now = Date.now()
      const existingParticipant = this.findParticipant(room, input.participantId)
      const nextParticipants = existingParticipant
        ? room.participants.map((participant) =>
            participant.participantId === input.participantId
              ? {
                  ...participant,
                  displayName: input.displayName,
                  avatarPreset: input.avatarPreset,
                  sessionId: input.sessionId,
                  lastSeenAt: now,
                }
              : participant,
          )
        : [
            ...room.participants,
            {
              participantId: input.participantId,
              sessionId: input.sessionId,
              displayName: input.displayName,
              avatarPreset: input.avatarPreset,
              joinedAt: now,
              lastSeenAt: now,
              lastTypingAt: null,
              connected: false,
              isHost: false,
            },
          ]

      const nextRoom: ChatRoomRecord = {
        ...room,
        participants: nextParticipants,
        lastActiveAt: now,
        expiresAt: computeChatExpiresAt(now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      return json({
        room: nextRoom,
        participant:
          nextParticipants.find((participant) => participant.participantId === input.participantId) ??
          null,
        websocketUrl: `/api/chat/rooms/${nextRoom.roomId}/ws?participantId=${input.participantId}&sessionId=${input.sessionId}&displayName=${encodeURIComponent(input.displayName)}${input.avatarPreset ? `&avatarPreset=${encodeURIComponent(input.avatarPreset)}` : ''}`,
      })
    }

    if (request.method === 'POST' && url.pathname === '/internal/leave') {
      const input = (await request.json()) as LeaveChatRoomInput
      const room = this.readRoom()
      if (!room) {
        return text('Room not found', { status: 404 })
      }

      const now = Date.now()
      const nextRoom: ChatRoomRecord = {
        ...room,
        participants: this.touchParticipant(room, input.participantId, {
          connected: false,
          lastSeenAt: now,
        }),
        lastActiveAt: now,
        expiresAt: computeChatExpiresAt(now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      this.broadcast(
        {
          type: 'participant_left',
          participantId: input.participantId,
          serverTime: now,
        },
        input.participantId,
      )
      this.broadcast({
        type: 'presence_updated',
        participants: nextRoom.participants,
        serverTime: now,
      })

      return json({ room: nextRoom })
    }

    if (request.method === 'GET' && url.pathname === '/internal/ws') {
      const pair = new WebSocketPair()
      const sockets = Object.values(pair)
      const client = sockets[0]
      const server = sockets[1]
      const attachment = this.getConnectionAttachment(request)

      this.ctx.acceptWebSocket(server)
      server.serializeAttachment(attachment)

      const room = this.readRoom()
      if (!room) {
        server.close(1011, 'Room not found')
        return new Response(null, { status: 101, webSocket: client })
      }

      const participant = this.findParticipant(room, attachment.participantId)
      if (!participant) {
        server.close(1008, 'Participant not joined')
        return new Response(null, { status: 101, webSocket: client })
      }

      const now = Date.now()
      const nextRoom: ChatRoomRecord = {
        ...room,
        participants: this.touchParticipant(room, attachment.participantId, {
          connected: true,
          displayName: attachment.displayName || participant.displayName,
          avatarPreset: attachment.avatarPreset ?? participant.avatarPreset,
          lastSeenAt: now,
        }),
        lastActiveAt: now,
        expiresAt: computeChatExpiresAt(now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      this.sendToSocket(server, {
        type: 'initial_state',
        room: nextRoom,
        serverTime: now,
      })

      const joinedParticipant = this.findParticipant(nextRoom, attachment.participantId)
      if (joinedParticipant) {
        this.broadcast(
          {
            type: 'participant_joined',
            participant: joinedParticipant,
            serverTime: now,
          },
          attachment.participantId,
        )
      }
      this.broadcast({
        type: 'presence_updated',
        participants: nextRoom.participants,
        serverTime: now,
      })

      return new Response(null, { status: 101, webSocket: client })
    }

    return text('Not Found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') {
      return
    }

    const parsed = parseChatClientMessage(message)
    if (!parsed) {
      this.sendToSocket(ws, {
        type: 'action_rejected',
        reason: 'Invalid message format',
        serverTime: Date.now(),
      })
      return
    }

    const room = this.readRoom()
    if (!room) {
      this.sendToSocket(ws, {
        type: 'action_rejected',
        reason: 'Room not found',
        serverTime: Date.now(),
      })
      return
    }

    const attachment = ws.deserializeAttachment() as ChatConnectionAttachment | null
    if (!attachment) {
      this.sendToSocket(ws, {
        type: 'action_rejected',
        reason: 'Missing socket session',
        serverTime: Date.now(),
      })
      return
    }

    if (parsed.type === 'ping') {
      this.sendToSocket(ws, {
        type: 'pong',
        clientTime: parsed.clientTime,
        serverTime: Date.now(),
      })
      return
    }

    if (parsed.type === 'hello') {
      return
    }

    const sender = this.findParticipant(room, attachment.participantId)
    if (!sender) {
      this.sendToSocket(ws, {
        type: 'action_rejected',
        reason: 'Participant not found',
        serverTime: Date.now(),
      })
      return
    }

    const now = Date.now()

    if (parsed.type === 'typing') {
      const nextRoom: ChatRoomRecord = {
        ...room,
        participants: this.touchParticipant(room, sender.participantId, {
          lastTypingAt: now,
          lastSeenAt: now,
          connected: true,
        }),
        lastActiveAt: now,
        expiresAt: computeChatExpiresAt(now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      this.broadcast({
        type: 'typing_updated',
        participantId: sender.participantId,
        lastTypingAt: now,
        serverTime: now,
      })

      return
    }

    const nextMessage = this.createMessage(room, sender, parsed, now)
    if (!nextMessage) {
      this.sendToSocket(ws, {
        type: 'action_rejected',
        reason: 'Message payload is invalid',
        serverTime: now,
      })
      return
    }

    const nextParticipants = this.touchParticipant(room, sender.participantId, {
      lastSeenAt: now,
      lastTypingAt: null,
      connected: true,
    })
    const nextMessages = [...room.messages, nextMessage].slice(-MAX_MESSAGES)
    const nextRoom: ChatRoomRecord = {
      ...room,
      participants: nextParticipants,
      messages: nextMessages,
      lastActiveAt: now,
      expiresAt: computeChatExpiresAt(now),
      version: room.version + 1,
    }

    this.saveRoom(nextRoom)
    await this.scheduleAlarm(nextRoom)

    this.broadcast({
      type: 'message_created',
      message: nextMessage,
      roomVersion: nextRoom.version,
      serverTime: now,
    })
    this.broadcast({
      type: 'presence_updated',
      participants: nextRoom.participants,
      serverTime: now,
    })
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as ChatConnectionAttachment | null
    if (!attachment) {
      ws.close(code, reason)
      return
    }

    const room = this.readRoom()
    if (room) {
      const now = Date.now()
      const nextRoom: ChatRoomRecord = {
        ...room,
        participants: this.touchParticipant(room, attachment.participantId, {
          connected: false,
          lastSeenAt: now,
        }),
        lastActiveAt: now,
        expiresAt: computeChatExpiresAt(now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      this.broadcast(
        {
          type: 'participant_left',
          participantId: attachment.participantId,
          serverTime: now,
        },
        attachment.participantId,
      )
      this.broadcast({
        type: 'presence_updated',
        participants: nextRoom.participants,
        serverTime: now,
      })
    }

    if (!wasClean) {
      ws.close(code, reason)
    }
  }

  async alarm() {
    try {
      const room = this.readRoom()
      if (!room) {
        return
      }

      const now = Date.now()
      if (!shouldExpireChatRoom(room, now)) {
        await this.scheduleAlarm(room)
        return
      }

      this.broadcast({
        type: 'room_expiring',
        expiresAt: room.expiresAt,
        serverTime: now,
      })

      for (const socket of this.ctx.getWebSockets()) {
        socket.close(1001, 'Chat room expired')
      }

      await this.ctx.storage.deleteAll()
    }
    catch (error) {
      console.warn('chat-room: bỏ qua lỗi alarm trong local dev', error)
    }
  }
}
