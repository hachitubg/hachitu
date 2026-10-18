import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRoom,
  addPlayer,
  players,
  command,
  tick,
  view,
  suggestDeck,
  validateDeck,
  catalog,
  paused,
} from './engine.mjs'

const base = [
  'werewolf',
  'seer',
  'bodyguard',
  'witch',
  'villager',
  'prince',
  'villager',
  'werewolf',
]
function lobby(cards = base) {
  const room = createRoom('Quản trò', 'preset:0')
  cards.forEach((_, i) => addPlayer(room, `Người ${i + 1}`, `preset:${i}`))
  players(room).forEach((p) => command(room, p, 'ready'))
  command(room, room.members[0], 'deck', { revision: room.revision, deck: cards })
  return room
}
function act(room, actor, action, input = {}) {
  return command(room, actor, action, { revision: room.revision, ...input })
}
function host(room, action, input) {
  return act(room, room.members[0], action, input)
}
function started(cards = base) {
  const room = lobby(cards)
  host(room, 'start')
  // Assign the already validated deck deterministically to exercise specific role interactions.
  players(room).forEach((p, i) => (p.role = cards[i]))
  tick(room, room.deadline)
  players(room).forEach((p) => act(room, p, 'seen'))
  return room
}
function finishNight(room, choose) {
  while (room.turn) {
    const actors = room.turn.actors.map((id) => room.members.find((p) => p.id === id))
    const inputs = actors.map((p) => choose(room.turn.key, p))
    actors.forEach((p, i) => act(room, p, 'draft', inputs[i]))
    actors.forEach((p, i) => act(room, p, 'confirm', inputs[i]))
    host(room, 'next')
  }
}

test('reset night restores deaths, resources, private notes, history and scores while keeping live connections', () => {
  const room = started([
    'werewolf',
    'witch',
    'hunter',
    'villager',
    'bodyguard',
    'villager',
    'villager',
  ])
  const p = players(room)
  p[5].used.blessed = true
  const originalRoles = p.map((person) => person.role)
  host(room, 'next')
  const firstRevision = room.revision
  finishNight(room, (key) => ({
    targets: key === 'wolves' ? [p[2].id] : key === 'witch' ? [p[3].id] : [p[5].id],
  }))
  host(room, 'next')
  tick(room, room.deadline)
  assert.equal(room.phase, 'death-action')
  act(room, p[2], 'confirm', { targets: [p[0].id] })
  host(room, 'next')
  assert.equal(room.phase, 'ended')
  assert.equal(room.history.length, 1)
  assert.equal(p[1].used.poison, true)
  assert.equal(p[1].wins, 1)
  p[3].connected = false
  const endRevision = room.revision
  assert.throws(() => act(room, p[1], 'reset-night'), /Chỉ quản trò/)
  host(room, 'reset-night')
  assert.equal(room.round, 1)
  assert.equal(room.phase, 'night')
  assert.equal(room.winner, null)
  assert.equal(room.history.length, 0)
  assert.equal(room.deadline, null)
  assert.ok(room.revision > endRevision)
  assert.deepEqual(
    p.map((person) => person.role),
    originalRoles,
  )
  assert.ok(p.every((person) => person.alive && person.wins === 0 && person.losses === 0))
  assert.equal(p[1].used.poison, undefined)
  assert.equal(p[2].used.hunter, undefined)
  assert.equal(p[4].lastGuard, null)
  assert.equal(p[5].used.blessed, true)
  assert.equal(p[3].connected, false)
  assert.equal(paused(room), true)
  assert.deepEqual(room.pendingHunters, [])
  assert.deepEqual(room.deaths, [])
  assert.ok(p.every((person) => person.notes.length === 0))
  assert.equal(
    room.logs.some((event) => event.message.includes('chiến thắng')),
    false,
  )
  assert.equal(Object.hasOwn(view(room, p[0]), 'nightCheckpoint'), false)
  p[3].connected = true
  assert.throws(
    () => command(room, p[0], 'confirm', { revision: firstRevision, targets: [p[2].id] }),
    /Màn hình đã đổi/,
  )
  // The original member objects remain valid for sockets holding their identity.
  act(room, p[4], 'confirm', { targets: [p[5].id] })
  assert.equal(room.decisions[p[4].id].confirmed, true)
  const replayRevision = room.revision
  host(room, 'reset-night')
  assert.ok(room.revision > replayRevision)
  assert.equal(room.round, 1)
  assert.deepEqual(room.decisions, {})
  assert.equal(room.history.length, 0)
  assert.equal(p[5].used.blessed, true)
  host(room, 'abort')
  room.members = room.members.filter((person) => person.id !== p[6].id)
  assert.equal(view(room, room.members[0]).canResetNight, false)
  assert.throws(() => host(room, 'reset-night'), /Danh sách người chơi đã thay đổi/)
})

test('reset only replays the latest night and is cleared when preparing a new game', () => {
  const room = started([
    'werewolf',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  assert.throws(() => host(room, 'reset-night'), /Không có đêm/)
  host(room, 'next')
  act(room, p[0], 'draft', { targets: [p[1].id] })
  act(room, p[0], 'confirm', { targets: [p[1].id] })
  host(room, 'next')
  host(room, 'next')
  tick(room, room.deadline)
  host(room, 'next')
  p.filter((person) => person.alive).forEach((person) => act(room, person, 'vote', { vote: null }))
  host(room, 'next')
  host(room, 'next')
  assert.equal(room.round, 2)
  act(room, p[0], 'draft', { targets: [p[2].id] })
  act(room, p[0], 'confirm', { targets: [p[2].id] })
  host(room, 'next')
  host(room, 'next')
  assert.equal(room.phase, 'dawn')
  host(room, 'reset-night')
  assert.equal(room.round, 2)
  assert.equal(p[1].alive, false)
  assert.equal(p[2].alive, true)
  assert.equal(room.deadline, null)
  host(room, 'abort')
  host(room, 'rematch')
  assert.equal(view(room, room.members[0]).canResetNight, false)
  assert.throws(() => host(room, 'reset-night'), /Không có đêm/)
})

test('cards-only rooms allow unimplemented roles, deal privately and never run automatic rules or scores', () => {
  const room = createRoom('Host', 'preset:0', Date.now(), true)
  const cards = ['frankenstein', 'drunk', 'villager', 'villager', 'villager']
  cards.forEach((_, i) => addPlayer(room, `P${i}`, `preset:${i}`))
  const p = players(room)
  p.forEach((person) => act(room, person, 'ready'))
  host(room, 'deck', { deck: cards })
  assert.throws(() => validateDeck(cards, 5), /chưa được hỗ trợ/)
  assert.throws(
    () => validateDeck(['moderator', ...cards.slice(1)], 5, 'villager', true),
    /chưa được hỗ trợ/,
  )
  host(room, 'start')
  assert.equal(view(room, p[0]).myRole, null)
  tick(room, room.deadline)
  const drunk = p.find((person) => person.role === 'drunk')
  assert.equal(drunk.hiddenRole, null)
  p.forEach((person) => act(room, person, 'seen'))
  assert.equal(room.phase, 'manual')
  assert.equal(room.turn, null)
  assert.equal(view(room, p[0]).cardsOnly, true)
  assert.equal(view(room, p[0]).action, null)
  assert.ok(view(room, p[0]).members.every((person) => person.role === null))
  assert.ok(
    view(room, room.members[0])
      .members.filter((person) => !person.host)
      .every((person) => person.role),
  )
  assert.throws(() => host(room, 'next'), /chỉ chia bài/)
  assert.throws(() => act(room, p[0], 'finish-manual'), /Chỉ quản trò/)
  assert.throws(() => act(room, p[0], 'vote', { vote: null }), /quyền bỏ phiếu/)
  assert.throws(() => host(room, 'reset-night'), /Không có đêm/)
  p[0].connected = false
  assert.equal(paused(room), false)
  host(room, 'finish-manual')
  assert.equal(room.phase, 'ended')
  assert.equal(room.winner, 'manual')
  assert.equal(room.history.length, 1)
  assert.equal(view(room, drunk).myRole, 'drunk')
  assert.equal(view(room, drunk).myWon, null)
  assert.ok(p.every((person) => person.wins === 0 && person.losses === 0))
  assert.throws(() => host(room, 'finish-manual'), /Không có ván/)
  host(room, 'rematch')
  assert.equal(room.cardsOnly, true)
  assert.equal(room.phase, 'lobby')
  assert.ok(p.every((person) => person.role === null && !person.ready))
})

test('suggestions obey physical quantities and playable team constraints for 5–24 players', () => {
  for (let n = 5; n <= 24; n++) {
    const cards = suggestDeck(n)
    assert.equal(cards.length, n)
    assert.equal(typeof validateDeck(cards, n), 'number')
    assert.ok(cards.every((key) => catalog.find((r) => r.id === key).enabled))
  }
})

test('DiceBear avatars are validated and the same avatar cannot be reused in one room', () => {
  const avatar = 'dicebear:adventurer:0123456789abcdef0123456789abcdef'
  const room = createRoom('Host', avatar)
  assert.throws(() => addPlayer(room, 'Trùng avatar', avatar), /Avatar này/)
  const person = addPlayer(room, 'Khác avatar', 'dicebear:bottts:11111111111111111111111111111111')
  assert.equal(person.avatar.startsWith('dicebear:'), true)
  assert.throws(() => addPlayer(room, 'URL lạ', 'https://evil.example/avatar.svg'))
  assert.throws(() =>
    addPlayer(room, 'Sai phong cách', 'dicebear:custom:11111111111111111111111111111111'),
  )
})
test('host does not receive a card; five-second reveal and host knowledge gated on all seen', () => {
  const room = lobby(),
    hostPlayer = room.members[0],
    p = players(room)[0]
  host(room, 'start')
  assert.equal(view(room, p).myRole, null)
  assert.equal(
    view(room, hostPlayer).members.some((p) => p.role),
    false,
  )
  assert.equal(tick(room, room.deadline - 1), false)
  tick(room, room.deadline)
  assert.ok(view(room, p).myRole)
  assert.equal(view(room, hostPlayer).myRole, null)
  assert.equal(hostPlayer.role, null)
  assert.throws(() => host(room, 'next'))
  players(room).forEach((p) => act(room, p, 'seen'))
  assert.equal(room.phase, 'dealt')
  assert.equal(view(room, hostPlayer).members.filter((p) => p.role).length, 8)
})
test('blocks unsupported roles, incomplete deck, premature start and non-host control', () => {
  assert.throws(() => validateDeck(['frankenstein', ...base.slice(1)], 8))
  const room = lobby(),
    player = players(room)[0]
  assert.throws(() => act(room, player, 'start'))
  assert.throws(() => host(room, 'deck', { deck: ['werewolf'] }))
  player.ready = false
  assert.throws(() => host(room, 'start'))
})
test('players can preview the lobby deck but cannot change it or see the Drunk reserve', () => {
  const cards = ['werewolf', 'drunk', 'villager', 'villager', 'villager']
  const room = lobby(cards)
  room.drunkRole = 'seer'
  const player = players(room)[0]
  assert.deepEqual(view(room, player).deck, cards)
  assert.equal(view(room, player).drunkRole, null)
  assert.ok(view(room, player).members.every((p) => p.role === null))
  assert.throws(
    () => act(room, player, 'deck', { deck: cards, drunkRole: 'werewolf' }),
    /Chỉ quản trò/,
  )
  assert.throws(() => act(room, player, 'suggest'), /Chỉ quản trò/)
  assert.deepEqual(room.deck, cards)
  host(room, 'start')
  assert.deepEqual(view(room, player).deck, [])
  assert.equal(view(room, player).drunkRole, null)
})

test('no public token/role/action leaks; seer learns only after one confirmed target', () => {
  const room = started()
  host(room, 'next')
  const list = players(room),
    seer = list[1],
    civilian = list[4],
    wolf = list[0]
  finishNight(room, (key) => {
    if (key === 'seer') {
      assert.throws(() => act(room, seer, 'draft', { targets: [wolf.id, civilian.id] }))
      act(room, seer, 'draft', { targets: [wolf.id] })
      assert.deepEqual(view(room, seer).notes, [])
      assert.deepEqual(view(room, civilian).choices, [])
      return { targets: [wolf.id] }
    }
    if (key === 'bodyguard') return { targets: [civilian.id] }
    if (key === 'wolves') return { targets: [civilian.id] }
    return { targets: [] }
  })
  assert.match(view(room, seer).notes[0], /Sói/)
  assert.deepEqual(view(room, civilian).logs, [])
  assert.deepEqual(view(room, civilian).history, [])
  const publicText = JSON.stringify(view(room, civilian))
  room.members.forEach((p) => assert.equal(publicText.includes(p.token), false))
  assert.equal(
    view(room, civilian).members.some((p) => p.role),
    false,
  )
})
test('wolves require consensus; confirmation locks target; stale commands cannot move a new phase', () => {
  const room = started()
  host(room, 'next')
  const list = players(room),
    guard = list[2]
  act(room, guard, 'confirm', { targets: [guard.id] })
  host(room, 'next')
  assert.equal(room.turn.key, 'wolves')
  act(room, list[0], 'draft', { targets: [list[1].id] })
  act(room, list[7], 'draft', { targets: [list[4].id] })
  assert.throws(() => act(room, list[0], 'confirm', { targets: [list[1].id] }))
  act(room, list[7], 'draft', { targets: [list[1].id] })
  act(room, list[0], 'confirm', { targets: [list[1].id] })
  assert.throws(() => act(room, list[7], 'draft', { targets: [list[4].id] }))
  act(room, list[7], 'confirm', { targets: [list[1].id] })
  const bites = room.logs.filter((entry) => entry.message.includes('thống nhất cắn'))
  assert.equal(bites.length, 1)
  assert.equal(
    bites[0].message,
    `Bầy Sói (${list[0].name}, ${list[7].name}) thống nhất cắn ${list[1].name}.`,
  )
  const revision = room.revision
  host(room, 'next')
  assert.throws(() => command(room, room.members[0], 'next', { revision }))
})
test('dawn lasts ten seconds and then publishes deaths to everyone; dead players cannot act', () => {
  const room = started()
  host(room, 'next')
  const list = players(room),
    victim = list[4]
  finishNight(room, (key) => ({
    targets:
      key === 'wolves'
        ? [victim.id]
        : key === 'bodyguard'
          ? [list[1].id]
          : key === 'seer'
            ? [list[0].id]
            : [],
  }))
  assert.equal(room.phase, 'night')
  assert.equal(victim.alive, true)
  host(room, 'next')
  const deadline = room.deadline
  assert.equal(room.phase, 'dawn')
  assert.equal(view(room, victim).deaths.length, 0)
  assert.equal(tick(room, deadline - 1), false)
  tick(room, deadline)
  assert.equal(room.phase, 'day')
  assert.equal(victim.alive, false)
  room.members.forEach((p) => assert.ok(view(room, p).summary.includes(victim.name)))
  assert.deepEqual(view(room, victim).logs, [])
  host(room, 'next')
  assert.throws(() => act(room, victim, 'vote', { vote: list[0].id }))
})
test('guard cannot repeat a target; witch resources last across nights', () => {
  const room = started()
  host(room, 'next')
  const list = players(room)
  finishNight(room, (key) => ({
    targets:
      key === 'bodyguard'
        ? [list[1].id]
        : key === 'wolves'
          ? [list[4].id]
          : key === 'seer'
            ? [list[0].id]
            : [],
    save: key === 'witch',
  }))
  host(room, 'next')
  tick(room, room.deadline)
  assert.equal(list[4].alive, true)
  assert.equal(list[3].used.heal, true)
  host(room, 'next')
  players(room).forEach((p) => act(room, p, 'vote', { vote: null }))
  host(room, 'next')
  host(room, 'next')
  assert.equal(room.turn.key, 'bodyguard')
  assert.throws(() => act(room, list[2], 'confirm', { targets: [list[1].id] }))
})
test('nomination tie retries once; second tie does not execute', () => {
  const room = started(['werewolf', 'villager', 'villager', 'villager', 'villager', 'villager'])
  room.phase = 'day'
  host(room, 'next')
  const ps = players(room)
  ps.forEach((p, i) => act(room, p, 'vote', { vote: ps[i % 2].id }))
  host(room, 'next')
  assert.equal(room.phase, 'nominate')
  assert.equal(room.ballot, 1)
  assert.deepEqual(room.eligible.sort(), [ps[0].id, ps[1].id].sort())
  assert.throws(() => act(room, ps[0], 'vote', { vote: ps[2].id }))
  ps.forEach((p, i) => act(room, p, 'vote', { vote: ps[i % 2].id }))
  host(room, 'next')
  assert.equal(room.phase, 'day-end')
  assert.ok(ps.every((p) => p.alive))
})
test('nomination, defense, yes/no trial use mayor weight and prince immunity', () => {
  const room = started(['werewolf', 'mayor', 'prince', 'villager', 'villager'])
  const ps = players(room)
  room.phase = 'day'
  host(room, 'next')
  ps.forEach((p) => act(room, p, 'vote', { vote: ps[2].id }))
  host(room, 'next')
  assert.equal(room.phase, 'defense')
  assert.equal(room.nominee, ps[2].id)
  assert.throws(() => act(room, ps[0], 'vote', { vote: true }))
  host(room, 'next')
  assert.throws(() => act(room, ps[0], 'vote', { vote: ps[2].id }))
  ps.forEach((p, i) => act(room, p, 'vote', { vote: i < 3 }))
  host(room, 'next')
  assert.equal(ps[2].alive, true)
  assert.equal(ps[2].used.pardon, true)
  assert.equal(view(room, ps[0]).members.find((p) => p.id === ps[2].id).role, 'prince')
})
test('special ballots are enforced by server and duplicate votes rejected', () => {
  const room = started(['werewolf', 'pacifist', 'village_idiot', 'villager', 'villager'])
  const ps = players(room)
  room.phase = 'verdict'
  room.nominee = ps[0].id
  assert.throws(() => act(room, ps[1], 'vote', { vote: true }))
  assert.throws(() => act(room, ps[2], 'vote', { vote: false }))
  act(room, ps[1], 'vote', { vote: false })
  assert.throws(() => act(room, ps[1], 'vote', { vote: false }))
})
test('winner/history/stats published once, rematch keeps session stats but clears roles', () => {
  const room = started(['werewolf', 'seer', 'villager', 'villager', 'villager'])
  const ps = players(room)
  room.phase = 'verdict'
  room.nominee = ps[0].id
  ps.forEach((p) => act(room, p, 'vote', { vote: true }))
  host(room, 'next')
  assert.equal(room.phase, 'ended')
  assert.equal(room.winner, 'village')
  assert.equal(room.history.length, 1)
  assert.equal(ps[0].losses, 1)
  assert.equal(ps[1].wins, 1)
  assert.equal(view(room, ps[0]).history.length, 1)
  assert.throws(() => host(room, 'next'))
  host(room, 'rematch')
  assert.equal(room.phase, 'lobby')
  assert.equal(ps[1].wins, 1)
  assert.ok(ps.every((p) => p.role === null && !p.ready))
  assert.equal(room.history.length, 1)
})
test('disconnect pauses actions and countdown; expired room cannot accept actions', () => {
  const room = lobby()
  host(room, 'start')
  players(room)[0].connected = false
  assert.equal(paused(room), true)
  assert.equal(tick(room, room.deadline + 100), false)
  assert.throws(() => host(room, 'next'))
  players(room)[0].connected = true
  tick(room, room.deadline)
  assert.equal(room.phase, 'reveal')
  assert.throws(() =>
    command(room, players(room)[0], 'seen', { revision: room.revision }, room.expires + 1),
  )
})

test('joining a lobby preserves existing ready flags while invalidating the old deck', () => {
  const room = lobby()
  addPlayer(room, 'Người đến sau', 'preset:2')
  assert.equal(players(room).filter((p) => p.ready).length, 8)
  assert.equal(players(room).at(-1).ready, false)
  assert.deepEqual(room.deck, [])
})

test('host can cancel a disconnected game without changing any win/loss counters', () => {
  const room = started(),
    ps = players(room)
  ps[0].connected = false
  assert.throws(() => act(room, ps[1], 'abort'))
  host(room, 'abort')
  assert.equal(room.phase, 'ended')
  assert.equal(room.winner, 'aborted')
  assert.equal(room.history.length, 1)
  assert.equal(room.history[0].winner, 'aborted')
  assert.ok(ps.every((p) => p.wins === 0 && p.losses === 0))
  assert.throws(() => host(room, 'abort'))
  host(room, 'rematch')
  assert.equal(room.phase, 'lobby')
  assert.ok(ps.every((p) => p.role === null))
})

test('dawn does not resurrect old victims in public view and a paused countdown stays fixed', () => {
  const room = started(),
    ps = players(room)
  room.phase = 'dawn'
  room.deadline = Date.now() + 10000
  ps[0].alive = false
  assert.equal(view(room, ps[1]).members.find((p) => p.id === ps[0].id).alive, false)
  ps[1].connected = false
  room.pauseStarted = Date.now()
  const first = view(room, room.members[0], room.pauseStarted)
  const later = view(room, room.members[0], room.pauseStarted + 5000)
  assert.equal(first.remainingMs, later.remainingMs)
  assert.equal(later.paused, true)
})

test('only the host can see identities of pending actors and voters', () => {
  const room = started(),
    ps = players(room)
  host(room, 'next')
  assert.deepEqual(view(room, room.members[0]).waitingFor, [ps[2].id])
  assert.deepEqual(view(room, ps[4]).waitingFor, [])
  act(room, ps[2], 'confirm', { targets: [ps[2].id] })
  assert.deepEqual(view(room, room.members[0]).waitingFor, [])
  room.phase = 'nominate'
  room.eligible = ps.map((p) => p.id)
  act(room, ps[0], 'vote', { vote: null })
  assert.equal(view(room, room.members[0]).waitingFor.length, 7)
  assert.deepEqual(view(room, ps[1]).waitingFor, [])
})

test('seer variants respect disguises and reveal exact roles only for Mystic Seer', () => {
  const cases = [
    ['seer', 'lycan', 'Sói'],
    ['seer', 'wolf_man', 'Không phải Sói'],
    ['aura_seer', 'werewolf', 'Vai thường'],
    ['aura_seer', 'lycan', 'Vai đặc biệt'],
    ['mystic_seer', 'wolf_man', 'Người sói (Sói giả dân)'],
    ['sorceress', 'seer', 'Là Tiên tri'],
  ]
  for (const [ability, targetRole, expected] of cases) {
    const room = started(),
      ps = players(room)
    ps[1].role = ability
    ps[4].role = targetRole
    room.phase = 'night'
    room.turn = { key: ability, actors: [ps[1].id] }
    room.decisions = {}
    act(room, ps[1], 'draft', { targets: [ps[4].id] })
    assert.equal(ps[1].notes.length, 0)
    act(room, ps[1], 'confirm', { targets: [ps[4].id] })
    assert.ok(ps[1].notes[0].endsWith(`${expected}.`))
    assert.ok(
      room.logs.some((entry) =>
        entry.message.includes(`(${ps[1].name}) soi ${ps[4].name}: ${expected}.`),
      ),
    )
    assert.deepEqual(view(room, ps[0]).notes, [])
  }
})

test('Mentalist requires two different targets and reports allegiance, not character names', () => {
  const room = started(),
    ps = players(room)
  ps[1].role = 'mentalist'
  room.phase = 'night'
  room.turn = { key: 'mentalist', actors: [ps[1].id] }
  assert.throws(() => act(room, ps[1], 'confirm', { targets: [ps[0].id] }))
  assert.throws(() => act(room, ps[1], 'confirm', { targets: [ps[0].id, ps[0].id] }))
  act(room, ps[1], 'confirm', { targets: [ps[0].id, ps[7].id] })
  assert.match(ps[1].notes[0], /cùng phe/)
  assert.equal(ps[1].notes[0].includes('Ma sói'), false)
})

test('witch can use both potions once, and later cannot reuse them', () => {
  const room = started(),
    ps = players(room)
  room.phase = 'night'
  room.turn = { key: 'witch', actors: [ps[3].id] }
  room.wolfTarget = ps[4].id
  act(room, ps[3], 'confirm', { targets: [ps[0].id], save: true })
  host(room, 'next')
  assert.equal(ps[3].used.heal, true)
  assert.equal(ps[3].used.poison, true)
  assert.equal(room.healed, ps[4].id)
  assert.equal(room.poisoned, ps[0].id)
  room.turn = { key: 'witch', actors: [ps[3].id] }
  room.decisions = {}
  assert.throws(() => act(room, ps[3], 'confirm', { targets: [ps[7].id] }))
  assert.throws(() => act(room, ps[3], 'confirm', { targets: [], save: true }))
})

test('blessing absorbs a night kill and spellcaster cannot reuse a silenced target', () => {
  const room = started(),
    ps = players(room)
  ps[1].role = 'priest'
  room.phase = 'night'
  room.turn = { key: 'priest', actors: [ps[1].id] }
  act(room, ps[1], 'confirm', { targets: [ps[4].id] })
  host(room, 'next')
  assert.equal(ps[1].used.priest, true)
  assert.equal(ps[4].used.blessed, true)
  room.wolfTarget = ps[4].id
  room.turn = null
  host(room, 'next')
  tick(room, room.deadline)
  assert.equal(ps[4].alive, true)
  assert.equal(ps[4].used.blessed, false)
  room.phase = 'night'
  ps[1].role = 'spellcaster'
  room.turn = { key: 'spellcaster', actors: [ps[1].id] }
  room.decisions = {}
  act(room, ps[1], 'confirm', { targets: [ps[4].id] })
  host(room, 'next')
  assert.equal(ps[4].silenced, true)
  room.turn = { key: 'spellcaster', actors: [ps[1].id] }
  room.decisions = {}
  assert.throws(() => act(room, ps[1], 'confirm', { targets: [ps[4].id] }))
})
