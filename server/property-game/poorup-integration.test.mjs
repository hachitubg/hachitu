import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoom, addPlayer, command, current } from './engine.mjs'
import { propertyEligibility } from './poorup-adapter.mjs'
import { createWalkTimeline } from '../../vendor/poorup/public/clientBoardMotion.js'
import {
  ROLL_LEAD_MS,
  HUMAN_MOVEMENT_STEP_MS,
} from '../../vendor/poorup/public/gamePresentationTiming.js'

function setup() {
  const room = createRoom('An', 'car', 1000)
  addPlayer(room, 'Bình', 'cat')
  room.players.forEach((p) => {
    p.ready = true
  })
  command(room, room.hostId, 'start', { revision: room.revision }, 1000, () => 0)
  return room
}
function act(room, action, input = {}, values = [0, 1]) {
  command(
    room,
    current(room).id,
    action,
    { revision: room.revision, ...input },
    2000,
    () => values.shift() ?? 0,
  )
}
test('Poorup recorder publishes forward GO-crossing steps and same authoritative dice to every client', () => {
  const r = setup()
  current(r).position = 38
  act(r, 'roll')
  assert.deepEqual(r.presentation.dice, [1, 2])
  assert.deepEqual(r.presentation.segments[0].path, [39, 0, 1])
  assert.equal(r.presentation.segments[0].from, 38)
  assert.equal(r.presentation.segments[0].offsetMs, ROLL_LEAD_MS)
  assert.equal(r.presentation.readyAt, 2000 + ROLL_LEAD_MS + 3 * HUMAN_MOVEMENT_STEP_MS + 200)
  assert.equal(current(r).position, 1)
  assert.equal(r._activePresentation, undefined)
  assert.equal(r.presentationClock, undefined)
})
test('Poorup records back-three and jail as different segments, never a fake forward lap', () => {
  const r = setup()
  current(r).position = 33
  r.decks.chance = [9]
  r.decks.chest = [1]
  act(r, 'roll')
  assert.deepEqual(r.presentation.segments[0].path, [34, 35, 36])
  assert.deepEqual(r.presentation.segments[1].path, [35, 34, 33])
  const other = setup()
  current(other).position = 27
  act(other, 'roll')
  assert.equal(current(other).jail, true)
  assert.equal(other.presentation.segments[1].teleport, true)
  assert.deepEqual(other.presentation.segments[1].path, [10])
})
test('Poorup timeline boundary/catch-up and read-only property eligibility remain deterministic', () => {
  const timeline = createWalkTimeline({ path: [39, 0, 1], stepMs: 300, startedAt: 1000 })
  assert.equal(timeline.snapshot(1000).beforeFirst, true)
  assert.equal(timeline.snapshot(1300).index, 0)
  assert.equal(timeline.snapshot(1600).index, 1)
  assert.equal(timeline.snapshot(1900).done, true)
  assert.equal(timeline.snapshot(9000).index, 2)
  const r = setup(),
    p = current(r)
  r.properties
    .filter((a) => [1, 3].includes(a.id))
    .forEach((a) => {
      a.owner = p.id
    })
  const before = structuredClone(r)
  assert.equal(propertyEligibility(r, p, 1).build, true)
  assert.equal(propertyEligibility(r, p, 1).mortgage, true)
  assert.deepEqual(r, before)
  r.properties.find((a) => a.id === 1).level = 1
  assert.equal(propertyEligibility(r, p, 1).build, false)
  assert.equal(propertyEligibility(r, p, 3).mortgage, false)
})
