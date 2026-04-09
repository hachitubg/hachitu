import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { URL } from 'node:url'
import { Server as SocketIOServer } from 'socket.io'

const PORT = Number(process.env.HACHITU_SERVER_PORT || 3001)
const ROOM_TTL_MS = 1000 * 60 * 60 * 24
const MAX_MESSAGES = 180
const rooms = new Map()

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function text(response, statusCode, message) {
  response.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(message)
}

function createId(length = 12) {
  return randomUUID().replace(/-/g, '').slice(0, length)
}

function trimValue(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function normalizeAvatarPreset(value) {
  return trimValue(value, 16) || null
}

function normalizeRoomName(value) {
  return trimValue(value, 48)
}

function normalizeDisplayName(value) {
  return trimValue(value, 24)
}

function computeExpiresAt(now) {
  return now + ROOM_TTL_MS
}

function getRoom(roomId) {
  return rooms.get(roomId) ?? null
}

function touchRoom(room) {
  const now = Date.now()
  room.lastActiveAt = now
  room.expiresAt = computeExpiresAt(now)
}

function makeParticipant({ participantId, sessionId, displayName, avatarPreset, isHost = false }) {
  const now = Date.now()
  return {
    participantId,
    sessionId,
    displayName,
    avatarPreset,
    joinedAt: now,
    lastSeenAt: now,
    lastTypingAt: null,
    connected: false,
    isHost,
  }
}

function makeRoom({ roomName, host }) {
  const now = Date.now()
  return {
    roomId: createId(8),
    roomName,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: computeExpiresAt(now),
    version: 1,
    hostParticipantId: host.participantId,
    participants: [host],
    messages: [],
  }
}

function findParticipant(room, participantId) {
  return room.participants.find((participant) => participant.participantId === participantId) ?? null
}

function upsertParticipant(room, nextParticipant) {
  const index = room.participants.findIndex(
    (participant) => participant.participantId === nextParticipant.participantId,
  )
  if (index === -1) {
    room.participants.push(nextParticipant)
  } else {
    room.participants[index] = {
      ...room.participants[index],
      ...nextParticipant,
    }
  }
}

function toRoomResponse(room) {
  return {
    roomId: room.roomId,
    room,
    host: room.participants.find((participant) => participant.isHost) ?? null,
    joinPath: `/chat-online?room=${room.roomId}`,
    api: {
      room: `/api/chat/rooms/${room.roomId}`,
      join: `/api/chat/rooms/${room.roomId}/join`,
      leave: `/api/chat/rooms/${room.roomId}/leave`,
      ws: '/socket.io',
    },
  }
}

function buildAttachment(templateId, title, mediaUrl, mediaKind, pageUrl = null, previewUrl = null) {
  return {
    templateId,
    title,
    mediaUrl,
    mediaKind,
    pageUrl,
    previewUrl,
  }
}

function isSafeMediaUrl(value) {
  return /^https:\/\/[^\s]+$/i.test(value) || /^\/chat-online\/[^\s]+$/i.test(value)
}

function validateAttachment(attachment, allowedKinds) {
  if (!attachment) {
    return null
  }

  const templateId = trimValue(attachment.templateId, 32)
  const title = trimValue(attachment.title, 80)
  const mediaUrl = trimValue(attachment.mediaUrl, 500)
  const previewUrl = trimValue(attachment.previewUrl ?? '', 500)
  const pageUrl = trimValue(attachment.pageUrl ?? '', 500)
  const mediaKind = allowedKinds.includes(attachment.mediaKind) ? attachment.mediaKind : null

  if (!templateId || !title || !mediaUrl || !mediaKind || !isSafeMediaUrl(mediaUrl)) {
    return null
  }

  if (previewUrl && !isSafeMediaUrl(previewUrl)) {
    return null
  }

  if (pageUrl && !isSafeMediaUrl(pageUrl)) {
    return null
  }

  return buildAttachment(
    templateId,
    title,
    mediaUrl,
    mediaKind,
    pageUrl || null,
    previewUrl || null,
  )
}

function createMessage(room, sender, payload) {
  const now = Date.now()
  if (payload.type !== 'send_message') {
    return null
  }

  if (payload.kind === 'text') {
    const text = trimValue(payload.text, 500)
    if (!text) {
      return null
    }

    return {
      messageId: createId(16),
      participantId: sender.participantId,
      displayName: sender.displayName,
      kind: 'text',
      text,
      attachment: null,
      createdAt: now,
    }
  }

  if (payload.kind === 'icon') {
    const attachment = validateAttachment(payload.icon, ['gif'])
    if (!attachment) {
      return null
    }
    return {
      messageId: createId(16),
      participantId: sender.participantId,
      displayName: sender.displayName,
      kind: 'icon',
      text: attachment.title,
      attachment,
      createdAt: now,
    }
  }

  if (payload.kind === 'meme') {
    const attachment = validateAttachment(payload.meme, ['gif', 'image', 'video'])
    if (!attachment) {
      return null
    }
    return {
      messageId: createId(16),
      participantId: sender.participantId,
      displayName: sender.displayName,
      kind: 'meme',
      text: attachment.title,
      attachment,
      createdAt: now,
    }
  }

  return null
}

async function parseJsonBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  if (!chunks.length) {
    return {}
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
  } catch {
    return {}
  }
}

async function fetchImgflipMemes(kind) {
  const response = await fetch(`https://api.imgflip.com/get_memes?type=${kind}`)
  if (!response.ok) {
    return []
  }
  const payload = await response.json()
  const memes = payload?.data?.memes ?? []
  return memes.map((item) => ({
    id: item.id,
    title: item.name,
    imageUrl: item.url,
    pageUrl: `https://imgflip.com/memegenerator/${item.id}`,
    width: item.width,
    height: item.height,
    mediaKind: item.url.endsWith('.mp4') || item.url.endsWith('.webm') ? 'video' : kind,
  }))
}

function shuffle(items) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = next[index]
    next[index] = next[swapIndex]
    next[swapIndex] = current
  }
  return next
}

async function getDiscoveries(kind, limit) {
  if (kind === 'image') {
    return shuffle(await fetchImgflipMemes('image')).slice(0, limit)
  }
  if (kind === 'gif') {
    return shuffle(await fetchImgflipMemes('gif')).slice(0, limit)
  }
  const [images, gifs] = await Promise.all([fetchImgflipMemes('image'), fetchImgflipMemes('gif')])
  return shuffle([...images, ...gifs]).slice(0, limit)
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    text(response, 400, 'Invalid request')
    return
  }

  const url = new URL(request.url, `http://${request.headers.host}`)
  const segments = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/api/health' && request.method === 'GET') {
    json(response, 200, {
      name: 'hachitu-server',
      port: PORT,
      realtime: 'socket.io',
      persistence: 'memory',
    })
    return
  }

  if (url.pathname === '/api/apps/chat-online/discoveries' && request.method === 'GET') {
    const kind = ['image', 'gif'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'mixed'
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 12), 6), 24)
    json(response, 200, {
      kind,
      discoveries: await getDiscoveries(kind, limit),
    })
    return
  }

  if (url.pathname === '/api/chat/rooms' && request.method === 'POST') {
    const body = await parseJsonBody(request)
    const displayName = normalizeDisplayName(body.displayName)
    const roomName = normalizeRoomName(body.roomName)

    if (!displayName || !roomName) {
      text(response, 400, 'Missing display name or room name')
      return
    }

    const host = makeParticipant({
      participantId: createId(),
      sessionId: createId(24),
      displayName,
      avatarPreset: normalizeAvatarPreset(body.avatarPreset),
      isHost: true,
    })

    const room = makeRoom({ roomName, host })
    rooms.set(room.roomId, room)
    json(response, 200, toRoomResponse(room))
    return
  }

  if (segments[0] === 'api' && segments[1] === 'chat' && segments[2] === 'rooms' && segments[3]) {
    const room = getRoom(segments[3])
    if (!room) {
      text(response, 404, 'Room not found')
      return
    }

    if (segments.length === 4 && request.method === 'GET') {
      touchRoom(room)
      json(response, 200, { room })
      return
    }

    if (segments[4] === 'join' && request.method === 'POST') {
      const body = await parseJsonBody(request)
      const displayName = normalizeDisplayName(body.displayName)

      if (!displayName) {
        text(response, 400, 'Missing display name')
        return
      }

      const participantId = trimValue(body.participantId, 64) || createId()
      const sessionId = trimValue(body.sessionId, 64) || createId(24)
      const avatarPreset = normalizeAvatarPreset(body.avatarPreset)
      const existing = findParticipant(room, participantId)
      const participant = existing
        ? {
            ...existing,
            displayName,
            sessionId,
            avatarPreset,
            lastSeenAt: Date.now(),
          }
        : makeParticipant({
            participantId,
            sessionId,
            displayName,
            avatarPreset,
          })

      upsertParticipant(room, participant)
      room.version += 1
      touchRoom(room)
      json(response, 200, {
        room,
        participant,
        websocketUrl: '/socket.io',
      })
      return
    }

    if (segments[4] === 'leave' && request.method === 'POST') {
      const body = await parseJsonBody(request)
      const participant = findParticipant(room, trimValue(body.participantId, 64))
      if (participant) {
        participant.connected = false
        participant.lastSeenAt = Date.now()
      }
      room.version += 1
      touchRoom(room)
      io.to(room.roomId).emit('chat:event', {
        type: 'presence_updated',
        participants: room.participants,
        serverTime: Date.now(),
      })
      json(response, 200, { room })
      return
    }
  }

  text(response, 404, 'Not Found')
})

const io = new SocketIOServer(server, {
  path: '/socket.io',
  cors: {
    origin: true,
    credentials: true,
  },
})

io.on('connection', (socket) => {
  const roomId = trimValue(socket.handshake.query.roomId, 32)
  const participantId = trimValue(socket.handshake.query.participantId, 64)
  const sessionId = trimValue(socket.handshake.query.sessionId, 64)
  const displayName = normalizeDisplayName(socket.handshake.query.displayName)
  const avatarPreset = normalizeAvatarPreset(socket.handshake.query.avatarPreset)

  const room = getRoom(roomId)
  const participant = room ? findParticipant(room, participantId) : null

  if (!room || !participant || participant.sessionId !== sessionId) {
    socket.emit('chat:event', {
      type: 'action_rejected',
      reason: 'Không thể kết nối vào room này.',
      serverTime: Date.now(),
    })
    socket.disconnect(true)
    return
  }

  socket.data.roomId = roomId
  socket.data.participantId = participantId
  socket.join(roomId)

  participant.connected = true
  participant.displayName = displayName || participant.displayName
  participant.avatarPreset = avatarPreset ?? participant.avatarPreset
  participant.lastSeenAt = Date.now()
  touchRoom(room)
  room.version += 1

  socket.emit('chat:event', {
    type: 'initial_state',
    room,
    serverTime: Date.now(),
  })

  socket.to(roomId).emit('chat:event', {
    type: 'participant_joined',
    participant,
    serverTime: Date.now(),
  })

  io.to(roomId).emit('chat:event', {
    type: 'presence_updated',
    participants: room.participants,
    serverTime: Date.now(),
  })

  socket.on('chat:client', (payload) => {
    const activeRoom = getRoom(roomId)
    const sender = activeRoom ? findParticipant(activeRoom, participantId) : null
    if (!activeRoom || !sender) {
      socket.emit('chat:event', {
        type: 'action_rejected',
        reason: 'Room không còn tồn tại.',
        serverTime: Date.now(),
      })
      return
    }

    if (payload?.type === 'hello') {
      return
    }

    if (payload?.type === 'ping') {
      socket.emit('chat:event', {
        type: 'pong',
        clientTime: Number(payload.clientTime || Date.now()),
        serverTime: Date.now(),
      })
      return
    }

    if (payload?.type === 'typing') {
      sender.lastTypingAt = Date.now()
      sender.lastSeenAt = Date.now()
      sender.connected = true
      touchRoom(activeRoom)
      io.to(roomId).emit('chat:event', {
        type: 'typing_updated',
        participantId,
        lastTypingAt: sender.lastTypingAt,
        serverTime: Date.now(),
      })
      return
    }

    const message = createMessage(activeRoom, sender, payload)
    if (!message) {
      socket.emit('chat:event', {
        type: 'action_rejected',
        reason: 'Nội dung tin nhắn không hợp lệ.',
        serverTime: Date.now(),
      })
      return
    }

    sender.lastSeenAt = Date.now()
    sender.lastTypingAt = null
    sender.connected = true
    activeRoom.messages = [...activeRoom.messages, message].slice(-MAX_MESSAGES)
    activeRoom.version += 1
    touchRoom(activeRoom)

    io.to(roomId).emit('chat:event', {
      type: 'message_created',
      message,
      roomVersion: activeRoom.version,
      serverTime: Date.now(),
    })

    io.to(roomId).emit('chat:event', {
      type: 'presence_updated',
      participants: activeRoom.participants,
      serverTime: Date.now(),
    })
  })

  socket.on('disconnect', () => {
    const activeRoom = getRoom(roomId)
    const leaving = activeRoom ? findParticipant(activeRoom, participantId) : null
    if (!activeRoom || !leaving) {
      return
    }

    leaving.connected = false
    leaving.lastSeenAt = Date.now()
    activeRoom.version += 1
    touchRoom(activeRoom)

    socket.to(roomId).emit('chat:event', {
      type: 'participant_left',
      participantId,
      serverTime: Date.now(),
    })

    io.to(roomId).emit('chat:event', {
      type: 'presence_updated',
      participants: activeRoom.participants,
      serverTime: Date.now(),
    })
  })
})

setInterval(() => {
  const now = Date.now()
  for (const [roomId, room] of rooms.entries()) {
    if (room.lastActiveAt + ROOM_TTL_MS > now) {
      continue
    }
    io.to(roomId).emit('chat:event', {
      type: 'room_expiring',
      expiresAt: room.expiresAt,
      serverTime: now,
    })
    rooms.delete(roomId)
  }
}, 60_000).unref()

server.listen(PORT, () => {
  console.log(`[hachitu-server] listening on http://127.0.0.1:${PORT}`)
})
