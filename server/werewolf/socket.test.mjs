import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { io as client } from 'socket.io-client'
import { registerWerewolf } from './socket.mjs'

test('real sockets: private dealing, resume, a full night and two-stage voting through rematch', async (t) => {
  const http = createServer()
  const io = new Server(http)
  const service = registerWerewolf(io)
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve))
  const address = `http://127.0.0.1:${http.address().port}/werewolf`
  const sockets = []
  t.after(async () => {
    sockets.forEach((s) => s.disconnect())
    service.close()
    await new Promise((resolve) => io.close(resolve))
  })
  async function connect() {
    const socket = client(address, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    sockets.push(socket)
    socket.on('state', (value) => {
      socket.latest = value
    })
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
    })
    return socket
  }
  async function request(socket, action, input = {}) {
    const result = await socket
      .timeout(3000)
      .emitWithAck('command', { action, revision: socket.latest?.revision, ...input })
    assert.equal(result.ok, true, result.error)
    return result
  }
  async function until(socket, predicate) {
    if (predicate(socket.latest)) return
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('state', handler)
        reject(new Error('State timeout'))
      }, 4000)
      function handler(state) {
        if (predicate(state)) {
          clearTimeout(timeout)
          socket.off('state', handler)
          resolve()
        }
      }
      socket.on('state', handler)
    })
  }
  const host = await connect()
  const hostSession = (await request(host, 'create', { name: 'Host', avatar: 'preset:0' })).session
  const peers = [],
    sessions = []
  for (let n = 0; n < 5; n++) {
    const peer = await connect()
    const session = (
      await request(peer, 'join', {
        code: hostSession.code,
        name: `Player ${n}`,
        avatar: `preset:${n}`,
      })
    ).session
    peers.push(peer)
    sessions.push(session)
  }
  const stranger = await connect()
  const invalid = await stranger
    .timeout(3000)
    .emitWithAck('command', { action: 'resume', ...sessions[0], token: 'invalid' })
  assert.equal(invalid.ok, false)
  for (const peer of peers) await request(peer, 'ready')
  await until(host, (state) => state.members.filter((p) => p.ready).length === 5)
  await request(host, 'deck', {
    deck: ['werewolf', 'villager', 'villager', 'villager', 'villager'],
  })
  await request(host, 'start')
  const room = service.rooms.get(hostSession.code)
  assert.equal(
    host.latest.members.some((p) => p.role),
    false,
  )
  room.deadline = Date.now() - 1
  for (const peer of peers) {
    await until(peer, (state) => state?.phase === 'reveal')
    assert.ok(peer.latest.myRole)
    assert.ok(peer.latest.members.every((p) => p.role === null))
    await request(peer, 'seen')
  }
  await until(host, (state) => state.phase === 'dealt')
  const wolf = peers.find((p) => p.latest.myRole === 'werewolf')
  const victim = peers.find((p) => p !== wolf)
  const victimIndex = peers.indexOf(victim),
    originalRole = victim.latest.myRole
  victim.disconnect()
  await until(host, (state) => state.paused)
  const blocked = await host
    .timeout(3000)
    .emitWithAck('command', { action: 'next', revision: host.latest.revision })
  assert.equal(blocked.ok, false)
  const resumed = await connect()
  await request(resumed, 'resume', sessions[victimIndex])
  peers[victimIndex] = resumed
  assert.equal(resumed.latest.myRole, originalRole)
  await until(host, (state) => !state.paused)
  await request(host, 'next')
  await until(wolf, (state) => state.phase === 'night')
  await request(wolf, 'draft', { targets: [sessions[victimIndex].id] })
  await request(wolf, 'confirm', { targets: [sessions[victimIndex].id] })
  await until(host, (state) => state.current.confirmed === 1)
  assert.equal(host.latest.choices[0].targets[0], sessions[victimIndex].id)
  assert.deepEqual(resumed.latest.choices, [])
  await request(host, 'next')
  await request(host, 'next')
  room.deadline = Date.now() - 1
  await until(host, (state) => state.phase === 'day')
  await until(resumed, (state) => state.phase === 'day')
  assert.equal(resumed.latest.alive, false)
  assert.equal(resumed.latest.summary, host.latest.summary)
  assert.deepEqual(resumed.latest.history, [])
  await request(host, 'next')
  for (const peer of peers.filter((p) => p !== resumed)) {
    await until(peer, (state) => state.phase === 'nominate')
    await request(peer, 'vote', { vote: wolf.latest.myId })
  }
  await until(host, (state) => state.voteCount === 4)
  await request(host, 'next')
  assert.equal(host.latest.phase, 'defense')
  await request(host, 'next')
  for (const peer of peers.filter((p) => p !== resumed)) {
    await until(peer, (state) => state.phase === 'verdict')
    await request(peer, 'vote', { vote: true })
  }
  await until(host, (state) => state.voteCount === 4)
  await request(host, 'next')
  await until(resumed, (state) => state.phase === 'ended')
  assert.equal(resumed.latest.winner, 'village')
  assert.equal(resumed.latest.history.length, 1)
  assert.equal(resumed.latest.members.find((p) => p.id === resumed.latest.myId).wins, 1)
  for (const peer of peers)
    assert.equal(JSON.stringify(peer.latest).includes(hostSession.token), false)
  await request(host, 'reset-night')
  await until(resumed, (state) => state.phase === 'night')
  assert.equal(resumed.latest.alive, true)
  assert.equal(resumed.latest.history.length, 0)
  assert.equal(resumed.latest.members.find((p) => p.id === resumed.latest.myId).wins, 0)
  await until(wolf, (state) => state.phase === 'night')
  await request(wolf, 'draft', { targets: [resumed.latest.myId] })
  await request(wolf, 'confirm', { targets: [resumed.latest.myId] })
  await until(host, (state) => state.current.confirmed === 1)
  await request(host, 'abort')
  await request(host, 'rematch')
  assert.equal(host.latest.phase, 'lobby')
  assert.equal(host.latest.history.length, 1)
})

test('real sockets preserve cards-only configuration and hide roles until the host ends the game', async (t) => {
  const http = createServer()
  const io = new Server(http)
  const service = registerWerewolf(io)
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve))
  const sockets = []
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect())
    service.close()
    await new Promise((resolve) => io.close(resolve))
  })
  async function connect() {
    const socket = client(`http://127.0.0.1:${http.address().port}/werewolf`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    sockets.push(socket)
    socket.on('state', (state) => {
      socket.latest = state
    })
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
    })
    return socket
  }
  async function request(socket, action, data = {}) {
    const reply = await socket
      .timeout(3000)
      .emitWithAck('command', { action, revision: socket.latest?.revision, ...data })
    assert.equal(reply.ok, true, reply.error)
    return reply
  }
  const host = await connect()
  const session = (
    await request(host, 'create', { name: 'Host', avatar: 'preset:0', cardsOnly: true })
  ).session
  assert.equal(host.latest.cardsOnly, true)
  const peers = []
  for (let i = 0; i < 5; i++) {
    const peer = await connect()
    await request(peer, 'join', { code: session.code, name: `P${i}`, avatar: `preset:${i}` })
    await request(peer, 'ready')
    peers.push(peer)
  }
  await request(host, 'deck', {
    deck: ['frankenstein', 'drunk', 'villager', 'villager', 'villager'],
  })
  await request(host, 'start')
  const room = service.rooms.get(session.code)
  room.deadline = Date.now() - 1
  // Force the normal clock transition through a broadcast-triggering command.
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Reveal timeout')), 3000)
    peers[0].on('state', function ready(state) {
      if (state.phase === 'reveal') {
        clearTimeout(timeout)
        peers[0].off('state', ready)
        resolve()
      }
    })
  })
  for (const peer of peers) await request(peer, 'seen')
  assert.equal(host.latest.phase, 'manual')
  for (const peer of peers) {
    assert.ok(peer.latest.members.every((person) => person.role === null))
    assert.equal(peer.latest.action, null)
  }
  await request(host, 'finish-manual')
  assert.equal(host.latest.winner, 'manual')
  assert.ok(host.latest.members.filter((person) => !person.host).every((person) => person.role))
  await request(host, 'rematch')
  assert.equal(host.latest.cardsOnly, true)
  assert.equal(host.latest.phase, 'lobby')
})
