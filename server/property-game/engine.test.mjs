import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoom, addPlayer, command, view, current, rent, netWorth } from './engine.mjs'
import { BOARD, CARDS } from './board.mjs'
import {
  defaultCharacter,
  validateCharacter,
  characterKey,
  randomCharacter,
} from '../../src/views/co-ty-phu/character-config.mjs'

test('character validation rejects forged fields/ranges and canonicalizes hidden color differences', () => {
  assert.deepEqual(validateCharacter(defaultCharacter), defaultCharacter)
  for (const invalid of [
    null,
    {},
    { ...defaultCharacter, skin: -1 },
    { ...defaultCharacter, hairStyle: 11 },
    { ...defaultCharacter, shirt: 0.5 },
    { ...defaultCharacter, customShirt: 'url(x)' },
  ])
    assert.throws(() => validateCharacter(invalid))
  assert.equal(
    characterKey({ ...defaultCharacter, hairStyle: 3, hair: 0 }),
    characterKey({ ...defaultCharacter, hairStyle: 3, hair: 5 }),
  )
  assert.equal(
    characterKey({ ...defaultCharacter, accessory: 0, accessoryColor: 0 }),
    characterKey({ ...defaultCharacter, accessory: 0, accessoryColor: 5 }),
  )
  for (let n = 0; n < 100; n++) {
    const c = randomCharacter()
    assert.deepEqual(validateCharacter(c), c)
  }
})

test('lobby rejects duplicate characters, editing resets readiness, play/rematch preserve appearance', () => {
  const r = createRoom('An', 'car', Date.now(), defaultCharacter)
  const before = structuredClone(r)
  assert.throws(
    () => addPlayer(r, 'Bình', 'cat', defaultCharacter),
    (e) => e.code === 'CHARACTER_TAKEN',
  )
  assert.deepEqual(r, before)
  const second = { ...defaultCharacter, shirt: 1 }
  addPlayer(r, 'Bình', 'cat', second)
  r.players.forEach((p) => {
    p.ready = true
  })
  const updated = { ...defaultCharacter, hairStyle: 5, shirt: 3 }
  act(r, 'character', { character: updated }, r.hostId)
  assert.equal(r.players[0].ready, false)
  assert.deepEqual(r.players[0].character, updated)
  assert.throws(
    () => act(r, 'character', { character: second }, r.hostId),
    (e) => e.code === 'CHARACTER_TAKEN',
  )
  r.players.forEach((p) => {
    p.ready = true
  })
  act(r, 'start')
  assert.deepEqual(view(r, r.hostId).players[0].character, updated)
  assert.throws(() => act(r, 'character', { character: defaultCharacter }, r.hostId))
  act(r, 'surrender')
  act(r, 'rematch', {}, r.hostId)
  assert.deepEqual(r.players[0].character, updated)
  assert.deepEqual(r.players[1].character, second)
})

function setup(count = 3) {
  const room = createRoom('Chủ bàn', 'car')
  for (let i = 1; i < count; i++) addPlayer(room, `Bạn ${i}`, 'cat')
  room.players.forEach((p) => {
    p.ready = true
  })
  command(room, room.hostId, 'start', { revision: room.revision }, Date.now(), () => 0)
  return room
}
function act(r, action, input = {}, who = current(r).id, rng = () => 0) {
  command(r, who, action, { revision: r.revision, ...input }, Date.now(), rng)
}
function dice(a, b) {
  const values = [a - 1, b - 1]
  return () => values.shift() ?? 0
}
function asset(r, id, owner = current(r).id) {
  const a = r.properties.find((p) => p.id === id)
  a.owner = owner
  return a
}
function invariant(r) {
  assert.equal(r.properties.length, 28)
  for (const p of r.players) {
    assert.ok(Number.isSafeInteger(p.cash) && p.cash >= 0)
    assert.ok(p.position >= 0 && p.position < 40)
  }
  for (const a of r.properties) {
    assert.ok(a.level >= 0 && a.level <= 5)
    assert.ok(!a.mortgaged || !a.level)
    assert.ok(!a.owner || r.players.some((p) => p.id === a.owner && !p.bankrupt))
  }
  assert.equal(r.houses + r.properties.reduce((s, a) => s + (a.level < 5 ? a.level : 0), 0), 32)
  assert.equal(r.hotels + r.properties.filter((a) => a.level === 5).length, 12)
  if (r.phase === 'auction')
    assert.ok(r.players.some((p) => p.id === r.auction.actor && !p.bankrupt))
}

test('classic board: 40 spaces, 28 deeds, 16 cards in each deck, groups and economic data', () => {
  assert.equal(BOARD.length, 40)
  assert.equal(BOARD.filter((t) => t.price).length, 28)
  for (const cards of Object.values(CARDS)) assert.equal(cards.length, 16)
  for (const t of BOARD.filter((t) => t.kind === 'street')) {
    assert.equal(t.rents.length, 6)
    assert.ok(t.rents.every((v) => v > 0))
    assert.ok(t.houseCost)
  }
})

test('all 28 mortgage redemptions charge exact principal plus rounded 10 percent, without float overcharge', () => {
  for (const tile of BOARD.filter((t) => t.price)) {
    const r = setup()
    asset(r, tile.id)
    const before = current(r).cash
    act(r, 'mortgage', { tileId: tile.id })
    assert.equal(current(r).cash, before + tile.price / 2)
    act(r, 'redeem', { tileId: tile.id })
    const interest = Math.ceil(tile.price / 20)
    assert.equal(current(r).cash, before - interest, tile.name)
  }
})
test('room validation, readiness and configuration preserve rejected state', () => {
  const r = createRoom('A', 'car')
  assert.throws(() => addPlayer(r, 'a', 'cat'))
  addPlayer(r, 'B', 'cat')
  const before = structuredClone(r)
  assert.throws(() => act(r, 'start'))
  assert.deepEqual(r, before)
  act(r, 'settings', { startingCash: 2000, timeLimit: 30, doubleGo: false, parkingPot: true })
  r.players.forEach((p) => {
    p.ready = true
  })
  act(r, 'start')
  assert.equal(current(r).cash, 2000)
  assert.equal(r.settings.timeLimit, 30)
  assert.throws(() => addPlayer(r, 'C', 'cat'))
})
test('roll purchase, rent and exact GO award only one standard salary', () => {
  const r = setup()
  act(r, 'roll', {}, current(r).id, dice(1, 2))
  assert.equal(r.phase, 'buy')
  assert.equal(current(r).position, 3)
  act(r, 'buy')
  assert.equal(current(r).cash, 1440)
  assert.equal(r.phase, 'end')
  const owner = current(r).id
  act(r, 'end')
  act(r, 'roll', {}, current(r).id, dice(1, 2))
  assert.equal(current(r).cash, 1496)
  assert.equal(r.players.find((p) => p.id === owner).cash, 1444)
  current(r).position = 37
  r.phase = 'roll'
  const cash = current(r).cash
  act(r, 'roll', {}, current(r).id, dice(1, 2))
  assert.equal(current(r).position, 0)
  assert.equal(current(r).cash, cash + 200)
})
test('rent doubles only on undeveloped monopolies; stations and utility holdings include mortgaged sister deeds', () => {
  const r = setup()
  asset(r, 1)
  asset(r, 3).mortgaged = true
  assert.equal(rent(r, 1), 4)
  assert.equal(rent(r, 3), 0)
  asset(r, 5)
  asset(r, 15).mortgaged = true
  assert.equal(rent(r, 5), 50)
  assert.equal(rent(r, 5, 7, 'station'), 100)
  asset(r, 12)
  assert.equal(rent(r, 12, 8), 32)
  asset(r, 28).mortgaged = true
  assert.equal(rent(r, 12, 8), 80)
})
test('three consecutive doubles jail immediately without GO salary; release doubles give no extra roll', () => {
  const r = setup()
  asset(r, 6)
  asset(r, 12)
  act(r, 'roll', {}, current(r).id, dice(3, 3))
  assert.equal(r.phase, 'roll')
  act(r, 'roll', {}, current(r).id, dice(3, 3))
  assert.equal(r.phase, 'roll')
  current(r).position = 39
  const cash = current(r).cash
  act(r, 'roll', {}, current(r).id, dice(3, 3))
  assert.equal(current(r).jail, true)
  assert.equal(current(r).cash, cash)
  r.phase = 'roll'
  asset(r, 16)
  act(r, 'roll', {}, current(r).id, dice(3, 3))
  assert.equal(current(r).jail, false)
  assert.equal(r.phase, 'end')
})
test('third failed jail attempt enters debt, then moves after mortgage without double-charging bail', () => {
  const r = setup()
  current(r).cash = 10
  current(r).jail = true
  current(r).position = 10
  current(r).jailTurns = 2
  asset(r, 1)
  asset(r, 3)
  asset(r, 13)
  act(r, 'roll', {}, current(r).id, dice(1, 2))
  assert.equal(r.phase, 'debt')
  assert.equal(current(r).position, 10)
  act(r, 'mortgage', { tileId: 1 })
  assert.equal(r.phase, 'debt')
  act(r, 'mortgage', { tileId: 3 })
  assert.equal(current(r).position, 13)
  assert.equal(current(r).cash, 20)
  assert.equal(r.phase, 'end')
})
test('auctions include declining buyer, cannot overbid cash and settle to highest bidder', () => {
  const r = setup()
  current(r).position = 1
  r.phase = 'buy'
  act(r, 'auction')
  const first = r.auction.actor
  act(r, 'bid', { amount: 5 }, first)
  const second = r.auction.actor
  const before = structuredClone(r)
  assert.throws(() => act(r, 'bid', { amount: 99999 }, second))
  assert.deepEqual(r, before)
  act(r, 'bid', { amount: 10 }, second)
  while (r.auction) act(r, 'pass', {}, r.auction.actor)
  assert.equal(r.properties.find((a) => a.id === 1).owner, second)
  assert.equal(r.players.find((p) => p.id === second).cash, 1490)
})
test('no bidders leaves property unowned; one last bidder must place a bid', () => {
  const r = setup(2)
  r.phase = 'buy'
  current(r).position = 1
  act(r, 'auction')
  act(r, 'pass', {}, r.auction.actor)
  assert.equal(r.phase, 'auction')
  act(r, 'pass', {}, r.auction.actor)
  assert.equal(r.phase, 'end')
  assert.equal(r.properties.find((a) => a.id === 1).owner, null)
})
test('build/sell evenly, mortgage blocks improvements, hotels return 4 houses and supply conserved', () => {
  const r = setup()
  asset(r, 1)
  asset(r, 3)
  current(r).cash = 5000
  act(r, 'build', { tileId: 1 })
  assert.throws(() => act(r, 'build', { tileId: 1 }))
  assert.throws(() => act(r, 'mortgage', { tileId: 3 }))
  for (let i = 0; i < 7; i++) act(r, 'build', { tileId: i % 2 === 0 ? 3 : 1 })
  assert.equal(r.houses, 24)
  act(r, 'build', { tileId: 1 })
  assert.equal(r.hotels, 11)
  assert.equal(r.houses, 28)
  assert.throws(() => act(r, 'sell', { tileId: 3 }))
  act(r, 'sell', { tileId: 1 })
  invariant(r)
  act(r, 'sell-group', { tileId: 1 })
  assert.equal(r.houses, 32)
  assert.equal(r.hotels, 12)
  act(r, 'mortgage', { tileId: 3 })
  assert.throws(() => act(r, 'build', { tileId: 1 }))
  const cash = current(r).cash
  act(r, 'redeem', { tileId: 3 })
  assert.equal(current(r).cash, cash - 33)
})
test('house shortage rejects builds and permits full-group hotel liquidation', () => {
  const r = setup()
  current(r).cash = 9999
  const a = asset(r, 1),
    b = asset(r, 3)
  a.level = 5
  b.level = 5
  r.hotels = 10
  r.houses = 0
  assert.throws(() => act(r, 'sell', { tileId: 1 }))
  act(r, 'sell-group', { tileId: 1 })
  assert.equal(r.hotels, 12)
  assert.throws(() => act(r, 'build', { tileId: 1 }))
})
test('trade is atomic, requires both participants, pays interest, and rejects improved groups', () => {
  const r = setup()
  const to = r.players[1]
  asset(r, 1).mortgaged = true
  asset(r, 6, to.id)
  act(r, 'trade', { to: to.id, give: [1], take: [6], giveCash: 50, receiveCash: 0 })
  assert.throws(() => act(r, 'trade-reply', { accept: true }, r.players[2].id))
  act(r, 'trade-reply', { accept: true }, to.id)
  assert.equal(r.players[0].cash, 1450)
  assert.equal(r.players[1].cash, 1547)
  assert.equal(r.properties.find((a) => a.id === 1).owner, to.id)
  assert.equal(r.properties.find((a) => a.id === 1).mortgaged, true)
  asset(r, 8).level = 1
  assert.throws(() =>
    act(r, 'trade', { to: to.id, give: [6], take: [], giveCash: 0, receiveCash: 1 }),
  )
})
test('unaffordable trade leaves original balances/ownership intact and can be cancelled', () => {
  const r = setup()
  const p = r.players[1]
  asset(r, 1)
  act(r, 'trade', { to: p.id, give: [1], take: [], giveCash: 0, receiveCash: 5000 })
  const before = structuredClone(r)
  assert.throws(() => act(r, 'trade-reply', { accept: true }, p.id))
  assert.deepEqual(r, before)
  act(r, 'cancel-trade', {}, p.id)
  assert.equal(r.trade, null)
})
test('creditor bankruptcy transfers assets, liquidates buildings and charges inherited mortgage interest', () => {
  const r = setup()
  const debtor = r.players[0],
    creditor = r.players[1]
  debtor.cash = 5
  asset(r, 1)
  asset(r, 3).mortgaged = true
  asset(r, 6).level = 1
  r.houses = 31
  r.phase = 'debt'
  r.effects = [{ from: debtor.id, to: creditor.id, amount: 10000, reason: 'thuê' }]
  act(r, 'bankrupt')
  assert.equal(r.players[0].bankrupt, true)
  assert.equal(r.players[1].cash, 1527)
  assert.equal(r.properties.find((a) => a.id === 3).owner, creditor.id)
  assert.equal(r.properties.find((a) => a.id === 6).level, 0)
  invariant(r)
})
test('bank bankruptcy queues every returned deed for auction then advances past eliminated current player', () => {
  const r = setup()
  asset(r, 1).mortgaged = true
  asset(r, 3)
  r.players[0].cash = 0
  r.phase = 'debt'
  r.effects = [{ from: r.players[0].id, to: null, amount: 200, reason: 'thuế' }]
  act(r, 'bankrupt')
  let auctions = 0
  while (r.auction) {
    const id = r.auction.tileId
    assert.equal(r.properties.find((a) => a.id === id).mortgaged, false)
    while (r.auction?.tileId === id) act(r, 'pass', {}, r.auction.actor)
    auctions++
  }
  assert.equal(auctions, 2)
  assert.equal(r.turn, 1)
  assert.equal(r.phase, 'roll')
  invariant(r)
})
test('birthday debt belongs to another player and bankruptcy does not skip the current player', () => {
  const r = setup()
  r.decks.chest = [9, 0] // direct effects isolate birthday payment sequencing
  r.effects = [{ from: r.players[1].id, to: r.players[0].id, amount: 10, reason: 'sinh nhật' }]
  r.phase = 'debt'
  r.players[1].cash = 0
  act(r, 'bankrupt', {}, r.players[1].id)
  assert.equal(r.turn, 0)
  assert.equal(r.phase, 'end')
})
test('GO jail cards, nearest station and utility special rent, back three draws chest', () => {
  const r = setup()
  r.decks.chance = [4]
  asset(r, 15, r.players[1].id)
  current(r).position = 4
  act(r, 'roll', {}, current(r).id, dice(1, 2))
  assert.equal(current(r).position, 15)
  assert.equal(current(r).cash, 1450)
  r.phase = 'roll'
  current(r).position = 19
  r.decks.chance = [6]
  asset(r, 28, r.players[1].id)
  const seq = [0, 1, 2, 3]
  act(r, 'roll', {}, current(r).id, () => seq.shift() ?? 0)
  assert.equal(current(r).position, 28)
  assert.equal(current(r).cash, 1380)
  r.phase = 'roll'
  current(r).position = 33
  r.decks.chance = [9]
  r.decks.chest = [1]
  act(r, 'roll', {}, current(r).id, dice(1, 2))
  assert.equal(current(r).position, 33)
  assert.equal(current(r).cash, 1580)
})
test('held jail card leaves deck and returns only when used; public views hide secrets and deck order', () => {
  const r = setup()
  r.decks.chance = [8, 0]
  current(r).position = 4
  act(r, 'roll', {}, current(r).id, dice(1, 2))
  assert.equal(current(r).jailCards.length, 1)
  assert.ok(!r.decks.chance.includes(8))
  const v = view(r, current(r).id)
  assert.equal(v.decks, undefined)
  assert.equal(v.players[0].secret, undefined)
  assert.equal(v.players[0].jailCards, 1)
  current(r).jail = true
  r.phase = 'roll'
  act(r, 'jail-card')
  assert.equal(current(r).jailCards.length, 0)
  assert.ok(r.decks.chance.includes(8))
})
test('out-of-turn, stale, forged dice and paused commands cannot mutate table', () => {
  const r = setup()
  const before = structuredClone(r)
  assert.throws(() => act(r, 'roll', {}, r.players[1].id))
  assert.deepEqual(r, before)
  assert.throws(() => act(r, 'roll', { revision: -1 }))
  assert.deepEqual(r, before)
  r.players[1].connected = false
  assert.throws(() => act(r, 'roll'))
  r.players[1].connected = true
  act(r, 'roll', { dice: [6, 6] }, current(r).id, dice(1, 2))
  assert.deepEqual(r.dice, [1, 2])
})
test('last solvent player wins; timed tie and rematch preserve identity but reset assets', () => {
  const r = setup(2)
  const secret = r.players[0].secret
  act(r, 'surrender')
  assert.equal(r.phase, 'ended')
  assert.deepEqual(r.winnerIds, [r.players[1].id])
  act(r, 'rematch', {}, r.hostId)
  assert.equal(r.phase, 'lobby')
  assert.equal(r.players[0].secret, secret)
  assert.ok(r.players.every((p) => !p.bankrupt && !p.ready))
  r.players.forEach((p) => {
    p.ready = true
  })
  act(r, 'start')
  r.phase = 'end'
  r.startedAt = Date.now() - 1800001
  r.settings.timeLimit = 30
  act(r, 'end')
  assert.equal(r.phase, 'ended')
  assert.equal(r.winnerIds.length, 2)
  assert.equal(netWorth(r, r.players[0]), 1500)
})
test('100 deterministic full games preserve balances, inventory and reach a winner', () => {
  for (let seed = 1; seed <= 100; seed++) {
    let n = seed
    const rng = (max) => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0
      return n % max
    }
    const r = setup(2 + (seed % 5))
    r.settings.timeLimit = 30
    for (let step = 0; step < 2200 && r.phase !== 'ended'; step++) {
      invariant(r)
      if (step === 2000) r.startedAt = Date.now() - 1800001
      if (r.phase === 'roll') act(r, 'roll', {}, current(r).id, rng)
      else if (r.phase === 'buy')
        act(
          r,
          current(r).cash >= BOARD[current(r).position].price + 100 ? 'buy' : 'auction',
          {},
          current(r).id,
          rng,
        )
      else if (r.phase === 'auction') act(r, 'pass', {}, r.auction.actor, rng)
      else if (r.phase === 'debt') {
        const p = r.players.find((p) => p.id === r.effects[0].from),
          a = r.properties.find((a) => a.owner === p.id && !a.mortgaged && !a.level)
        act(r, a ? 'mortgage' : 'bankrupt', a ? { tileId: a.id } : {}, p.id, rng)
      } else if (r.phase === 'end') act(r, 'end', {}, current(r).id, rng)
      else assert.fail(r.phase)
    }
    invariant(r)
    assert.equal(r.phase, 'ended', `Seed ${seed}`)
    assert.ok(r.winnerIds.length)
  }
})

test('all 32 card effects resolve without invalid phases or leaking deck order', () => {
  for (const [kind, cards] of Object.entries(CARDS)) {
    for (let index = 0; index < cards.length; index++) {
      const r = setup(3)
      current(r).cash = 5000
      current(r).position = kind === 'chance' ? 4 : 14
      r.decks[kind] = [index, ...cards.map((_, i) => i).filter((i) => i !== index)]
      act(r, 'roll', {}, current(r).id, dice(1, 2))
      assert.ok(['roll', 'end', 'buy', 'debt'].includes(r.phase), `${kind} ${index}: ${r.phase}`)
      invariant(r)
      assert.equal(view(r, current(r).id).decks, undefined)
      assert.ok(r.logs.some((line) => line.includes(cards[index].text)))
    }
  }
})

test('inherited mortgage interest can bankrupt a creditor without falsely declaring victory', () => {
  const r = setup(2),
    first = r.players[0],
    second = r.players[1]
  first.cash = 0
  second.cash = 0
  asset(r, 39).mortgaged = true
  r.effects = [{ from: first.id, to: second.id, amount: 1000, reason: 'thuê' }]
  r.phase = 'debt'
  act(r, 'bankrupt')
  assert.equal(r.phase, 'debt')
  assert.equal(r.effects[0].from, second.id)
  act(r, 'bankrupt', {}, second.id)
  assert.equal(r.phase, 'ended')
  assert.deepEqual(r.winnerIds, [])
})
