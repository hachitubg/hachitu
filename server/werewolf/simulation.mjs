import assert from 'node:assert/strict'
import {
  createRoom,
  addPlayer,
  players,
  command,
  view,
  tick,
  paused,
  validateDeck,
  catalog,
  SUPPORTED,
} from './engine.mjs'
import { DRUNK_ROLES } from './basic-guides.mjs'

const roles = catalog.filter((r) => r.enabled)
const roleById = new Map(roles.map((r) => [r.id, r]))
const wolfIds = new Set([
  'werewolf',
  'wolf_man',
  'wolf_cub',
  'lone_wolf',
  'big_bad_wolf',
  'dire_wolf',
  'fruit_brute',
  'fang_face',
  'dream_wolf',
  'teenage_werewolf',
])
export function random(seed) {
  let state = seed >>> 0
  return (max) => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return max ? (state >>> 0) % max : 0
  }
}
export function combinationDeck(keys) {
  const deck = [...keys]
  if (!deck.some((id) => wolfIds.has(id) || id === 'vampire')) deck.push('werewolf')
  if (deck.includes('minion') && !deck.some((id) => wolfIds.has(id))) deck.push('werewolf')
  if (
    deck.some((id) => ['sorceress', 'apprentice_seer', 'beholder'].includes(id)) &&
    !deck.includes('seer')
  )
    deck.push('seer')
  if (deck.filter((id) => id === 'mason').length === 1) deck.push('mason')
  while (deck.length < 9) deck.push('villager')
  validateDeck(deck, deck.length)
  return { deck, hidden: 'villager' }
}
export function randomDeck(seed, count) {
  const next = random(seed)
  for (let attempt = 0; attempt < 500; attempt++) {
    const deck = ['werewolf']
    while (deck.length < count) {
      const candidate = roles[next(roles.length)]
      if (deck.filter((id) => id === candidate.id).length < candidate.quantity)
        deck.push(candidate.id)
    }
    const hidden = DRUNK_ROLES[next(DRUNK_ROLES.length)]
    try {
      validateDeck(deck, count, hidden)
      return { deck, hidden }
    } catch {
      /* Generate another legal physical deck. */
    }
  }
  throw Error(`No legal deck for seed ${seed}, count ${count}`)
}

export function simulate({
  deck,
  hidden = 'villager',
  seed = 1,
  policy = 'active',
  faults = false,
  maxSteps = 1400,
}) {
  const next = random(seed)
  const room = createRoom('Host', 'preset:0')
  const host = room.members[0]
  const trace = []
  const counters = {
    commands: 0,
    phases: {},
    actions: {},
    deaths: {},
    resets: 0,
    disconnects: 0,
    rejected: 0,
    transformed: 0,
  }
  const initialRoles = new Map()
  let previousRevision = 0
  const resetPhases = new Set()
  const disconnected = new Set()
  const actorIndex = (id) => room.members.findIndex((p) => p.id === id)
  function act(p, action, input = {}) {
    const log = { actor: actorIndex(p.id), action, phase: room.phase, round: room.round }
    if (input.targets) log.targets = input.targets.map(actorIndex)
    if (input.vote !== undefined)
      log.vote = typeof input.vote === 'string' ? actorIndex(input.vote) : input.vote
    trace.push(log)
    if (trace.length > 80) trace.shift()
    command(room, p, action, { revision: room.revision, ...input })
    counters.commands++
  }
  function rejected(p, action, input = {}) {
    const before = JSON.stringify(room)
    assert.throws(() => command(room, p, action, { revision: room.revision, ...input }))
    assert.equal(JSON.stringify(room), before, `Rejected ${action} mutated room`)
    counters.rejected++
  }
  function invariants() {
    assert.ok(room.revision >= previousRevision, 'Revision moved backwards')
    previousRevision = room.revision
    assert.equal(new Set(room.members.map((p) => p.id)).size, room.members.length)
    assert.equal(new Set(room.deaths).size, room.deaths.length, 'Duplicate deaths')
    assert.ok(!room.deadline || ['countdown', 'dawn'].includes(room.phase))
    assert.ok(room.history.length <= 1, 'A game was scored twice')
    for (const p of players(room)) {
      assert.ok(SUPPORTED.includes(p.role))
      assert.equal(
        p.wins + p.losses,
        room.phase === 'ended' && !['aborted', 'manual'].includes(room.winner) ? 1 : 0,
      )
      if (initialRoles.get(p.id) !== p.role) counters.transformed++
      initialRoles.set(p.id, p.role)
      if (p.alive && p.role === 'dire_wolf' && p.direTarget)
        assert.ok(
          room.members.find((target) => target.id === p.direTarget)?.alive,
          'A living Dire Wolf is linked to someone already dead',
        )
      if (!p.alive && p.role === 'hunter' && !p.used.hunter)
        assert.ok(
          room.pendingHunters.includes(p.id) ||
            (room.phase === 'death-action' && room.turn?.actors.includes(p.id)),
          'A dead Hunter lost the final shot',
        )
    }
    if (room.lovers?.length === 2)
      assert.equal(
        room.members.find((p) => p.id === room.lovers[0]).alive,
        room.members.find((p) => p.id === room.lovers[1]).alive,
        'Lovers death chain was not resolved',
      )
    const sample = players(room)[next(deck.length)]
    for (const p of [host, sample]) {
      const state = view(room, p)
      assert.ok(!Object.hasOwn(state, 'nightCheckpoint'))
      assert.ok(state.members.every((member) => !Object.hasOwn(member, 'token')))
      if (!p.host && room.phase !== 'ended') {
        assert.ok(
          state.members.every(
            (member) =>
              member.role === (room.members.find((x) => x.id === member.id).publicRole || null),
          ),
          'Private role leaked',
        )
        assert.deepEqual(state.logs, [])
        assert.deepEqual(state.history, [])
        assert.deepEqual(state.teenChecks, [])
        if (!state.action || !['wolves', 'vampires'].includes(state.action.key))
          assert.deepEqual(state.choices, [])
      }
    }
    if (room.turn && ['night', 'death-action', 'martyr'].includes(room.phase)) {
      assert.ok(room.turn.actors.length > 0)
      for (const id of room.turn.actors) {
        const p = room.members.find((member) => member.id === id)
        assert.ok(p && (p.alive || ['hunter', 'ghost', 'bloody_mary'].includes(room.turn.key)))
        assert.ok(view(room, p).action)
      }
      assert.ok(Object.keys(room.decisions).every((id) => room.turn.actors.includes(id)))
    }
  }
  function inputFor(p, shared) {
    const spec = view(room, p).action
    counters.actions[spec.key] = (counters.actions[spec.key] || 0) + 1
    if (shared) return { targets: shared }
    if (spec.kind === 'activate')
      return { targets: [], activate: policy !== 'passive' && next(3) !== 0 }
    if (spec.kind === 'letter') return { targets: [], text: policy === 'passive' ? '' : 'Z' }
    if (spec.optional && (policy === 'passive' || (policy === 'chaos' && next(3) === 0)))
      return { targets: [] }
    if (spec.key === 'leprechaun') {
      const ring = room.seatOrder.filter((id) => room.members.find((p) => p.id === id)?.alive)
      const redirects = spec.wolfTargets.flatMap((source) =>
        spec.options
          .filter((target) => {
            const a = ring.indexOf(source),
              b = ring.indexOf(target)
            return a !== b && (Math.abs(a - b) === 1 || Math.abs(a - b) === ring.length - 1)
          })
          .map((target) => ({ source, target })),
      )
      const choice = redirects[next(redirects.length)]
      return choice ? { targets: [choice.target], redirectFrom: choice.source } : { targets: [] }
    }
    const options = [...spec.options]
    const paired = options.filter((id) => actorIndex(id) > 0 && actorIndex(id) <= 3)
    const chosen = []
    const count = spec.optional ? Math.min(1, spec.max) : spec.min
    for (let i = 0; i < count; i++) {
      const pool = i === 0 && paired.length && policy === 'active' ? paired : options
      const target = pool[next(pool.length)]
      chosen.push(target)
      options.splice(options.indexOf(target), 1)
    }
    const decision = { targets: chosen }
    if (spec.key === 'witch' && !spec.used.heal && spec.wolfTargets.length && next(2) === 0) {
      decision.save = true
      decision.saveTarget = spec.wolfTargets[next(spec.wolfTargets.length)]
    }
    return decision
  }
  try {
    deck.forEach((_, i) => addPlayer(room, `P${i}`, `preset:${i % 16}`))
    players(room).forEach((p) => act(p, 'ready'))
    act(host, 'deck', { deck, drunkRole: hidden })
    act(host, 'start')
    // Replace only the random shuffle so a failing seed is reproducible.
    players(room).forEach((p, i) =>
      Object.assign(p, {
        role: deck[i],
        originalRole: deck[i],
        hiddenRole: deck[i] === 'drunk' ? hidden : null,
      }),
    )
    players(room).forEach((p) => initialRoles.set(p.id, p.role))
    const countBefore = room.revision
    assert.equal(tick(room, room.deadline - 1), false)
    assert.equal(room.revision, countBefore)
    tick(room, room.deadline)
    players(room).forEach((p) => act(p, 'seen'))
    for (let step = 0; step < maxSteps && room.phase !== 'ended'; step++) {
      counters.phases[room.phase] = (counters.phases[room.phase] || 0) + 1
      invariants()
      if (
        faults &&
        room.nightCheckpoint &&
        !resetPhases.has(room.phase) &&
        ['dawn', 'martyr', 'teen-review', 'verdict'].includes(room.phase)
      ) {
        resetPhases.add(room.phase)
        const baseline = structuredClone(room.nightCheckpoint)
        const restoredRound = baseline.round + 1
        rejected(players(room)[0], 'reset-night')
        act(host, 'reset-night')
        assert.equal(room.round, restoredRound)
        assert.ok(
          players(room).every((p) => p.alive === baseline.members.find((x) => x.id === p.id).alive),
        )
        assert.deepEqual(room.decisions, {})
        assert.deepEqual(room.votes, {})
        assert.equal(room.history.length, 0)
        counters.resets++
        continue
      }
      if (faults && room.turn && !disconnected.has(room.turn.key)) {
        disconnected.add(room.turn.key)
        const actor = room.members.find((p) => p.id === room.turn.actors[0])
        actor.connected = false
        assert.equal(paused(room), true)
        rejected(host, 'next')
        actor.connected = true
        assert.equal(paused(room), false)
        counters.disconnects++
      }
      if (faults && step % 17 === 0) {
        rejected(host, 'next', { revision: room.revision - 1 })
        rejected(players(room)[0], 'next')
      }
      if (['night', 'death-action', 'martyr'].includes(room.phase) && room.turn) {
        const actors = room.turn.actors.map((id) => room.members.find((p) => p.id === id))
        const spec = view(room, actors[0]).action
        let shared
        if (['wolves', 'vampires'].includes(spec.key)) {
          if (spec.adjacentPair && spec.pairs.length && policy !== 'passive' && next(2) === 0)
            shared = spec.pairs[next(spec.pairs.length)]
          else {
            const choices = [...spec.options]
            shared = []
            for (let i = 0; i < spec.min; i++)
              shared.push(choices.splice(next(choices.length), 1)[0])
          }
        }
        const decisions = actors.map((p) => inputFor(p, shared))
        actors.forEach((p, i) => act(p, 'draft', decisions[i]))
        actors.forEach((p, i) => act(p, 'confirm', decisions[i]))
        if (faults) rejected(actors[0], 'confirm', decisions[0])
        act(host, 'next')
      } else if (room.phase === 'dawn') {
        assert.equal(tick(room, room.deadline - 1), false)
        tick(room, room.deadline)
      } else if (room.phase === 'teen-review') {
        view(room, host).teenChecks.forEach((check) =>
          act(host, 'teen-check', {
            playerId: check.id,
            spoken: policy === 'passive' || next(4) !== 0,
          }),
        )
        act(host, 'next')
      } else if (['nominate', 'verdict'].includes(room.phase)) {
        const nominee = room.eligible[next(room.eligible.length)] || null
        for (const voter of players(room).filter((p) => view(room, p).canVote)) {
          const vote =
            room.phase === 'nominate'
              ? policy === 'passive' && room.round === 1
                ? null
                : policy === 'chaos' && room.round < 12 && next(3) === 0
                  ? room.eligible[next(room.eligible.length)] || null
                  : nominee
              : voter.role === 'pacifist'
                ? false
                : voter.role === 'village_idiot'
                  ? true
                  : policy === 'chaos' && room.round < 12
                    ? next(4) !== 0
                    : true
          act(voter, 'vote', { vote })
          if (faults && voter === players(room).find((p) => view(room, p).canVote))
            rejected(voter, 'vote', { vote })
        }
        act(host, 'next')
      } else act(host, 'next')
    }
    invariants()
    assert.equal(
      room.phase,
      'ended',
      'Simulation exceeded bound; inspect whether a legal stalemate or stuck phase',
    )
    assert.equal(room.history.length, 1)
    for (const p of players(room))
      if (!p.alive) counters.deaths[p.deathReason] = (counters.deaths[p.deathReason] || 0) + 1
    return {
      seed,
      policy,
      players: deck.length,
      rounds: room.round,
      winner: room.winner,
      ...counters,
    }
  } catch (error) {
    error.scenario = {
      deck,
      hidden,
      seed,
      policy,
      faults,
      phase: room.phase,
      round: room.round,
      turn: room.turn?.key,
      trace,
    }
    throw error
  }
}

export function combinations(size) {
  const ids = roles.map((r) => r.id).sort()
  const result = []
  function add(start, selected) {
    if (selected.length === size) {
      result.push([...selected])
      return
    }
    for (let i = start; i < ids.length; i++) {
      if (selected.filter((id) => id === ids[i]).length < roleById.get(ids[i]).quantity)
        add(i, [...selected, ids[i]])
    }
  }
  add(0, [])
  return result
}
