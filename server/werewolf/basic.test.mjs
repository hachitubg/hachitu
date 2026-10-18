import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRoom,
  addPlayer,
  command,
  players,
  tick,
  view,
  catalog,
  validateDeck,
  paused,
  SUPPORTED,
} from './engine.mjs'

const act = (room, person, action, data = {}) =>
  command(room, person, action, { revision: room.revision, ...data })
const host = (room, action, data) => act(room, room.members[0], action, data)
function setup(cards, hidden = 'villager') {
  const room = createRoom('Host', 'preset:0')
  cards.forEach((_, i) => addPlayer(room, `Người ${i}`, `preset:${i % 16}`))
  players(room).forEach((p) => act(room, p, 'ready'))
  host(room, 'deck', { deck: cards, drunkRole: hidden })
  host(room, 'start')
  players(room).forEach((p, i) => {
    p.role = cards[i]
    p.originalRole = cards[i]
    p.hiddenRole = cards[i] === 'drunk' ? hidden : null
  })
  tick(room, room.deadline)
  players(room).forEach((p) => act(room, p, 'seen'))
  return room
}
function night(room, choose = () => null) {
  host(room, 'next')
  let turns = 0
  while (room.turn && room.phase === 'night') {
    assert.ok(++turns < 50)
    const actors = room.turn.actors.map((id) => room.members.find((p) => p.id === id))
    const decisions = actors.map((p) => {
      const spec = view(room, p).action
      return (
        choose(room.turn.key, p, spec) || {
          targets: spec.optional ? [] : spec.options.slice(0, spec.max),
        }
      )
    })
    actors.forEach((p, i) => act(room, p, 'draft', decisions[i]))
    actors.forEach((p, i) => act(room, p, 'confirm', decisions[i]))
    host(room, 'next')
  }
  host(room, 'next')
  tick(room, room.deadline)
}
function blankDay(room) {
  while (['day', 'day-extra'].includes(room.phase)) {
    host(room, 'next')
    players(room)
      .filter((p) => view(room, p).canVote)
      .forEach((p) => act(room, p, 'vote', { vote: null }))
    host(room, 'next')
  }
}
function execute(room, target) {
  room.phase = 'verdict'
  room.nominee = target.id
  room.votes = {}
  players(room)
    .filter((p) => view(room, p).canVote)
    .forEach((p) => act(room, p, 'vote', { vote: p.role !== 'pacifist' }))
  host(room, 'next')
}

test('all 34 basic character roles enabled; utility cards remain unplayable', () => {
  const basic = catalog.filter((r) => r.setId === 'basic' && r.team !== 'utility')
  assert.equal(basic.length, 34)
  assert.ok(basic.every((r) => r.enabled && r.guide_vi && r.ability_vi && r.win_condition_vi))
  assert.ok(catalog.filter((r) => r.team === 'utility').every((r) => !r.enabled))
})
test('Cupid death chain waits for Hunter shot, then scores after the last wolf dies', () => {
  const room = setup([
    'werewolf',
    'cupid',
    'hunter',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'cupid'
      ? { targets: [p[2].id, p[3].id] }
      : key === 'wolves'
        ? { targets: [p[2].id] }
        : null,
  )
  assert.equal(p[2].alive, false)
  assert.equal(p[3].alive, false)
  assert.equal(room.phase, 'death-action')
  assert.equal(room.winner, null)
  assert.ok(view(room, p[2]).action)
  assert.equal(view(room, p[3]).action, null)
  assert.throws(() => act(room, p[3], 'confirm', { targets: [p[0].id] }))
  act(room, p[2], 'confirm', { targets: [p[0].id] })
  host(room, 'next')
  assert.equal(room.phase, 'ended')
  assert.equal(room.winner, 'village')
  assert.equal(p[0].alive, false)
  assert.equal(room.history.length, 1)
})
test('mixed lovers win together only when last two, without granting victory to Cupid', () => {
  const room = setup(['werewolf', 'cupid', 'villager', 'villager', 'villager'])
  const p = players(room)
  room.lovers = [p[0].id, p[2].id]
  p[1].alive = false
  p[4].alive = false
  execute(room, p[3])
  assert.equal(room.winner, 'lovers')
  assert.equal(p[0].wins, 1)
  assert.equal(p[2].wins, 1)
  assert.equal(p[1].wins, 0)
})
test('Cursed transforms only after an unblocked wolf bite and joins the pack next night', () => {
  const room = setup(['werewolf', 'cursed', 'seer', 'villager', 'villager', 'villager', 'villager'])
  const p = players(room)
  night(room, (key) => (key === 'wolves' || key === 'seer' ? { targets: [p[1].id] } : null))
  assert.equal(p[1].alive, true)
  assert.equal(p[1].role, 'werewolf')
  assert.match(p[2].notes[0], /Không phải Sói/)
  assert.equal(view(room, p[3]).members.find((x) => x.id === p[1].id).role, null)
  blankDay(room)
  host(room, 'next')
  assert.ok(room.turn.actors.includes(p[1].id))
})
test('Bodyguard protection prevents cursed conversion', () => {
  const room = setup(['werewolf', 'cursed', 'bodyguard', 'villager', 'villager', 'villager'])
  const p = players(room)
  night(room, (key) => (['wolves', 'bodyguard'].includes(key) ? { targets: [p[1].id] } : null))
  assert.equal(p[1].role, 'cursed')
  assert.equal(p[1].alive, true)
})
test('Con bệnh overrides Sói con bonus for the following night; no stored extra bite', () => {
  const room = setup([
    'werewolf',
    'wolf_cub',
    'diseased',
    'cupid',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'cupid'
      ? { targets: [p[1].id, p[2].id] }
      : key === 'wolves'
        ? { targets: [p[2].id] }
        : null,
  )
  assert.equal(p[1].alive, false)
  assert.equal(room.sickNight, 2)
  assert.equal(room.doubleBiteNight, 2)
  blankDay(room)
  night(room)
  assert.equal(room.round, 2)
  assert.equal(room.deaths.length, 0)
  blankDay(room)
  host(room, 'next')
  assert.equal(view(room, p[0]).action.max, 1)
})
test('Sói con grants two distinct targets; witch rescues exactly one chosen victim', () => {
  const room = setup([
    'werewolf',
    'wolf_cub',
    'villager',
    'villager',
    'witch',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  room.round = 1
  execute(room, p[1])
  assert.equal(room.phase, 'day-end')
  night(room, (key, actor) => {
    if (key === 'wolves') {
      assert.equal(view(room, actor).action.max, 2)
      assert.throws(() => act(room, actor, 'draft', { targets: [p[2].id] }))
      return { targets: [p[2].id, p[3].id] }
    }
    if (key === 'witch') {
      assert.throws(() => act(room, actor, 'confirm', { targets: [], save: true }))
      return { targets: [], save: true, saveTarget: p[3].id }
    }
    return null
  })
  assert.equal(p[2].alive, false)
  assert.equal(p[3].alive, true)
  assert.equal(p[4].used.heal, true)
})
test('Lực sĩ dies at the end of the following night even if protected then', () => {
  const room = setup([
    'werewolf',
    'tough_guy',
    'bodyguard',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[1].id] } : key === 'bodyguard' ? { targets: [p[3].id] } : null,
  )
  assert.equal(p[1].alive, true)
  assert.equal(p[1].woundDue, 2)
  blankDay(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[4].id] } : key === 'bodyguard' ? { targets: [p[1].id] } : null,
  )
  assert.equal(p[1].alive, false)
})
test('Apprentice starts on the night after Seer death, not during the fatal night', () => {
  const room = setup([
    'werewolf',
    'seer',
    'apprentice_seer',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room),
    seen = []
  night(room, (key) => {
    seen.push(key)
    return key === 'wolves' ? { targets: [p[1].id] } : null
  })
  assert.equal(seen.includes('apprentice_seer'), false)
  blankDay(room)
  host(room, 'next')
  assert.ok(room.queue.some((turn) => turn.key === 'apprentice_seer'))
})
test('Doppelganger inherits the remaining witch resources but not wounds or blessings', () => {
  const room = setup([
    'werewolf',
    'doppelganger',
    'witch',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  p[2].used.heal = true
  night(room, (key) =>
    key === 'doppelganger'
      ? { targets: [p[2].id] }
      : key === 'wolves'
        ? { targets: [p[2].id] }
        : null,
  )
  assert.equal(p[1].role, 'witch')
  assert.equal(p[1].used.heal, true)
  assert.equal(p[1].used.poison, undefined)
  assert.equal(p[1].woundDue, null)
  assert.equal(view(room, p[1]).myRole, 'witch')
})
test('Drunk reserved card is legal, private, and activates at night three', () => {
  assert.throws(() =>
    validateDeck(['werewolf', 'drunk', 'seer', 'villager', 'villager'], 5, 'seer'),
  )
  const room = setup(
    ['werewolf', 'drunk', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'],
    'seer',
  )
  const p = players(room)
  assert.equal(view(room, p[1]).myRole, 'drunk')
  assert.equal(view(room, p[2]).members.find((x) => x.id === p[1].id).hiddenRole, null)
  assert.equal(view(room, room.members[0]).members.find((x) => x.id === p[1].id).hiddenRole, 'seer')
  night(room, (key) => (key === 'wolves' ? { targets: [p[2].id] } : null))
  blankDay(room)
  night(room, (key) => (key === 'wolves' ? { targets: [p[3].id] } : null))
  blankDay(room)
  host(room, 'next')
  assert.equal(p[1].role, 'seer')
  assert.ok(room.queue.some((turn) => turn.key === 'seer'))
})
test('Ghost dies on night one, sends only a valid letter after death, and reveals it at dawn', () => {
  const room = setup([
    'werewolf',
    'ghost',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) => (key === 'wolves' ? { targets: [p[2].id] } : null))
  assert.equal(p[1].alive, false)
  blankDay(room)
  night(room, (key, actor) => {
    if (key === 'wolves') return { targets: [p[3].id] }
    if (key === 'ghost') {
      assert.equal(actor.alive, false)
      assert.deepEqual(view(room, p[4]).clues, [])
      assert.throws(() => act(room, actor, 'confirm', { targets: [], text: 'N' }))
      assert.throws(() => act(room, actor, 'confirm', { targets: [], text: 'AB' }))
      actor.connected = false
      assert.equal(paused(room), true)
      actor.connected = true
      return { targets: [], text: 'Z' }
    }
    return null
  })
  assert.deepEqual(view(room, p[4]).clues, [{ round: 2, letter: 'Z' }])
})
test('Old Hag excludes an alive person from both ballots, then expires next night', () => {
  const room = setup([
    'werewolf',
    'old_hag',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[3].id] } : key === 'old_hag' ? { targets: [p[2].id] } : null,
  )
  assert.equal(p[2].alive, true)
  assert.equal(view(room, p[2]).canVote, false)
  host(room, 'next')
  assert.equal(room.eligible.includes(p[2].id), false)
  assert.throws(() => act(room, p[2], 'vote', { vote: null }))
  players(room)
    .filter((p) => view(room, p).canVote)
    .forEach((p) => act(room, p, 'vote', { vote: null }))
  host(room, 'next')
  host(room, 'next')
  assert.equal(p[2].banished, false)
})
test('P.I. follows the configured living seating ring and consumes the skill once', () => {
  const room = setup(['werewolf', 'pi', 'villager', 'villager', 'villager', 'villager', 'villager'])
  const p = players(room)
  room.seatOrder = [p[1].id, p[2].id, p[0].id, p[3].id, p[4].id, p[5].id, p[6].id]
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[6].id] } : key === 'pi' ? { targets: [p[2].id] } : null,
  )
  assert.match(p[1].notes[0], /có Sói/)
  assert.equal(p[1].used.pi, true)
  blankDay(room)
  host(room, 'next')
  assert.ok(!room.queue.some((turn) => turn.key === 'pi'))
})
test('Vampire survives a wolf bite and the marked victim dies after the next ballot', () => {
  const room = setup([
    'werewolf',
    'vampire',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[1].id] } : key === 'vampires' ? { targets: [p[2].id] } : null,
  )
  assert.equal(p[1].alive, true)
  assert.equal(p[2].alive, true)
  assert.equal('vampireDue' in view(room, p[2]).members.find((x) => x.id === p[2].id), false)
  blankDay(room)
  assert.equal(p[2].alive, false)
  assert.equal(room.phase, 'day-end')
})
test('Troublemaker adds exactly one extra ballot and does not reactivate next night', () => {
  const room = setup([
    'werewolf',
    'troublemaker',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves'
      ? { targets: [p[6].id] }
      : key === 'troublemaker'
        ? { targets: [], activate: true }
        : null,
  )
  assert.equal(room.executionsLeft, 2)
  host(room, 'next')
  players(room)
    .filter((p) => view(room, p).canVote)
    .forEach((p) => act(room, p, 'vote', { vote: null }))
  host(room, 'next')
  assert.equal(room.phase, 'day-extra')
  blankDay(room)
  assert.equal(room.phase, 'day-end')
  host(room, 'next')
  assert.ok(!room.queue.some((turn) => turn.key === 'troublemaker'))
})
test('Prince ends the day even when a second execution was scheduled', () => {
  const room = setup(['werewolf', 'prince', 'troublemaker', 'villager', 'villager', 'villager'])
  room.executionsLeft = 2
  execute(room, players(room)[1])
  assert.equal(room.phase, 'day-end')
  assert.equal(room.executionsLeft, 0)
})
test('Cult leader, Hoodlum and Tanner are scored individually alongside the winning faction', () => {
  const room = setup([
    'werewolf',
    'cult_leader',
    'hoodlum',
    'tanner',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  p[3].alive = false
  p[4].alive = false
  p[2].hoodlumTargets = [p[3].id, p[4].id]
  p[1].followers = p.filter((x) => x !== p[1]).map((x) => x.id)
  execute(room, p[0])
  assert.equal(room.winner, 'village')
  for (const index of [1, 2, 3]) {
    assert.equal(p[index].wins, 1)
    assert.equal(view(room, p[index]).myWon, true)
  }
  assert.equal(p[0].losses, 1)
})
test('Lone wolf does not win with the ordinary pack, but wins when last with a non-wolf', () => {
  const room = setup(['werewolf', 'lone_wolf', 'villager', 'villager', 'villager', 'villager'])
  const p = players(room)
  p[3].alive = p[4].alive = p[5].alive = false
  execute(room, p[0])
  assert.equal(room.winner, 'lone_wolf')
  assert.equal(p[1].wins, 1)
  assert.equal(p[0].wins, 0)
})
test('No premature village win while a vampire survives, and vampire-only survivors win', () => {
  const room = setup(['werewolf', 'vampire', 'villager', 'villager', 'villager'])
  const p = players(room)
  execute(room, p[0])
  assert.notEqual(room.phase, 'ended')
  p[2].alive = p[3].alive = false
  execute(room, p[4])
  assert.equal(room.winner, 'vampire')
  assert.equal(p[1].wins, 1)
})

test('Doppelganger keeps its own priest blessing when inheriting another role', () => {
  const room = setup([
    'werewolf',
    'doppelganger',
    'priest',
    'seer',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'doppelganger' || key === 'wolves'
      ? { targets: [p[3].id] }
      : key === 'priest'
        ? { targets: [p[1].id] }
        : null,
  )
  assert.equal(p[1].role, 'seer')
  assert.equal(p[1].used.blessed, true)
  blankDay(room)
  night(room, (key) => (key === 'wolves' ? { targets: [p[1].id] } : null))
  assert.equal(p[1].alive, true)
  assert.equal(p[1].used.blessed, false)
})

test('Spellcaster may skip without consuming a target and cannot silence someone twice', () => {
  const room = setup([
    'werewolf',
    'spellcaster',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key, actor, spec) => {
    if (key === 'wolves') return { targets: [p[6].id] }
    if (key === 'spellcaster') {
      assert.equal(spec.optional, true)
      return { targets: [] }
    }
    return null
  })
  assert.equal(Object.keys(p[1].used).length, 0)
  blankDay(room)
  night(room, (key) =>
    key === 'wolves'
      ? { targets: [p[5].id] }
      : key === 'spellcaster'
        ? { targets: [p[2].id] }
        : null,
  )
  assert.equal(p[2].silenced, true)
  assert.equal(view(room, p[2]).canVote, true)
  blankDay(room)
  host(room, 'next')
  while (room.turn?.key !== 'spellcaster') {
    const actor = room.members.find((p) => p.id === room.turn.actors[0])
    act(room, actor, 'draft', { targets: [p[4].id] })
    act(room, actor, 'confirm', { targets: [p[4].id] })
    host(room, 'next')
  }
  assert.equal(p[2].silenced, false)
  assert.equal(view(room, p[1]).action.options.includes(p[2].id), false)
  assert.throws(() => act(room, p[1], 'confirm', { targets: [p[2].id] }), /Mục tiêu/)
})

test('Vampire victim Hunter gets a final shot after the ballot before victory is decided', () => {
  const room = setup([
    'werewolf',
    'vampire',
    'hunter',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[6].id] } : key === 'vampires' ? { targets: [p[2].id] } : null,
  )
  execute(room, p[0])
  assert.equal(p[2].alive, false)
  assert.equal(room.phase, 'death-action')
  assert.equal(room.winner, null)
  assert.equal(view(room, p[2]).action.key, 'hunter')
  act(room, p[2], 'confirm', { targets: [p[1].id] })
  host(room, 'next')
  assert.equal(p[1].alive, false)
  assert.equal(room.winner, 'village')
  assert.equal(room.history.length, 1)
})

test('Priest blessing absorbs one attack, not both a wolf bite and poison in the same night', () => {
  const room = setup([
    'werewolf',
    'priest',
    'witch',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    ['wolves', 'priest', 'witch'].includes(key) ? { targets: [p[3].id] } : null,
  )
  assert.equal(p[3].alive, false)
  assert.equal(p[3].deathReason, 'bình độc')
  assert.equal(p[3].used.blessed, false)
  assert.equal(p[1].used.priest, true)
  assert.equal(p[2].used.poison, true)
  assert.equal(room.deaths.filter((id) => id === p[3].id).length, 1)
})

for (const key of SUPPORTED) {
  test(`full phase flow for supported role: ${key}`, () => {
    const cards = key === 'werewolf' ? ['werewolf'] : ['werewolf', key]
    if (key === 'mason') cards.push('mason')
    if (['sorceress', 'apprentice_seer'].includes(key)) cards.push('seer')
    while (cards.length < 9) cards.push('villager')
    const room = setup(cards)
    for (let round = 0; round < 4 && room.phase !== 'ended'; round++) {
      night(room, (turn, actor, spec) => {
        if (turn === 'wolves') {
          const victim = players(room).find((p) => p.alive && p.role === 'villager')
          if (victim) return { targets: [victim.id] }
        }
        if (turn === 'troublemaker') return { targets: [], activate: true }
        if (turn === 'ghost') return { targets: [], text: 'Z' }
        if (spec.optional) return { targets: spec.options.slice(0, spec.max) }
        return null
      })
      while (room.phase === 'death-action') {
        const hunter = room.members.find((p) => p.id === room.turn.actors[0])
        act(room, hunter, 'confirm', { targets: [] })
        host(room, 'next')
      }
      if (room.phase !== 'ended') blankDay(room)
      assert.ok(['ended', 'day-end'].includes(room.phase), `${key}: stuck in ${room.phase}`)
    }
  })
}
