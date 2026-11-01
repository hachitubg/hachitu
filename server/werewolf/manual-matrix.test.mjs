import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoom, addPlayer, players, command, view, tick, catalog } from './engine.mjs'

function controlledGame() {
  const room = createRoom('Host', 'preset:0', Date.now(), true),
    host = room.members[0]
  for (let i = 0; i < 5; i++) addPlayer(room, `P${i}`, `preset:${i}`)
  const people = players(room)
  const act = (actor, action, input = {}) =>
    command(room, actor, action, { revision: room.revision, ...input })
  people.forEach((p) => act(p, 'ready'))
  act(host, 'deck', { deck: ['hunter', 'werewolf', 'tanner', 'villager', 'seer'] })
  act(host, 'start')
  tick(room, room.deadline)
  return { room, host, people, act }
}
test('manual moderator controls rounds, death, hanging, correction and explicit winners without automatic role side effects', () => {
  const { room, host, people, act } = controlledGame()
  assert.ok(
    view(room, host)
      .members.filter((p) => !p.host)
      .every((p) => p.role),
  )
  assert.ok(view(room, people[0]).members.every((p) => p.role === null))
  act(host, 'manual-night')
  assert.equal(room.round, 1)
  const hunter = people.find((p) => p.role === 'hunter'),
    wolf = people.find((p) => p.role === 'werewolf')
  act(host, 'manual-dawn', { targets: [hunter.id] })
  assert.equal(hunter.alive, false)
  assert.deepEqual(room.pendingHunters, [])
  assert.equal(room.phase, 'manual')
  const dead = view(room, hunter)
  assert.equal(dead.myRole, null)
  assert.deepEqual(dead.logs, [])
  assert.deepEqual(dead.history, [])
  assert.equal(dead.canVote, false)
  act(host, 'manual-execute', { targets: [wolf.id] })
  assert.equal(room.phase, 'manual')
  assert.equal(wolf.alive, false)
  act(host, 'manual-revive', { targets: [wolf.id] })
  assert.equal(wolf.alive, true)
  act(host, 'manual-night')
  assert.equal(room.round, 2)
  act(host, 'manual-dawn', { targets: [] })
  assert.equal(room.manualStage, 'day')
  assert.match(room.lastSummary, /không ai/)
  assert.ok(room.logs.some((l) => l.phase === 'dawn' && l.round === 1))
  const winners = people
    .filter((p) => ['hunter', 'villager', 'seer'].includes(p.role))
    .map((p) => p.id)
  act(host, 'finish-manual', { winningTeam: 'village', winnerIds: winners })
  assert.equal(room.history.length, 1)
  assert.equal(room.winner, 'village')
  for (const p of people) {
    assert.equal(p.wins, winners.includes(p.id) ? 1 : 0)
    assert.equal(p.losses, winners.includes(p.id) ? 0 : 1)
    assert.ok(
      view(room, p)
        .members.filter((p) => !p.host)
        .every((p) => p.role),
    )
    assert.equal(view(room, p).history[0].logs.length, room.logs.length)
  }
  const snapshot = JSON.stringify(room)
  assert.throws(() => act(host, 'finish-manual', { winningTeam: 'werewolf', winnerIds: [wolf.id] }))
  assert.equal(JSON.stringify(room), snapshot)
  act(host, 'rematch')
  assert.equal(room.manualStage, 'ready')
  assert.ok(people.every((p) => p.alive && !p.role && !p.manualDeathReason))
  assert.equal(room.history.length, 1)
})
test('manual input rejects outsiders, stale actions, duplicates and wrong stages without partial mutation', () => {
  const { room, host, people, act } = controlledGame()
  for (const [actor, action, input] of [
    [people[0], 'manual-night', {}],
    [host, 'manual-dawn', { targets: [] }],
    [host, 'configure-mode', { cardsOnly: false }],
    [host, 'finish-manual', { winningTeam: 'village', winnerIds: [] }],
    [host, 'finish-manual', { winningTeam: 'village', winnerIds: [host.id] }],
  ]) {
    const snapshot = JSON.stringify(room)
    assert.throws(() => act(actor, action, input))
    assert.equal(JSON.stringify(room), snapshot)
  }
  act(host, 'manual-night')
  for (const input of [
    { targets: [people[0].id, people[0].id] },
    { targets: ['outsider'] },
    { targets: [host.id] },
    { targets: [], revision: room.revision - 1 },
  ]) {
    const snapshot = JSON.stringify(room)
    assert.throws(() => act(host, 'manual-dawn', input))
    assert.equal(JSON.stringify(room), snapshot)
  }
  act(host, 'manual-dawn', { targets: [people[0].id] })
  assert.throws(() => act(host, 'manual-execute', { targets: [people[0].id] }))
  assert.throws(() => act(host, 'manual-revive', { targets: [people[1].id] }))
})
test('mode changes only in lobby, clear incompatible cards and reset readiness', () => {
  const room = createRoom('Host', 'preset:0', Date.now(), true),
    host = room.members[0]
  for (let i = 0; i < 5; i++) addPlayer(room, `P${i}`, `preset:${i}`)
  const act = (actor, action, input = {}) =>
    command(room, actor, action, { revision: room.revision, ...input })
  players(room).forEach((p) => act(p, 'ready'))
  act(host, 'deck', { deck: ['frankenstein', 'villager', 'villager', 'villager', 'villager'] })
  assert.throws(() => act(players(room)[0], 'configure-mode', { cardsOnly: false }))
  act(host, 'configure-mode', { cardsOnly: false })
  assert.equal(room.cardsOnly, false)
  assert.deepEqual(room.deck, [])
  assert.ok(players(room).every((p) => !p.ready))
  assert.throws(() => act(host, 'manual-night'))
  act(host, 'configure-mode', { cardsOnly: true })
  assert.equal(room.cardsOnly, true)
})

test('cards-only matrix: every character at every supported population deals privately and rematches without scoring', () => {
  const characters = catalog.filter((role) => role.team !== 'utility')
  let cases = 0
  for (const role of characters) {
    for (let count = 5; count <= 24; count++) {
      try {
        const deck = [role.id]
        for (const candidate of characters) {
          while (
            deck.length < count &&
            deck.filter((id) => id === candidate.id).length < candidate.quantity
          )
            deck.push(candidate.id)
          if (deck.length === count) break
        }
        const room = createRoom('Host', 'preset:0', Date.now(), true)
        const host = room.members[0]
        const act = (person, action, input = {}) =>
          command(room, person, action, { revision: room.revision, ...input })
        deck.forEach((_, i) => addPlayer(room, `P${i}`, `preset:${i % 16}`))
        const people = players(room)
        people.forEach((person) => act(person, 'ready'))
        act(host, 'deck', { deck })
        for (const person of people) assert.deepEqual(view(room, person).deck, deck)
        act(host, 'start')
        assert.ok(people.every((person) => view(room, person).myRole === null))
        assert.ok(view(room, host).members.every((member) => member.role === null))
        tick(room, room.deadline)
        const dealt = people.map((person) => view(room, person).myRole).sort()
        assert.deepEqual(dealt, [...deck].sort())
        for (const person of people) {
          assert.ok(view(room, person).members.every((member) => member.role === null))
          act(person, 'seen')
        }
        assert.equal(room.phase, 'manual')
        assert.equal(room.turn, null)
        assert.ok(people.every((person) => view(room, person).action === null))
        assert.throws(() => act(host, 'next'))
        assert.throws(() => act(people[0], 'finish-manual'))
        act(host, 'finish-manual')
        assert.equal(room.history.length, 1)
        assert.equal(room.winner, 'manual')
        assert.ok(people.every((person) => person.wins === 0 && person.losses === 0))
        act(host, 'rematch')
        assert.equal(room.phase, 'lobby')
        assert.ok(people.every((person) => view(room, person).myRole === null && !person.ready))
        cases++
      } catch (error) {
        error.message = `${role.id} / ${count} players: ${error.message}`
        throw error
      }
    }
  }
  assert.equal(cases, characters.length * 20)
})
