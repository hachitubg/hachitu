import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoom, addPlayer, command, paused } from './engine.mjs'
import { nextBotDecision, createBotDriver } from './bots.mjs'
import { BOARD } from './board.mjs'

function cmd(r, id, action, input = {}, now = Date.now()) {
  command(r, id, action, { revision: r.revision, ...input }, now, () => 0)
}
function table() {
  const r = createRoom('Người chơi', 'car')
  cmd(r, r.hostId, 'add-bot')
  r.players[0].ready = true
  cmd(r, r.hostId, 'start')
  return r
}
test('only host adds machines within six seats; machines ready automatically and persist through rematch', () => {
  const r = createRoom('An', 'car')
  const p = addPlayer(r, 'Bình', 'cat')
  assert.throws(() => cmd(r, p.id, 'add-bot'))
  for (let i = 0; i < 4; i++) cmd(r, r.hostId, 'add-bot')
  assert.equal(r.players.filter((p) => p.isBot && p.ready).length, 4)
  assert.equal(new Set(r.players.map((p) => p.name)).size, 6)
  assert.throws(() => cmd(r, r.hostId, 'add-bot'))
  cmd(r, r.hostId, 'settings', {
    startingCash: 1500,
    timeLimit: 30,
    parkingPot: false,
    doubleGo: false,
  })
  assert.ok(r.players.filter((p) => p.isBot).every((p) => p.ready))
  r.phase = 'ended'
  cmd(r, r.hostId, 'rematch')
  assert.equal(r.players.filter((p) => p.isBot && p.ready).length, 4)
})
test('machine decisions handle buy, auction, jail, trades and debt without acting for a human', () => {
  const r = table(),
    bot = r.players.find((p) => p.isBot)
  r.turn = r.players.indexOf(bot)
  r.phase = 'buy'
  bot.position = 1
  assert.equal(nextBotDecision(r).action, 'buy')
  r.phase = 'auction'
  r.auction = { tileId: 39, high: 200, bidder: null, actor: bot.id, passed: [] }
  assert.equal(nextBotDecision(r).action, 'bid')
  r.auction.high = 1400
  assert.equal(nextBotDecision(r).action, 'pass')
  r.auction = null
  r.phase = 'roll'
  bot.jail = true
  bot.jailCards = [{ kind: 'chance', index: 8 }]
  assert.equal(nextBotDecision(r).action, 'jail-card')
  r.trade = { from: r.hostId, to: bot.id, give: [], take: [], giveCash: 100, receiveCash: 0 }
  assert.equal(nextBotDecision(r).input.accept, true)
  r.trade.receiveCash = 200
  assert.equal(nextBotDecision(r).input.accept, false)
  r.trade = null
  r.phase = 'debt'
  r.effects = [{ from: bot.id, to: null, amount: 200, reason: 'thuế' }]
  bot.cash = 0
  const asset = r.properties.find((a) => a.id === 1)
  asset.owner = bot.id
  assert.equal(nextBotDecision(r).action, 'mortgage')
  asset.mortgaged = true
  assert.equal(nextBotDecision(r).action, 'bankrupt')
  r.turn = 0
  r.phase = 'roll'
  r.effects = []
  assert.equal(nextBotDecision(r), null)
  r.players[0].connected = false
  assert.equal(paused(r), true)
  r.turn = 1
  assert.equal(nextBotDecision(r), null)
})
test('driver honors pause, visible roll timeline and thinking delay', () => {
  const r = table()
  r.turn = 1
  r.phase = 'roll'
  let failures = 0
  const driver = createBotDriver({ delay: 500, onError: () => failures++ })
  r.presentation = { readyAt: 2000 }
  assert.equal(driver.tick(r, 1000), false)
  r.presentation = null
  assert.equal(driver.tick(r, 2100), false)
  assert.equal(driver.tick(r, 2400), false)
  r.expires = 999999999
  assert.equal(driver.tick(r, 2600), true)
  assert.equal(failures, 0)
  assert.ok(r.presentation.readyAt > 2600)
  assert.equal(driver.tick(r, 2700), false)
  driver.clear()
})
test('twenty machine-controlled games make legal progress through bankruptcy and finish', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = createRoom('QA', 'car')
    for (let n = 0; n < 3; n++) cmd(r, r.hostId, 'add-bot')
    r.players.forEach((p) => {
      p.ready = true
      p.isBot = true
    })
    cmd(r, r.hostId, 'start')
    r.settings.timeLimit = 30
    let n = seed
    const rng = (max) => {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0
      return n % max
    }
    let now = Date.now()
    for (let step = 0; step < 4500 && r.phase !== 'ended'; step++) {
      const d = nextBotDecision(r)
      assert.ok(d, `stalled in ${r.phase}`)
      now += 2000
      command(r, d.id, d.action, { revision: r.revision, ...d.input }, now, rng)
      assert.ok(r.players.every((p) => p.cash >= 0))
      assert.equal(r.properties.length, BOARD.filter((t) => t.price).length)
    }
    assert.equal(r.phase, 'ended', `seed ${seed}`)
  }
})
