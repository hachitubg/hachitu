import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { Server } from 'socket.io'
import { io as client } from 'socket.io-client'
import { registerWerewolf } from './socket.mjs'

test('real sockets: simultaneous ballots, Martyr reconnect and dead Mary reconnect stay consistent', async (t) => {
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
  function raw(socket, action, input = {}) {
    return socket
      .timeout(4000)
      .emitWithAck('command', { action, revision: socket.latest?.revision, ...input })
  }
  async function request(socket, action, input) {
    const reply = await raw(socket, action, input)
    assert.equal(reply.ok, true, reply.error)
    return reply
  }
  async function until(socket, predicate) {
    if (socket.latest && predicate(socket.latest)) return
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('state', handler)
        reject(Error('Socket state timeout'))
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
  const session = (await request(host, 'create', { name: 'Host', avatar: 'preset:0' })).session
  const cards = [
    'werewolf',
    'martyr',
    'the_mummy',
    'mayor',
    'bloody_mary',
    'teenage_werewolf',
    'beholder',
    'seer',
    'villager',
  ]
  const peers = [],
    sessions = []
  for (let i = 0; i < cards.length; i++) {
    const peer = await connect()
    sessions.push(
      (await request(peer, 'join', { code: session.code, name: `P${i}`, avatar: `preset:${i}` }))
        .session,
    )
    peers.push(peer)
  }
  await Promise.all(peers.map((peer) => request(peer, 'ready')))
  await until(host, (state) => state.members.filter((p) => p.ready).length === cards.length)
  await request(host, 'deck', { deck: cards })
  await request(host, 'start')
  const room = service.rooms.get(session.code)
  const people = room.members.filter((p) => !p.host)
  people.forEach((p, i) => {
    p.role = p.originalRole = cards[i]
  })
  room.deadline = Date.now() - 1
  await Promise.all(peers.map((peer) => until(peer, (state) => state.phase === 'reveal')))
  await Promise.all(peers.map((peer) => request(peer, 'seen')))
  await until(host, (state) => state.phase === 'dealt')
  async function finishCurrentNight(stopAtMary = false) {
    while (room.turn) {
      if (stopAtMary && room.turn.key === 'bloody_mary') return
      const actors = room.turn.actors.map((id) => peers[people.findIndex((p) => p.id === id)])
      await Promise.all(
        actors.map((peer) => until(peer, (state) => state.action?.key === room.turn.key)),
      )
      const key = room.turn.key
      const targets =
        key === 'wolves'
          ? [people[room.round === 1 ? 4 : 8].id]
          : key === 'the_mummy'
            ? [people[3].id]
            : key === 'seer'
              ? [people[0].id]
              : []
      await Promise.all(actors.map((peer) => request(peer, 'draft', { targets })))
      await Promise.all(actors.map((peer) => request(peer, 'confirm', { targets })))
      await until(host, (state) => state.current.confirmed === state.current.total)
      await request(host, 'next')
    }
  }
  await request(host, 'next')
  await finishCurrentNight()
  await request(host, 'next')
  room.deadline = Date.now() - 1
  await until(host, (state) => state.phase === 'day')
  await until(peers[4], (state) => state.alive === false)
  assert.deepEqual(peers[4].latest.history, [])
  // Respect the production per-IP limiter while stress-testing concurrent clients.
  await delay(1050)
  await request(host, 'next')
  const voters = peers.filter((_, i) => people[i].alive)
  await Promise.all(voters.map((peer) => until(peer, (state) => state.phase === 'nominate')))
  const duplicate = await Promise.all([
    raw(voters[0], 'vote', { vote: people[3].id }),
    raw(voters[0], 'vote', { vote: people[3].id }),
  ])
  assert.deepEqual(duplicate.map((reply) => reply.ok).sort(), [false, true])
  await Promise.all(voters.slice(1).map((peer) => request(peer, 'vote', { vote: people[3].id })))
  await until(host, (state) => state.voteCount === voters.length)
  await request(host, 'next')
  await request(host, 'next')
  await Promise.all(voters.map((peer) => until(peer, (state) => state.phase === 'verdict')))
  await Promise.all(
    voters.map((peer) =>
      request(peer, 'vote', { vote: [peers[0], peers[2], peers[5]].includes(peer) }),
    ),
  )
  await until(host, (state) => state.voteCount === voters.length)
  await request(host, 'next')
  await until(peers[1], (state) => state.phase === 'martyr')
  assert.ok(host.latest.logs.some((event) => event.message.includes('5/9 phiếu Có')))
  assert.equal(people[3].alive, true)
  assert.equal(peers[1].latest.action.key, 'martyr')
  assert.equal((await raw(peers[2], 'next')).ok, false)
  peers[1].disconnect()
  await until(host, (state) => state.paused)
  assert.equal((await raw(host, 'next')).ok, false)
  peers[1] = await connect()
  await request(peers[1], 'resume', sessions[1])
  await until(host, (state) => !state.paused)
  await request(peers[1], 'confirm', { targets: [], activate: true })
  await until(host, (state) => state.current.confirmed === 1)
  await request(host, 'next')
  assert.equal(people[1].alive, false)
  assert.equal(people[3].alive, true)
  await request(host, 'next')
  assert.equal(host.latest.phase, 'teen-review')
  assert.deepEqual(peers[2].latest.teenChecks, [])
  await request(host, 'teen-check', { playerId: people[5].id, spoken: true })
  await request(host, 'next')
  peers[4].disconnect()
  await until(host, (state) => state.members.find((p) => p.id === people[4].id).connected === false)
  assert.equal(host.latest.paused, false)
  await delay(1050)
  await request(host, 'next')
  await finishCurrentNight(true)
  await until(host, (state) => state.paused)
  peers[4] = await connect()
  await request(peers[4], 'resume', sessions[4])
  await until(host, (state) => !state.paused)
  assert.equal(peers[4].latest.alive, false)
  assert.equal(peers[4].latest.action.key, 'bloody_mary')
  assert.equal(peers[2].latest.action, null)
  await request(peers[4], 'confirm', { targets: [people[0].id] })
  await until(host, (state) => state.current.confirmed === 1)
  await request(host, 'next')
  await request(host, 'next')
  room.deadline = Date.now() - 1
  await until(host, (state) => state.phase === 'day')
  assert.equal(people[0].alive, false)
  await request(host, 'abort')
  await request(host, 'rematch')
  assert.equal(host.latest.phase, 'lobby')
  assert.ok(people.every((p) => p.wins === 0 && p.losses === 0))
})
