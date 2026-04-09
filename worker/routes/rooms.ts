import type { DurableObjectNamespace } from 'cloudflare:workers'
import { json, text } from '../multiplayer/http'
import {
  createRoomId,
  isValidRoomId,
  isWebSocketUpgrade,
  normalizeCreateRoomInput,
  normalizeJoinRoomInput,
  normalizeLeaveRoomInput,
  normalizeStartRoomInput,
} from '../multiplayer/validators'

interface RoomStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface RoomNamespace {
  getByName(name: string): RoomStub
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): RoomStub
}

export interface MultiplayerEnv {
  ASSETS: Fetcher
  GAME_ROOM: RoomNamespace | DurableObjectNamespace
}

function getRoomStub(env: MultiplayerEnv, roomId: string): RoomStub {
  return env.GAME_ROOM.getByName(roomId)
}

function buildInternalUrl(roomId: string, pathname: string, request: Request): URL {
  const url = new URL(request.url)
  url.pathname = pathname
  url.search = ''
  url.hash = ''
  url.hostname = `${roomId}.room.internal`
  return url
}

export async function routeRoomRequest(
  request: Request,
  env: MultiplayerEnv,
): Promise<Response | null> {
  const url = new URL(request.url)

  if (!url.pathname.startsWith('/api/rooms')) {
    return null
  }

  const segments = url.pathname.split('/').filter(Boolean)

  if (segments.length === 2 && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<{
      gameType: string
      displayName: string
      maxPlayers: number
    }>
    const input = normalizeCreateRoomInput(body)
    const roomId = createRoomId()
    const roomStub = getRoomStub(env, roomId)

    const response = await roomStub.fetch(buildInternalUrl(roomId, '/internal/create', request), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })

    const payload = await response.json()

    return json(
      {
        ...payload,
        roomId,
        joinUrl: `/room/${roomId}`,
        api: {
          room: `/api/rooms/${roomId}`,
          join: `/api/rooms/${roomId}/join`,
          ws: `/api/rooms/${roomId}/ws`,
        },
      },
      { status: response.status },
    )
  }

  if (segments.length < 3) {
    return text('Not Found', { status: 404 })
  }

  const roomId = segments[2] ?? ''
  if (!isValidRoomId(roomId)) {
    return text('Invalid room id', { status: 400 })
  }

  const roomStub = getRoomStub(env, roomId)

  if (segments.length === 3 && request.method === 'GET') {
    return roomStub.fetch(buildInternalUrl(roomId, '/internal/state', request))
  }

  if (segments.length === 4 && segments[3] === 'join' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<{
      displayName: string
      sessionId: string
      playerId: string
    }>
    const input = normalizeJoinRoomInput(body)

    return roomStub.fetch(buildInternalUrl(roomId, '/internal/join', request), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  }

  if (segments.length === 4 && segments[3] === 'leave' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<{ playerId: string }>
    const input = normalizeLeaveRoomInput(body)

    return roomStub.fetch(buildInternalUrl(roomId, '/internal/leave', request), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  }

  if (segments.length === 4 && segments[3] === 'start' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<{ requestedByPlayerId: string }>
    const input = normalizeStartRoomInput(body)

    return roomStub.fetch(buildInternalUrl(roomId, '/internal/start', request), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  }

  if (segments.length === 4 && segments[3] === 'ws' && request.method === 'GET') {
    if (!isWebSocketUpgrade(request)) {
      return text('Expected Upgrade: websocket', { status: 426 })
    }

    return roomStub.fetch(buildInternalUrl(roomId, '/internal/ws', request), request)
  }

  return text('Not Found', { status: 404 })
}
