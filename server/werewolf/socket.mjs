import { createRoom, addPlayer, catalog, command, view, tick, paused } from './engine.mjs'

export function registerWerewolf(io) {
  const namespace = io.of('/werewolf')
  const rooms = new Map()
  const rate = new Map()
  function broadcast(room) {
    const waiting = paused(room)
    if (waiting && !room.pauseStarted) room.pauseStarted = Date.now()
    if (!waiting && room.pauseStarted) {
      if (room.deadline) room.deadline += Date.now() - room.pauseStarted
      room.pauseStarted = null
    }
    for (const socket of namespace.sockets.values()) {
      if (socket.data.room !== room.code) continue
      const person = room.members.find((p) => p.id === socket.data.person)
      if (person) socket.emit('state', view(room, person))
    }
  }
  function attach(socket, room, person) {
    if (socket.data.room) throw new Error('Hãy rời phòng hiện tại trước.')
    socket.data.room = room.code
    socket.data.person = person.id
    person.connected = true
    broadcast(room)
    return { code: room.code, id: person.id, token: person.token }
  }
  namespace.on('connection', (socket) => {
    socket.emit('catalog', catalog)
    socket.on('command', (request, ack) => {
      if (typeof ack !== 'function') return
      try {
        if (
          !request ||
          typeof request.action !== 'string' ||
          JSON.stringify(request).length > 70000
        )
          throw new Error('Yêu cầu không hợp lệ.')
        // A whole table can share one Wi-Fi address (and nginx proxies every socket).
        const bucketKey = socket.id
        const bucket = rate.get(bucketKey) || { at: Date.now(), count: 0 }
        if (Date.now() - bucket.at > 1000) {
          bucket.at = Date.now()
          bucket.count = 0
        }
        bucket.count++
        rate.set(bucketKey, bucket)
        if (bucket.count > 80)
          throw Object.assign(new Error('Thao tác quá nhanh. Hãy thử lại sau một giây.'), {
            code: 'RATE_LIMIT',
          })
        const { action, ...input } = request
        if (action === 'create') {
          if (socket.data.room) throw new Error('Bạn đang ở trong một phòng.')
          if (rooms.size >= 200) throw new Error('Server đang đầy phòng. Hãy thử lại sau.')
          let room = createRoom(input.name, input.avatar, Date.now(), input.cardsOnly === true)
          while (rooms.has(room.code))
            room = createRoom(input.name, input.avatar, Date.now(), input.cardsOnly === true)
          rooms.set(room.code, room)
          ack({ ok: true, session: attach(socket, room, room.members[0]) })
          return
        }
        if (action === 'join' || action === 'resume') {
          if (socket.data.room) throw new Error('Bạn đang ở trong một phòng.')
          const room = rooms.get(
            String(input.code || '')
              .trim()
              .toUpperCase(),
          )
          if (!room || room.expires < Date.now())
            throw Object.assign(new Error('Phòng không còn tồn tại hoặc đã hết buổi chơi.'), {
              code: 'SESSION_EXPIRED',
            })
          const person =
            action === 'join'
              ? addPlayer(room, input.name, input.avatar)
              : room.members.find((p) => p.id === input.id && p.token === input.token)
          if (!person)
            throw Object.assign(new Error('Không thể khôi phục người chơi trên thiết bị này.'), {
              code: 'SESSION_INVALID',
            })
          ack({ ok: true, session: attach(socket, room, person) })
          return
        }
        const room = rooms.get(socket.data.room)
        const actor = room?.members.find((p) => p.id === socket.data.person)
        if (!room || !actor) throw new Error('Bạn chưa vào phòng hoặc phiên đã hết hạn.')
        if (action === 'kick') {
          if (!actor.host || room.phase !== 'lobby')
            throw new Error('Chỉ quản trò được xóa người ở phòng chờ.')
          const target = room.members.find((p) => p.id === input.playerId && !p.host)
          if (!target) throw new Error('Người chơi không còn trong phòng.')
          room.members = room.members.filter((p) => p.id !== target.id)
          room.deck = []
          room.revision++
          for (const client of namespace.sockets.values())
            if (client.data.room === room.code && client.data.person === target.id) {
              client.data.room = null
              client.data.person = null
              client.emit('closed', 'Quản trò đã xóa bạn khỏi phòng chờ.')
            }
          broadcast(room)
          ack({ ok: true })
          return
        }
        if (action === 'leave') {
          if (!['lobby', 'ended'].includes(room.phase))
            throw new Error('Ván đang diễn ra. Mất kết nối sẽ tạm dừng ván để chờ bạn.')
          if (actor.host) {
            for (const client of namespace.sockets.values())
              if (client.data.room === room.code) {
                client.emit('closed', 'Quản trò đã kết thúc buổi chơi.')
                client.data.room = null
                client.data.person = null
              }
            rooms.delete(room.code)
          } else {
            room.members = room.members.filter((p) => p.id !== actor.id)
            if (room.phase === 'lobby') {
              room.deck = []
              room.revision++
            }
            for (const client of namespace.sockets.values())
              if (client.data.room === room.code && client.data.person === actor.id) {
                client.data.room = null
                client.data.person = null
                client.emit('closed', 'Bạn đã rời phòng.')
              }
            broadcast(room)
          }
          ack({ ok: true })
          return
        }
        command(room, actor, action, input)
        broadcast(room)
        ack({ ok: true })
      } catch (error) {
        ack({
          ok: false,
          error: error instanceof Error ? error.message : 'Không thể thực hiện thao tác.',
          code: error?.code || 'INVALID_ACTION',
        })
      }
    })
    socket.on('disconnect', () => {
      rate.delete(socket.id)
      const room = rooms.get(socket.data.room)
      const person = room?.members.find((p) => p.id === socket.data.person)
      if (!person) return
      person.connected = [...namespace.sockets.values()].some(
        (s) => s.data.room === room.code && s.data.person === person.id,
      )
      broadcast(room)
    })
  })
  const timer = setInterval(() => {
    for (const [code, room] of rooms) {
      if (Date.now() >= room.expires) {
        for (const socket of namespace.sockets.values())
          if (socket.data.room === code) {
            socket.emit('closed', 'Buổi chơi đã hết hạn sau 24 giờ.')
            socket.data.room = null
            socket.data.person = null
          }
        rooms.delete(code)
      } else if (tick(room)) broadcast(room)
    }
    for (const [key, value] of rate) if (Date.now() - value.at > 60000) rate.delete(key)
  }, 250)
  timer.unref()
  io.engine.on('close', () => clearInterval(timer))
  return { rooms, close: () => clearInterval(timer) }
}
