import { BOARD } from './board.mjs'
import { current, paused, command, owned } from './engine.mjs'
import { propertyEligibility } from './poorup-adapter.mjs'
import { presentationRemainingMs } from '../../vendor/poorup/public/gamePresentationTiming.js'

const decision = (p, action, input = {}) => ({ id: p.id, action, input })
export function nextBotDecision(room) {
  if (['lobby', 'ended'].includes(room.phase) || paused(room)) return null
  const byId = (id) => room.players.find((p) => p.id === id)
  if (room.trade) {
    const t = room.trade,
      p = byId(t.to)
    if (!p?.isBot) return null
    const value = (ids) =>
      ids.reduce(
        (sum, id) =>
          sum +
          (BOARD[id]?.price || 0) * (room.properties.find((a) => a.id === id)?.mortgaged ? 0.5 : 1),
        0,
      )
    const from = byId(t.from)
    const fee = (ids) =>
      ids.reduce(
        (sum, id) =>
          sum +
          (room.properties.find((a) => a.id === id)?.mortgaged
            ? Math.ceil(BOARD[id].price / 20)
            : 0),
        0,
      )
    const affordable =
      p.cash + t.giveCash - t.receiveCash >= fee(t.give) &&
      from.cash + t.receiveCash - t.giveCash >= fee(t.take)
    return decision(p, 'trade-reply', {
      accept:
        affordable && value(t.give) + t.giveCash >= value(t.take) + t.receiveCash + fee(t.give),
    })
  }
  if (room.phase === 'debt') {
    const p = byId(room.effects[0]?.from)
    if (!p?.isBot) return null
    const properties = owned(room, p.id)
    const sell = properties.find(
      (a) =>
        a.level && propertyEligibility(room, p, a.id).sell && (a.level < 5 || room.houses >= 4),
    )
    if (sell) return decision(p, 'sell', { tileId: sell.id })
    const group = properties.find((a) => a.level)
    if (group) return decision(p, 'sell-group', { tileId: group.id })
    const mortgage = properties
      .filter((a) => propertyEligibility(room, p, a.id).mortgage)
      .sort((a, b) => BOARD[b.id].price - BOARD[a.id].price)[0]
    return mortgage ? decision(p, 'mortgage', { tileId: mortgage.id }) : decision(p, 'bankrupt')
  }
  if (room.auction) {
    const p = byId(room.auction.actor)
    if (!p?.isBot) return null
    const tile = BOARD[room.auction.tileId]
    const cap = Math.min(p.cash, Math.floor(tile.price * 0.9), Math.max(0, p.cash - 80))
    const amount = Math.min(cap, room.auction.high + 10)
    return amount > room.auction.high ? decision(p, 'bid', { amount }) : decision(p, 'pass')
  }
  const p = current(room)
  if (!p?.isBot || p.bankrupt) return null
  if (room.phase === 'buy')
    return decision(p, p.cash >= BOARD[p.position].price + 80 ? 'buy' : 'auction')
  if (['roll', 'end'].includes(room.phase)) {
    const properties = owned(room, p.id)
    const build = properties.find(
      (a) => propertyEligibility(room, p, a.id).build && p.cash >= BOARD[a.id].houseCost + 200,
    )
    if (build) return decision(p, 'build', { tileId: build.id })
    const redeem = properties.find(
      (a) =>
        a.mortgaged && p.cash >= BOARD[a.id].price / 2 + Math.ceil(BOARD[a.id].price / 20) + 250,
    )
    if (redeem) return decision(p, 'redeem', { tileId: redeem.id })
    if (room.phase === 'end') return decision(p, 'end')
    if (p.jailCards.length && p.jail) return decision(p, 'jail-card')
    if (p.jail && p.cash >= 250) return decision(p, 'bail')
    return decision(p, 'roll')
  }
  return null
}

export function createBotDriver({ delay = 750, onError = () => {} } = {}) {
  const pending = new Map()
  return {
    tick(room, now = Date.now()) {
      if (presentationRemainingMs(room, now) > 0) return false
      const d = nextBotDecision(room)
      if (!d) {
        pending.delete(room.code)
        return false
      }
      const item = pending.get(room.code)
      if (!item || item.revision !== room.revision) {
        pending.set(room.code, { revision: room.revision, at: now + delay })
        return false
      }
      if (now < item.at) return false
      pending.delete(room.code)
      try {
        command(room, d.id, d.action, { revision: room.revision, ...d.input }, now)
        return true
      } catch (error) {
        onError(error)
        return false
      }
    },
    forget(code) {
      pending.delete(code)
    },
    clear() {
      pending.clear()
    },
  }
}
