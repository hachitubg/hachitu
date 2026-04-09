import type { DurableObjectNamespace } from 'cloudflare:workers'
import type {
  ChatDiscoveryItem,
  CreateChatRoomInput,
  JoinChatRoomInput,
  LeaveChatRoomInput,
} from '../../apps/chat-online/types'
import { getChatDiscoveries } from '../../apps/chat-online/service'
import {
  normalizeCreateChatRoomInput,
  normalizeJoinChatRoomInput,
  normalizeLeaveChatRoomInput,
} from '../../apps/chat-online/validators'
import { json, text } from '../../multiplayer/http'
import {
  createRoomId,
  isValidRoomId,
  isWebSocketUpgrade,
} from '../../multiplayer/validators'

interface ChatRoomStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface ChatRoomNamespace {
  getByName(name: string): ChatRoomStub
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): ChatRoomStub
}

export interface ChatOnlineEnv {
  CHAT_ROOM: ChatRoomNamespace | DurableObjectNamespace
}

function getChatRoomStub(env: ChatOnlineEnv, roomId: string): ChatRoomStub {
  return env.CHAT_ROOM.getByName(roomId)
}

function buildInternalUrl(roomId: string, pathname: string, request: Request): URL {
  const url = new URL(request.url)
  url.pathname = pathname
  url.hash = ''
  url.hostname = `${roomId}.chat.internal`
  return url
}

function normalizeDiscoveryKind(value: string | null): 'image' | 'gif' | 'mixed' {
  if (value === 'image' || value === 'gif') {
    return value
  }

  return 'mixed'
}

function normalizeDiscoveryLimit(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 12
  }

  return Math.min(Math.max(Math.trunc(parsed), 6), 24)
}

export async function routeChatOnlineRequest(
  request: Request,
  env: ChatOnlineEnv,
): Promise<Response | null> {
  const url = new URL(request.url)

  if (url.pathname === '/api/apps/chat-online/discoveries' && request.method === 'GET') {
    const kind = normalizeDiscoveryKind(url.searchParams.get('kind'))
    const limit = normalizeDiscoveryLimit(url.searchParams.get('limit'))
    const discoveries: ChatDiscoveryItem[] = await getChatDiscoveries(kind, limit)

    return json({ kind, discoveries })
  }

  if (!url.pathname.startsWith('/api/chat/rooms')) {
    return null
  }

  const segments = url.pathname.split('/').filter(Boolean)

  if (segments.length === 3 && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<CreateChatRoomInput>
    const input = normalizeCreateChatRoomInput(body)
    const roomId = createRoomId()
    const roomStub = getChatRoomStub(env, roomId)

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
        joinPath: `/chat-online?room=${roomId}`,
        api: {
          room: `/api/chat/rooms/${roomId}`,
          join: `/api/chat/rooms/${roomId}/join`,
          leave: `/api/chat/rooms/${roomId}/leave`,
          ws: `/api/chat/rooms/${roomId}/ws`,
        },
      },
      { status: response.status },
    )
  }

  if (segments.length < 4) {
    return text('Not Found', { status: 404 })
  }

  const roomId = segments[3] ?? ''
  if (!isValidRoomId(roomId)) {
    return text('Invalid room id', { status: 400 })
  }

  const roomStub = getChatRoomStub(env, roomId)

  if (segments.length === 4 && request.method === 'GET') {
    return roomStub.fetch(buildInternalUrl(roomId, '/internal/state', request))
  }

  if (segments.length === 5 && segments[4] === 'join' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<JoinChatRoomInput>
    const input = normalizeJoinChatRoomInput(body)

    return roomStub.fetch(buildInternalUrl(roomId, '/internal/join', request), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  }

  if (segments.length === 5 && segments[4] === 'leave' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as Partial<LeaveChatRoomInput>
    const input = normalizeLeaveChatRoomInput(body)

    return roomStub.fetch(buildInternalUrl(roomId, '/internal/leave', request), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  }

  if (segments.length === 5 && segments[4] === 'ws' && request.method === 'GET') {
    if (!isWebSocketUpgrade(request)) {
      return text('Expected Upgrade: websocket', { status: 426 })
    }

    return roomStub.fetch(buildInternalUrl(roomId, '/internal/ws', request), request)
  }

  return text('Not Found', { status: 404 })
}
