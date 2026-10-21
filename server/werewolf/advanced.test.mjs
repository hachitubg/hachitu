import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRoom,
  addPlayer,
  players,
  command,
  view,
  tick,
  validateDeck,
  paused,
} from './engine.mjs'

const act = (room, p, action, input = {}) =>
  command(room, p, action, { revision: room.revision, ...input })
const host = (room, action, input) => act(room, room.members[0], action, input)
function setup(cards, hidden = 'villager') {
  const room = createRoom('Host', 'preset:0')
  cards.forEach((_, i) => addPlayer(room, `P${i}`, `preset:${i % 16}`))
  players(room).forEach((p) => act(room, p, 'ready'))
  host(room, 'deck', { deck: cards, drunkRole: hidden })
  host(room, 'start')
  players(room).forEach((p, i) =>
    Object.assign(p, {
      role: cards[i],
      originalRole: cards[i],
      hiddenRole: cards[i] === 'drunk' ? hidden : null,
    }),
  )
  tick(room, room.deadline)
  players(room).forEach((p) => act(room, p, 'seen'))
  return room
}
function night(room, choose = () => null) {
  if (room.phase !== 'night') host(room, 'next')
  assert.equal(room.phase, 'night')
  let steps = 0
  while (room.turn) {
    assert.ok(++steps < 60)
    const actors = room.turn.actors.map((id) => room.members.find((p) => p.id === id))
    const inputs = actors.map((p) => {
      const spec = view(room, p).action
      return (
        choose(room.turn.key, p, spec) || {
          targets: spec.optional ? [] : spec.options.slice(0, spec.min),
        }
      )
    })
    actors.forEach((p, i) => act(room, p, 'draft', inputs[i]))
    actors.forEach((p, i) => act(room, p, 'confirm', inputs[i]))
    host(room, 'next')
  }
  host(room, 'next')
  tick(room, room.deadline)
}
function blankDay(room) {
  host(room, 'next')
  players(room)
    .filter((p) => view(room, p).canVote)
    .forEach((p) => act(room, p, 'vote', { vote: null }))
  host(room, 'next')
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

test('Martyr chooses before execution, saves the nominee and cannot be bypassed by host', () => {
  const room = setup([
    'werewolf',
    'martyr',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  execute(room, p[2])
  assert.equal(room.phase, 'martyr')
  assert.equal(p[2].alive, true)
  assert.equal(view(room, p[1]).nominee, p[2].id)
  assert.equal(view(room, p[3]).action, null)
  assert.throws(() => host(room, 'next'), /Chờ tất cả/)
  act(room, p[1], 'confirm', { targets: [], activate: true })
  host(room, 'next')
  assert.equal(p[1].alive, false)
  assert.equal(p[2].alive, true)
  assert.equal(room.phase, 'day-end')
})

test('Martyr can decline; Prince immunity does not force an unnecessary sacrifice', () => {
  const room = setup([
    'werewolf',
    'martyr',
    'prince',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  execute(room, p[2])
  assert.equal(room.phase, 'day-end')
  assert.equal(p[2].used.pardon, true)
  execute(room, p[3])
  assert.equal(room.phase, 'martyr')
  act(room, p[1], 'confirm', { targets: [], activate: false })
  host(room, 'next')
  assert.equal(p[1].alive, true)
  assert.equal(p[3].alive, false)
})

test('Multiple Martyrs sacrifice only the first volunteer by seating order and finish linked deaths first', () => {
  const room = setup([
    'werewolf',
    'martyr',
    'doppelganger',
    'hunter',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  p[2].role = 'martyr'
  room.seatOrder = [
    p[2].id,
    p[1].id,
    ...p.filter((x) => ![p[1], p[2]].includes(x)).map((x) => x.id),
  ]
  room.lovers = [p[2].id, p[3].id]
  execute(room, p[4])
  for (const martyr of [p[1], p[2]]) act(room, martyr, 'confirm', { targets: [], activate: true })
  host(room, 'next')
  assert.equal(p[2].alive, false)
  assert.equal(p[1].alive, true)
  assert.equal(p[4].alive, true)
  assert.equal(room.phase, 'death-action')
  act(room, p[3], 'confirm', { targets: [p[0].id] })
  host(room, 'next')
  assert.equal(room.winner, 'village')
})

test('Beholder only receives the regular Seer identity and does not reveal itself or a hidden Drunk', () => {
  assert.throws(
    () => validateDeck(['werewolf', 'beholder', 'villager', 'villager', 'villager'], 5),
    /cần Tiên tri/,
  )
  const room = setup([
    'werewolf',
    'beholder',
    'seer',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) => (key === 'wolves' ? { targets: [p[6].id] } : null))
  assert.ok(p[1].notes.some((note) => note.includes(p[2].name)))
  assert.ok(!p[2].notes.some((note) => note.includes('Người chứng kiến')))
  assert.equal(view(room, p[3]).members.find((x) => x.id === p[2].id).role, null)
  const hidden = setup(
    ['werewolf', 'beholder', 'drunk', 'villager', 'villager', 'villager', 'villager'],
    'seer',
  )
  const h = players(hidden)
  night(hidden, (key) => (key === 'wolves' ? { targets: [h[6].id] } : null))
  assert.ok(h[1].notes.some((note) => note.includes('chưa xuất hiện')))
  assert.ok(!h[1].notes.some((note) => note.includes(h[2].name)))
})

test('Dreamwolf sleeps until a true wolf dies, not a Minion, and reset restores the sleep flag', () => {
  const room = setup([
    'werewolf',
    'dream_wolf',
    'minion',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) => {
    if (key === 'wolves') {
      assert.equal(view(room, p[1]).action, null)
      assert.deepEqual(view(room, p[1]).choices, [])
      return { targets: [p[8].id] }
    }
    return null
  })
  assert.ok(p[0].notes.some((note) => note.includes(p[1].name)))
  execute(room, p[2])
  assert.equal(room.wolfDied, false)
  night(room, (key) => {
    if (key === 'wolves') {
      assert.deepEqual(room.turn.actors, [p[0].id])
      return { targets: [p[7].id] }
    }
    return null
  })
  execute(room, p[0])
  assert.equal(room.wolfDied, true)
  assert.notEqual(room.phase, 'ended')
  host(room, 'next')
  assert.deepEqual(room.turn.actors, [p[1].id])
  host(room, 'reset-night')
  assert.deepEqual(room.turn.actors, [p[1].id])
})

test('A lone Dreamwolf cannot hunt before awakening, but still counts as an enemy to the village', () => {
  const room = setup(['dream_wolf', 'villager', 'villager', 'villager', 'villager', 'villager'])
  night(room)
  assert.equal(room.phase, 'day')
  assert.deepEqual(room.deaths, [])
  assert.equal(room.winner, null)
})

test('Teen wolf review is host-only, requires an explicit verdict, then kills before the next night', () => {
  const room = setup([
    'teenage_werewolf',
    'werewolf',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) => (key === 'wolves' ? { targets: [p[8].id] } : null))
  blankDay(room)
  host(room, 'next')
  assert.equal(room.phase, 'teen-review')
  assert.deepEqual(view(room, p[3]).teenChecks, [])
  assert.equal(view(room, room.members[0]).teenChecks[0].spoken, null)
  assert.throws(() => host(room, 'next'), /xác nhận từng người/)
  assert.throws(
    () => act(room, p[0], 'teen-check', { playerId: p[0].id, spoken: true }),
    /Chỉ quản trò/,
  )
  host(room, 'teen-check', { playerId: p[0].id, spoken: false })
  host(room, 'next')
  assert.equal(p[0].alive, false)
  assert.equal(room.phase, 'day-end')
  host(room, 'next')
  assert.equal(room.phase, 'night')
  assert.deepEqual(room.turn.actors, [p[1].id])
})

test('A silenced Teen wolf is exempt, and confirmation must be repeated on later days', () => {
  const room = setup([
    'teenage_werewolf',
    'spellcaster',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves'
      ? { targets: [p[7].id] }
      : key === 'spellcaster'
        ? { targets: [p[0].id] }
        : null,
  )
  blankDay(room)
  host(room, 'next')
  assert.equal(room.phase, 'night')
  night(room, (key) => (key === 'wolves' ? { targets: [p[6].id] } : { targets: [] }))
  blankDay(room)
  host(room, 'next')
  assert.equal(room.phase, 'teen-review')
  host(room, 'teen-check', { playerId: p[0].id, spoken: true })
  host(room, 'next')
  assert.equal(p[0].alive, true)
  night(room, (key) => (key === 'wolves' ? { targets: [p[5].id] } : { targets: [] }))
  blankDay(room)
  host(room, 'next')
  assert.equal(room.phase, 'teen-review')
  assert.equal(view(room, room.members[0]).teenChecks[0].spoken, null)
})

test('Leprechaun redirects before Witch information and protections apply to the new victim', () => {
  const room = setup([
    'werewolf',
    'leprechaun',
    'witch',
    'bodyguard',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key, actor, spec) => {
    if (key === 'wolves') return { targets: [p[5].id] }
    if (key === 'bodyguard') return { targets: [p[6].id] }
    if (key === 'leprechaun') {
      assert.deepEqual(spec.wolfTargets, [p[5].id])
      assert.throws(
        () => act(room, actor, 'confirm', { targets: [p[3].id], redirectFrom: p[5].id }),
        /Mục tiêu|kề/,
      )
      return { targets: [p[6].id], redirectFrom: p[5].id }
    }
    if (key === 'witch') assert.deepEqual(spec.wolfTargets, [p[6].id])
    return null
  })
  assert.equal(p[5].alive, true)
  assert.equal(p[6].alive, true)
})

test('Double bites cannot be merged by Leprechaun; a redirected Cursed transforms normally', () => {
  const room = setup([
    'werewolf',
    'leprechaun',
    'villager',
    'villager',
    'villager',
    'villager',
    'cursed',
    'villager',
    'villager',
  ])
  const p = players(room)
  room.doubleBiteNight = 1
  night(room, (key, actor) => {
    if (key === 'wolves') return { targets: [p[4].id, p[5].id] }
    if (key === 'leprechaun') {
      assert.throws(() =>
        act(room, actor, 'confirm', { targets: [p[5].id], redirectFrom: p[4].id }),
      )
      assert.throws(() =>
        act(room, actor, 'confirm', { targets: [p[6].id], redirectFrom: p[4].id }),
      )
      return { targets: [p[6].id], redirectFrom: p[5].id }
    }
    return null
  })
  assert.equal(p[4].alive, false)
  assert.equal(p[5].alive, true)
  assert.equal(p[6].role, 'werewolf')
})

test('Bloody Mary killed by wolves acts while dead but cannot discover faction through target options', () => {
  const room = setup([
    'werewolf',
    'bloody_mary',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) => (key === 'wolves' ? { targets: [p[1].id] } : null))
  assert.equal(p[1].revengeTeam, 'werewolf')
  blankDay(room)
  night(room, (key, actor, spec) => {
    if (key === 'wolves') return { targets: [p[7].id] }
    if (key === 'bloody_mary') {
      assert.equal(actor.alive, false)
      assert.equal(spec.options.length, p.filter((p) => p.alive).length)
      actor.connected = false
      assert.equal(paused(room), true)
      actor.connected = true
      return { targets: [p[0].id] }
    }
    return null
  })
  assert.equal(p[0].alive, false)
  assert.equal(room.winner, 'village')
  assert.equal(view(room, p[1]).myWon, true)
})

test('Bloody Mary executed by village does not hurt a wolf and loses if the village wins', () => {
  const room = setup([
    'werewolf',
    'bloody_mary',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) => (key === 'wolves' ? { targets: [p[7].id] } : null))
  execute(room, p[1])
  assert.equal(p[1].revengeTeam, 'village')
  night(room, (key) =>
    key === 'wolves'
      ? { targets: [p[6].id] }
      : key === 'bloody_mary'
        ? { targets: [p[0].id] }
        : null,
  )
  assert.equal(p[0].alive, true)
  execute(room, p[0])
  assert.equal(room.winner, 'village')
  assert.equal(view(room, p[1]).myWon, false)
})

test('Vampire-caused death correctly assigns Bloody Mary revenge to vampires', () => {
  const room = setup([
    'werewolf',
    'vampire',
    'bloody_mary',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[8].id] } : key === 'vampires' ? { targets: [p[2].id] } : null,
  )
  blankDay(room)
  assert.equal(p[2].alive, false)
  assert.equal(p[2].revengeTeam, 'vampire')
})

test('Mummy controls both nomination and verdict while preserving Mayor vote weight', () => {
  const room = setup([
    'werewolf',
    'the_mummy',
    'mayor',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[6].id] } : key === 'the_mummy' ? { targets: [p[2].id] } : null,
  )
  assert.equal(view(room, p[2]).notes.length, 0)
  host(room, 'next')
  p.filter((p) => p.alive).forEach((person) =>
    act(room, person, 'vote', {
      vote: person === p[2] ? p[0].id : person === p[3] ? p[4].id : null,
    }),
  )
  host(room, 'next')
  assert.equal(room.nominee, p[4].id)
  host(room, 'next')
  p.filter((p) => p.alive).forEach((person) =>
    act(room, person, 'vote', { vote: [p[1], p[3]].includes(person) }),
  )
  host(room, 'next')
  assert.equal(p[4].alive, false)
  assert.ok(room.logs.some((event) => event.message.includes('4/7 phiếu Có')))
})

test('Mummy effect ends if its controller dies, and nomination falls back to original votes', () => {
  const room = setup([
    'werewolf',
    'the_mummy',
    'witch',
    'mayor',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves'
      ? { targets: [p[6].id] }
      : key === 'witch'
        ? { targets: [p[1].id] }
        : key === 'the_mummy'
          ? { targets: [p[3].id] }
          : null,
  )
  assert.equal(p[1].alive, false)
  host(room, 'next')
  p.filter((p) => p.alive).forEach((person) =>
    act(room, person, 'vote', { vote: person === p[3] ? p[0].id : null }),
  )
  host(room, 'next')
  assert.equal(room.nominee, p[0].id)
})

test('Mummy cycles do not loop and preserve each original ballot', () => {
  const room = setup([
    'werewolf',
    'the_mummy',
    'doppelganger',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  p[2].role = 'the_mummy'
  night(room, (key, actor) =>
    key === 'wolves'
      ? { targets: [p[6].id] }
      : key === 'the_mummy'
        ? { targets: [actor === p[1] ? p[2].id : p[1].id] }
        : null,
  )
  host(room, 'next')
  p.filter((p) => p.alive).forEach((person) =>
    act(room, person, 'vote', {
      vote: person === p[1] ? p[3].id : person === p[2] ? p[4].id : null,
    }),
  )
  host(room, 'next')
  assert.equal(room.phase, 'nominate')
  assert.equal(room.ballot, 1)
  assert.deepEqual(new Set(room.eligible), new Set([p[3].id, p[4].id]))
})

test('mixed games progress through all new phases without getting stuck or revealing private roles', () => {
  let seed = 20261020
  const next = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % n
  }
  const additions = [
    'hunter',
    'cupid',
    'doppelganger',
    'priest',
    'witch',
    'big_bad_wolf',
    'vampire',
    'troublemaker',
    'old_hag',
    'spellcaster',
    'revealer',
    'wolf_cub',
  ]
  for (const addition of additions) {
    const room = setup([
      'werewolf',
      'seer',
      'martyr',
      'bloody_mary',
      'leprechaun',
      'beholder',
      'dream_wolf',
      'teenage_werewolf',
      'the_mummy',
      addition,
      'villager',
      'villager',
      'villager',
    ])
    for (let step = 0; step < 600 && room.phase !== 'ended'; step++) {
      if (['night', 'death-action', 'martyr'].includes(room.phase) && room.turn) {
        const actors = room.turn.actors.map((id) => room.members.find((p) => p.id === id))
        const common = view(room, actors[0]).action
        const packTargets = common.options.slice(0, common.min)
        const inputs = actors.map((p) => {
          const spec = view(room, p).action
          if (['wolves', 'vampires'].includes(spec.key)) return { targets: packTargets }
          if (spec.kind === 'activate') return { targets: [], activate: next(3) === 0 }
          if (spec.kind === 'letter' || spec.key === 'leprechaun') return { targets: [] }
          return { targets: spec.optional && next(2) === 0 ? [] : spec.options.slice(0, spec.min) }
        })
        actors.forEach((p, i) => act(room, p, 'draft', inputs[i]))
        actors.forEach((p, i) => act(room, p, 'confirm', inputs[i]))
        host(room, 'next')
      } else if (room.phase === 'dawn') tick(room, room.deadline)
      else if (room.phase === 'teen-review') {
        view(room, room.members[0]).teenChecks.forEach((check) =>
          host(room, 'teen-check', { playerId: check.id, spoken: next(3) !== 0 }),
        )
        host(room, 'next')
      } else if (['nominate', 'verdict'].includes(room.phase)) {
        const nominee = room.eligible[next(room.eligible.length)]
        for (const voter of players(room).filter((p) => view(room, p).canVote))
          act(room, voter, 'vote', {
            vote: room.phase === 'nominate' ? nominee || null : voter.role !== 'pacifist',
          })
        host(room, 'next')
      } else host(room, 'next')
      for (const p of players(room)) {
        const state = view(room, p)
        assert.equal(Object.hasOwn(state, 'nightCheckpoint'), false)
        assert.equal(JSON.stringify(state).includes(room.members[0].token), false)
        if (room.phase !== 'ended')
          assert.ok(
            state.members.every((member) => member.role === null || member.role === 'prince'),
          )
      }
    }
    assert.equal(room.phase, 'ended', `Mixed ${addition} game did not finish`)
    assert.equal(room.history.length, 1)
  }
})

test('reset from the new end-of-day review restores Mary, Mummy effects and all new round state', () => {
  const room = setup([
    'teenage_werewolf',
    'bloody_mary',
    'the_mummy',
    'villager',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'wolves' ? { targets: [p[1].id] } : key === 'the_mummy' ? { targets: [p[3].id] } : null,
  )
  assert.equal(p[1].alive, false)
  assert.equal(room.mummyLinks[p[3].id], p[2].id)
  blankDay(room)
  host(room, 'next')
  assert.equal(room.phase, 'teen-review')
  host(room, 'teen-check', { playerId: p[0].id, spoken: false })
  host(room, 'reset-night')
  assert.equal(room.round, 1)
  assert.equal(room.phase, 'night')
  assert.equal(p[1].alive, true)
  assert.equal(p[1].revengeTeam, null)
  assert.deepEqual(room.mummyLinks, {})
  assert.deepEqual(room.teenChecks, {})
  assert.deepEqual(room.revengeAttacks, [])
})

test('a clone inheriting Dire Wolf from a linked death also dies immediately', () => {
  const room = setup([
    'werewolf',
    'dire_wolf',
    'doppelganger',
    'villager',
    'villager',
    'villager',
    'villager',
  ])
  const p = players(room)
  night(room, (key) =>
    key === 'dire_wolf'
      ? { targets: [p[3].id] }
      : key === 'doppelganger'
        ? { targets: [p[1].id] }
        : key === 'wolves'
          ? { targets: [p[6].id] }
          : null,
  )
  p[2].used.blessed = true
  execute(room, p[3])
  assert.equal(p[1].alive, false)
  assert.equal(p[2].role, 'dire_wolf')
  assert.equal(p[2].direTarget, p[3].id)
  assert.equal(p[2].alive, false)
  assert.equal(p[2].used.blessed, true)
  assert.equal(new Set(room.deaths).size, room.deaths.length)
})
