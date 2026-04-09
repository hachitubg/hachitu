import { DurableObject } from 'cloudflare:workers'
import { json, text } from '../multiplayer/http'
import { parseClientMessage, serializeServerMessage } from '../multiplayer/protocol'
import {
  type ConnectionAttachment,
  type CreateRoomInput,
  type GameRoomRecord,
  type JoinRoomInput,
  type LeaveRoomInput,
  type RoomPlayer,
  type StartRoomInput,
} from '../multiplayer/room-types'
import { computeExpiresAt, getNextAlarmAt, shouldExpireRoom } from '../multiplayer/ttl'

type Env = Record<string, never>

interface RoomRow {
  room_json: string
}

const ROOM_BOOTSTRAP_STATE = JSON.stringify({
  phase: 'lobby',
  lastAction: null,
})

export class GameRoomDurableObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ensureSchema()
  }

  private ensureSchema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        singleton_key INTEGER PRIMARY KEY CHECK (singleton_key = 1),
        room_json TEXT NOT NULL
      )
    `)
  }

  private readRoom(): GameRoomRecord | null {
    const cursor = this.ctx.storage.sql.exec('SELECT room_json FROM room_state WHERE singleton_key = 1')
    const row = cursor.next()
    if (row.done) {
      return null
    }

    const data = row.value as RoomRow
    return JSON.parse(data.room_json) as GameRoomRecord
  }

  private saveRoom(room: GameRoomRecord) {
    this.ctx.storage.sql.exec('DELETE FROM room_state WHERE singleton_key = 1')
    this.ctx.storage.sql.exec('INSERT INTO room_state (singleton_key, room_json) VALUES (?, ?)', 1, JSON.stringify(room))
  }

  private async scheduleAlarm(room: GameRoomRecord) {
    await this.ctx.storage.setAlarm(getNextAlarmAt(room))
  }

  private buildPlayerConnectedState(players: RoomPlayer[], playerId: string, connected: boolean): RoomPlayer[] {
    return players.map((player) =>
      player.playerId === playerId ? { ...player, connected } : player,
    )
  }

  private sendToWebSocket(ws: WebSocket, message: Parameters<typeof serializeServerMessage>[0]) {
    ws.send(serializeServerMessage(message))
  }

  private broadcast(message: Parameters<typeof serializeServerMessage>[0], excludePlayerId = '') {
    const payload = serializeServerMessage(message)

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as ConnectionAttachment | null
      if (attachment && attachment.playerId === excludePlayerId) {
        continue
      }
      socket.send(payload)
    }
  }

  private getConnectionAttachment(request: Request): ConnectionAttachment {
    const url = new URL(request.url)
    return {
      playerId: url.searchParams.get('playerId') ?? '',
      sessionId: url.searchParams.get('sessionId') ?? '',
      displayName: url.searchParams.get('displayName') ?? 'Guest',
      joinedAt: Date.now(),
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/internal/create') {
      const input = (await request.json()) as CreateRoomInput
      const roomId = url.hostname.split('.')[0] ?? crypto.randomUUID()
      const now = Date.now()
      const hostPlayerId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const hostSessionId = crypto.randomUUID()

      const existingRoom = this.readRoom()
      if (existingRoom) {
        return json({ room: existingRoom })
      }

      const room: GameRoomRecord = {
        roomId,
        gameType: input.gameType,
        createdAt: now,
        lastActiveAt: now,
        expiresAt: computeExpiresAt('waiting', now),
        status: 'waiting',
        version: 1,
        maxPlayers: input.maxPlayers,
        hostPlayerId,
        gameStateJson: ROOM_BOOTSTRAP_STATE,
        players: [
          {
            playerId: hostPlayerId,
            sessionId: hostSessionId,
            displayName: input.displayName,
            joinedAt: now,
            connected: false,
            isHost: true,
          },
        ],
      }

      this.saveRoom(room)
      await this.scheduleAlarm(room)

      return json({
        room,
        host: {
          playerId: hostPlayerId,
          sessionId: hostSessionId,
          displayName: input.displayName,
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
      const input = (await request.json()) as JoinRoomInput
      const room = this.readRoom()
      if (!room) {
        return text('Room not found', { status: 404 })
      }

      const now = Date.now()
      const existingPlayer = room.players.find((player) => player.playerId === input.playerId)
      const nextPlayers = existingPlayer
        ? room.players.map((player) =>
            player.playerId === input.playerId
              ? {
                  ...player,
                  displayName: input.displayName,
                  sessionId: input.sessionId,
                  connected: false,
                }
              : player,
          )
        : [
            ...room.players,
            {
              playerId: input.playerId,
              sessionId: input.sessionId,
              displayName: input.displayName,
              joinedAt: now,
              connected: false,
              isHost: false,
            },
          ]

      const nextRoom: GameRoomRecord = {
        ...room,
        players: nextPlayers,
        lastActiveAt: now,
        expiresAt: computeExpiresAt(room.status, now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      return json({
        room: nextRoom,
        player: nextPlayers.find((player) => player.playerId === input.playerId),
        websocketUrl: `/api/rooms/${nextRoom.roomId}/ws?playerId=${input.playerId}&sessionId=${input.sessionId}&displayName=${encodeURIComponent(input.displayName)}`,
      })
    }

    if (request.method === 'POST' && url.pathname === '/internal/leave') {
      const input = (await request.json()) as LeaveRoomInput
      const room = this.readRoom()
      if (!room) {
        return text('Room not found', { status: 404 })
      }

      const now = Date.now()
      const nextRoom: GameRoomRecord = {
        ...room,
        players: this.buildPlayerConnectedState(room.players, input.playerId, false),
        lastActiveAt: now,
        expiresAt: computeExpiresAt(room.status, now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      this.broadcast(
        {
          type: 'player_left',
          playerId: input.playerId,
          serverTime: now,
        },
        input.playerId,
      )

      return json({ room: nextRoom })
    }

    if (request.method === 'POST' && url.pathname === '/internal/start') {
      const input = (await request.json()) as StartRoomInput
      const room = this.readRoom()
      if (!room) {
        return text('Room not found', { status: 404 })
      }

      if (room.hostPlayerId !== input.requestedByPlayerId) {
        return text('Only host can start the room', { status: 403 })
      }

      const now = Date.now()
      const nextRoom: GameRoomRecord = {
        ...room,
        status: 'playing',
        lastActiveAt: now,
        expiresAt: computeExpiresAt('playing', now),
        version: room.version + 1,
        gameStateJson: JSON.stringify({
          phase: 'playing',
          startedAt: now,
          lastAction: null,
        }),
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)
      this.broadcast({
        type: 'state_patch',
        room: nextRoom,
        serverTime: now,
      })

      return json({ room: nextRoom })
    }

    if (request.method === 'GET' && url.pathname === '/internal/ws') {
      const webSocketPair = new WebSocketPair()
      const [client, server] = Object.values(webSocketPair)
      const attachment = this.getConnectionAttachment(request)

      this.ctx.acceptWebSocket(server)
      server.serializeAttachment(attachment)

      const room = this.readRoom()
      if (!room) {
        server.close(1011, 'Room not found')
        return new Response(null, { status: 101, webSocket: client })
      }

      const now = Date.now()
      const nextRoom: GameRoomRecord = {
        ...room,
        players: this.buildPlayerConnectedState(room.players, attachment.playerId, true),
        lastActiveAt: now,
        expiresAt: computeExpiresAt(room.status, now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      this.sendToWebSocket(server, {
        type: 'initial_state',
        room: nextRoom,
        serverTime: now,
      })

      const joinedPlayer = nextRoom.players.find((player) => player.playerId === attachment.playerId)
      if (joinedPlayer) {
        this.broadcast(
          {
            type: 'player_joined',
            player: joinedPlayer,
            serverTime: now,
          },
          attachment.playerId,
        )
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    }

    return text('Not Found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string') {
      return
    }

    const parsed = parseClientMessage(message)
    if (!parsed) {
      this.sendToWebSocket(ws, {
        type: 'action_rejected',
        reason: 'Invalid message format',
        serverTime: Date.now(),
      })
      return
    }

    const room = this.readRoom()
    if (!room) {
      this.sendToWebSocket(ws, {
        type: 'action_rejected',
        reason: 'Room not found',
        serverTime: Date.now(),
      })
      return
    }

    if (parsed.type === 'ping') {
      this.sendToWebSocket(ws, {
        type: 'pong',
        clientTime: parsed.clientTime,
        serverTime: Date.now(),
      })
      return
    }

    if (parsed.type === 'hello') {
      return
    }

    const now = Date.now()
    const nextRoom: GameRoomRecord = {
      ...room,
      lastActiveAt: now,
      expiresAt: computeExpiresAt(room.status, now),
      version: room.version + 1,
      gameStateJson: JSON.stringify({
        phase: room.status,
        lastAction: {
          action: parsed.action,
          payloadJson: parsed.payloadJson,
          playerId: parsed.playerId,
          seq: parsed.seq,
          at: now,
        },
      }),
    }

    this.saveRoom(nextRoom)
    await this.scheduleAlarm(nextRoom)

    this.broadcast({
      type: 'state_patch',
      room: nextRoom,
      serverTime: now,
    })
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null
    if (!attachment) {
      ws.close(code, reason)
      return
    }

    const room = this.readRoom()
    if (room) {
      const now = Date.now()
      const nextRoom: GameRoomRecord = {
        ...room,
        players: this.buildPlayerConnectedState(room.players, attachment.playerId, false),
        lastActiveAt: now,
        expiresAt: computeExpiresAt(room.status, now),
        version: room.version + 1,
      }

      this.saveRoom(nextRoom)
      await this.scheduleAlarm(nextRoom)

      this.broadcast(
        {
          type: 'player_left',
          playerId: attachment.playerId,
          serverTime: now,
        },
        attachment.playerId,
      )
    }

    if (!wasClean) {
      ws.close(code, reason)
    }
  }

  async alarm() {
    const room = this.readRoom()
    if (!room) {
      return
    }

    const now = Date.now()

    if (!shouldExpireRoom(room, now)) {
      await this.scheduleAlarm(room)
      return
    }

    this.broadcast({
      type: 'room_expiring',
      expiresAt: room.expiresAt,
      serverTime: now,
    })

    for (const socket of this.ctx.getWebSockets()) {
      socket.close(1001, 'Room expired')
    }

    await this.ctx.storage.deleteAll()
  }
}
