import { createRoom, addPlayer, command, view, paused } from './engine.mjs'

export function registerPropertyGame(io) {
  const namespace = io.of('/property-game'),
    rooms = new Map()
  function broadcast(room) {
    if (paused(room) && !room.pauseAt) room.pauseAt = Date.now()
    if (!paused(room) && room.pauseAt) {
      room.pausedMs += Date.now() - room.pauseAt
      room.pauseAt = null
    }
    for (const s of namespace.sockets.values())
      if (s.data.code === room.code) s.emit('state', view(room, s.data.player))
  }
  function attach(socket, room, p) {
    socket.data.code = room.code
    socket.data.player = p.id
    p.connected = true
    broadcast(room)
    return { code: room.code, id: p.id, secret: p.secret }
  }
  function detach(socket, message) {
    socket.data.code = null
    socket.data.player = null
    socket.emit('closed', message)
  }
  namespace.on('connection', (socket) => {
    let windowStart = 0,
      count = 0
    socket.on('command', (request, ack) => {
      if (typeof ack !== 'function') return
      try {
        if (
          !request ||
          typeof request !== 'object' ||
          Array.isArray(request) ||
          JSON.stringify(request).length > 8000
        )
          throw Error('Yêu cầu không hợp lệ.')
        if (Date.now() - windowStart >= 1000) {
          windowStart = Date.now()
          count = 0
        }
        if (++count > 15) throw Error('Thao tác quá nhanh. Hãy thử lại sau một giây.')
        const { action, ...input } = request
        if (['create', 'join', 'resume'].includes(action)) {
          if (socket.data.code) throw Error('Hãy rời phòng hiện tại trước.')
          if (action === 'create') {
            if (rooms.size >= 100) throw Error('Server đầy phòng. Thử lại sau.')
            let room = createRoom(input.name, input.token)
            while (rooms.has(room.code)) room = createRoom(input.name, input.token)
            rooms.set(room.code, room)
            ack({ ok: true, session: attach(socket, room, room.players[0]) })
            return
          }
          const room = rooms.get(
            String(input.code || '')
              .trim()
              .toUpperCase(),
          )
          if (!room || room.expires <= Date.now())
            throw Object.assign(Error('Phòng không còn tồn tại.'), { code: 'EXPIRED' })
          const p =
            action === 'join'
              ? addPlayer(room, input.name, input.token)
              : room.players.find((p) => p.id === input.id && p.secret === input.secret)
          if (!p)
            throw Object.assign(Error('Không khôi phục được phiên chơi.'), { code: 'EXPIRED' })
          ack({ ok: true, session: attach(socket, room, p) })
          return
        }
        const room = rooms.get(socket.data.code),
          p = room?.players.find((p) => p.id === socket.data.player)
        if (!room || !p) throw Error('Bạn chưa vào phòng.')
        if (input.revision !== room.revision) throw Error('Bàn cờ vừa thay đổi. Hãy thao tác lại.')
        if (action === 'close') {
          if (room.hostId !== p.id) throw Error('Chỉ chủ phòng được đóng phòng.')
          for (const s of namespace.sockets.values())
            if (s.data.code === room.code) detach(s, 'Chủ phòng đã kết thúc buổi chơi.')
          rooms.delete(room.code)
          ack({ ok: true })
          return
        }
        if (action === 'leave' || action === 'kick') {
          if (!['lobby', 'ended'].includes(room.phase))
            throw Error('Ván đang diễn ra. Mở lại trang để trở về phòng.')
          if (action === 'kick' && (p.id !== room.hostId || input.id === p.id))
            throw Error('Chỉ chủ phòng được mời người khác rời phòng.')
          const id = action === 'leave' ? p.id : input.id
          room.players = room.players.filter((q) => q.id !== id)
          for (const s of namespace.sockets.values())
            if (s.data.code === room.code && s.data.player === id) detach(s, 'Bạn đã rời phòng.')
          if (!room.players.length) rooms.delete(room.code)
          else {
            if (room.hostId === id) room.hostId = room.players[0].id
            room.revision++
            room.players.forEach((q) => {
              q.ready = false
            })
            broadcast(room)
          }
          ack({ ok: true })
          return
        }
        command(room, p.id, action, input)
        broadcast(room)
        ack({ ok: true })
      } catch (error) {
        ack({
          ok: false,
          error: error.message || 'Không thực hiện được thao tác.',
          code: error.code || 'INVALID',
        })
      }
    })
    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.code),
        p = room?.players.find((p) => p.id === socket.data.player)
      if (!p) return
      p.connected = [...namespace.sockets.values()].some(
        (s) => s.data.code === room.code && s.data.player === p.id,
      )
      broadcast(room)
    })
  })
  const timer = setInterval(() => {
    for (const [code, room] of rooms)
      if (room.expires <= Date.now()) {
        for (const s of namespace.sockets.values())
          if (s.data.code === code) detach(s, 'Phòng hết hạn sau 24 giờ.')
        rooms.delete(code)
      }
  }, 60000)
  timer.unref()
  io.engine.on('close', () => clearInterval(timer))
  return { rooms, close: () => clearInterval(timer) }
}
