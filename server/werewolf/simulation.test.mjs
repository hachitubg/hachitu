import test from 'node:test'
import assert from 'node:assert/strict'
import { combinations, combinationDeck, simulate } from './simulation.mjs'
import { catalog } from './engine.mjs'

test('audit combinations enumerate legal multisets rather than pretending repeated unique cards exist', () => {
  const roles = catalog.filter((r) => r.enabled)
  const n = roles.length
  const pairs = combinations(2),
    triples = combinations(3)
  assert.equal(pairs.length, (n * (n - 1)) / 2 + roles.filter((r) => r.quantity >= 2).length)
  assert.equal(
    triples.length,
    (n * (n - 1) * (n - 2)) / 6 +
      roles.filter((r) => r.quantity >= 2).length * (n - 1) +
      roles.filter((r) => r.quantity >= 3).length,
  )
  assert.equal(new Set(triples.map((keys) => keys.join(','))).size, triples.length)
  assert.ok(!pairs.some((keys) => keys[0] === 'seer' && keys[1] === 'seer'))
  assert.ok(pairs.some((keys) => keys.every((id) => id === 'mason')))
})

test('the same seed reproduces decisions even though member IDs and tokens are random', () => {
  const scenario = {
    ...combinationDeck(['dire_wolf', 'doppelganger', 'hunter']),
    seed: 9002605,
    policy: 'chaos',
    faults: true,
  }
  assert.deepEqual(simulate(scenario), simulate(scenario))
})

test('an unfinished audit cannot be reported as a passed game, and replay data excludes tokens', () => {
  assert.throws(
    () => simulate({ ...combinationDeck(['seer', 'witch']), seed: 123, maxSteps: 1 }),
    (error) => {
      assert.match(error.message, /exceeded bound/)
      assert.equal(error.scenario.seed, 123)
      assert.ok(Array.isArray(error.scenario.trace))
      assert.equal(JSON.stringify(error.scenario).includes('token'), false)
      return true
    },
  )
})
