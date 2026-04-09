import type {
  ChatDiscoveriesResponse,
  ChatRoomStateResponse,
  CreateChatRoomRequest,
  CreateChatRoomResponse,
  JoinChatRoomRequest,
  JoinChatRoomResponse,
  LeaveChatRoomRequest,
  YahooEmoticon,
} from './types'

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }

  return (await response.json()) as T
}

export function createChatRoom(payload: CreateChatRoomRequest): Promise<CreateChatRoomResponse> {
  return requestJson<CreateChatRoomResponse>('/api/chat/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getChatRoom(roomId: string): Promise<ChatRoomStateResponse> {
  return requestJson<ChatRoomStateResponse>(`/api/chat/rooms/${roomId}`)
}

export function joinChatRoom(
  roomId: string,
  payload: JoinChatRoomRequest,
): Promise<JoinChatRoomResponse> {
  return requestJson<JoinChatRoomResponse>(`/api/chat/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function leaveChatRoom(
  roomId: string,
  payload: LeaveChatRoomRequest,
): Promise<ChatRoomStateResponse> {
  return requestJson<ChatRoomStateResponse>(`/api/chat/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getChatDiscoveries(
  kind: 'image' | 'gif' | 'mixed',
  limit = 12,
): Promise<ChatDiscoveriesResponse> {
  return requestJson<ChatDiscoveriesResponse>(
    `/api/apps/chat-online/discoveries?kind=${kind}&limit=${limit}`,
  )
}

export function getYahooEmoticons(): Promise<YahooEmoticon[]> {
  return requestJson<YahooEmoticon[]>('/chat-online/yahoo-emoticons.json')
}
