import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as client } from 'socket.io-client'
import { registerPropertyGame } from './socket.mjs'
import { defaultCharacter } from '../../src/views/co-ty-phu/character-config.mjs'

test('real online table: create/join, auth, ready, atomic roll, pause/resume, close and token privacy', async (t) => {
  const http = createServer(),
    io = new Server(http),
    service = registerPropertyGame(io),
    sockets = []
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    sockets.forEach((s) => s.disconnect())
    service.close()
    await new Promise((resolve) => io.close(resolve))
  })
  async function connect() {
    const s = client(`http://127.0.0.1:${http.address().port}/property-game`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    sockets.push(s)
    s.on('state', (state) => {
      s.latest = state
    })
    await new Promise((resolve, reject) => {
      s.once('connect', resolve)
      s.once('connect_error', reject)
    })
    return s
  }
  async function request(s, action, input = {}) {
    const result = await s
      .timeout(3000)
      .emitWithAck('command', { action, revision: s.latest?.revision, ...input })
    assert.equal(result.ok, true, result.error)
    return result
  }
  async function until(s, predicate) {
    if (predicate(s.latest)) return
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        s.off('state', handler)
        reject(Error('State timeout'))
      }, 3000)
      function handler(state) {
        if (predicate(state)) {
          clearTimeout(timer)
          s.off('state', handler)
          resolve()
        }
      }
      s.on('state', handler)
    })
  }
  const host = await connect(),
    hs = (await request(host, 'create', { name: 'Chủ phòng', character: defaultCharacter })).session
  const duplicate = await connect()
  const rejected = await duplicate.emitWithAck('command', {
    action: 'join',
    code: hs.code,
    name: 'Trùng nhân vật',
    character: defaultCharacter,
  })
  assert.equal(rejected.ok, false)
  assert.equal(rejected.code, 'CHARACTER_TAKEN')
  assert.equal(service.rooms.get(hs.code).players.length, 1)
  duplicate.disconnect()
  const peer = await connect(),
    ps = (await request(peer, 'join', { code: hs.code, name: 'Bạn bè', token: 'cat' })).session
  await until(host, (s) => s?.players.length === 2)
  const peerCharacter = { ...defaultCharacter, shirt: 2, hairStyle: 4 }
  await request(peer, 'character', { character: peerCharacter })
  await until(host, (s) => s.players.find((p) => p.id === ps.id).character.shirt === 2)
  assert.equal(JSON.stringify(peer.latest).includes(hs.secret), false)
  const stranger = await connect(),
    bad = await stranger.emitWithAck('command', { action: 'resume', ...ps, secret: 'wrong' })
  assert.equal(bad.ok, false)
  assert.equal(stranger.latest, undefined)
  await request(host, 'ready')
  await until(peer, (s) => s.players.some((p) => p.ready))
  await request(peer, 'ready')
  await until(host, (s) => s.players.every((p) => p.ready))
  await request(host, 'start')
  await until(peer, (s) => s.phase === 'roll')
  const turn = host.latest.players[host.latest.turn].id === hs.id ? host : peer
  const revision = turn.latest.revision
  const replies = await Promise.all(
    [1, 2].map(() => turn.emitWithAck('command', { action: 'roll', revision })),
  )
  assert.equal(replies.filter((r) => r.ok).length, 1)
  const snapshot = service.rooms.get(hs.code)
  assert.ok(snapshot.presentation?.readyAt > Date.now())
  const blocked = await turn.emitWithAck('command', {
    action: 'end',
    revision: turn.latest.revision,
  })
  assert.equal(blocked.ok, false)
  assert.match(blocked.error, /di chuyển/)
  peer.disconnect()
  await until(host, (s) => s.paused)
  const room = service.rooms.get(hs.code),
    original = room.players.find((p) => p.id === ps.id).cash
  const rejoined = await connect()
  await request(rejoined, 'resume', ps)
  await until(host, (s) => !s.paused)
  assert.equal(rejoined.latest.myId, ps.id)
  assert.deepEqual(rejoined.latest.players.find((p) => p.id === ps.id).character, peerCharacter)
  assert.equal(rejoined.latest.players.find((p) => p.id === ps.id).cash, original)
  await request(host, 'close')
  assert.equal(service.rooms.size, 0)

  const solo = await connect()
  await request(solo, 'create', { name: 'Một người thử máy', token: 'car' })
  await request(solo, 'add-bot')
  assert.equal(solo.latest.players.filter((p) => p.isBot && p.ready).length, 1)
  const soloRoom = service.rooms.get(solo.latest.code)
  await request(solo, 'ready')
  await request(solo, 'start')
  soloRoom.presentation = null
  soloRoom.turn = soloRoom.players.findIndex((p) => p.isBot)
  soloRoom.phase = 'roll'
  soloRoom.revision++
  await until(solo, (s) => s.presentation?.actorId === soloRoom.players[soloRoom.turn].id)
  assert.ok(solo.latest.presentation.dice.length === 2)
  await request(solo, 'close')
  assert.equal(service.rooms.size, 0)
})
