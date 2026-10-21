import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoom, addPlayer, players, command, view, tick, catalog } from './engine.mjs'

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
