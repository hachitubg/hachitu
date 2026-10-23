import { randomBytes, randomInt } from 'node:crypto'
import { BOARD, CARDS } from './board.mjs'

const check = (ok, message) => {
  if (!ok) throw Error(message)
}
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max
const live = (room) => room.players.filter((p) => !p.bankrupt)
export const current = (room) => room.players[room.turn]
export const owned = (room, id) => room.properties.filter((p) => p.owner === id)
const group = (room, tile) =>
  room.properties.filter((p) => BOARD[p.id].group === tile.group && tile.group)
const monopoly = (room, player, tile) => group(room, tile).every((p) => p.owner === player.id)
export const paused = (room) =>
  room.phase !== 'lobby' && room.phase !== 'ended' && live(room).some((p) => !p.connected)
const log = (room, message) => {
  room.logs.push(message)
  if (room.logs.length > 150) room.logs.shift()
}
const shuffle = (array, rng) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = rng(i + 1)
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}
export function player(name, token = 'car') {
  check(
    typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 24,
    'Tên cần từ 1 đến 24 ký tự.',
  )
  check(['car', 'cat', 'ship', 'rocket', 'bike', 'crown'].includes(token), 'Quân cờ không hợp lệ.')
  return {
    id: randomBytes(12).toString('hex'),
    secret: randomBytes(24).toString('hex'),
    name: name.trim(),
    token,
    connected: true,
    ready: false,
    cash: 1500,
    position: 0,
    jail: false,
    jailTurns: 0,
    jailCards: [],
    bankrupt: false,
  }
}
export function createRoom(name, token, now = Date.now()) {
  const host = player(name, token)
  return {
    code: randomBytes(3).toString('hex').toUpperCase(),
    hostId: host.id,
    players: [host],
    revision: 0,
    phase: 'lobby',
    turn: 0,
    turnNumber: 0,
    dice: [1, 1],
    doubles: 0,
    again: false,
    properties: BOARD.filter((t) => t.price).map((t) => ({
      id: t.id,
      owner: null,
      level: 0,
      mortgaged: false,
    })),
    settings: { startingCash: 1500, timeLimit: 0, parkingPot: false, doubleGo: false },
    pot: 0,
    houses: 32,
    hotels: 12,
    logs: [],
    effects: [],
    auction: null,
    auctionQueue: [],
    trade: null,
    continuation: null,
    card: null,
    decks: {},
    winnerIds: [],
    expires: now + 86400000,
    startedAt: null,
    pauseAt: null,
    pausedMs: 0,
  }
}
export function addPlayer(room, name, token) {
  check(room.phase === 'lobby', 'Ván đã bắt đầu.')
  check(room.players.length < 6, 'Phòng đã đủ 6 người.')
  const p = player(name, token)
  check(
    !room.players.some((other) => other.name.toLocaleLowerCase() === p.name.toLocaleLowerCase()),
    'Tên này đã có trong phòng.',
  )
  room.players.push(p)
  room.revision++
  room.players.forEach((other) => {
    other.ready = false
  })
  return p
}
export function netWorth(room, p) {
  return (
    p.cash +
    owned(room, p.id).reduce(
      (sum, a) =>
        sum +
        (a.mortgaged ? BOARD[a.id].price / 2 : BOARD[a.id].price) +
        a.level * (BOARD[a.id].houseCost || 0),
      0,
    )
  )
}
export function rent(room, tileId, dice = 7, special = null) {
  const asset = room.properties.find((p) => p.id === tileId),
    tile = BOARD[tileId]
  if (!asset?.owner || asset.mortgaged) return 0
  const owner = room.players.find((p) => p.id === asset.owner)
  if (tile.kind === 'station')
    return (
      25 *
      2 ** (owned(room, owner.id).filter((p) => BOARD[p.id].kind === 'station').length - 1) *
      (special === 'station' ? 2 : 1)
    )
  if (tile.kind === 'utility')
    return (
      dice *
      (special === 'utility' ||
      owned(room, owner.id).filter((p) => BOARD[p.id].kind === 'utility').length === 2
        ? 10
        : 4)
    )
  return tile.rents[asset.level] * (!asset.level && monopoly(room, owner, tile) ? 2 : 1)
}
function finishGame(room, winners, reason) {
  room.phase = 'ended'
  room.winnerIds = winners
  room.auction = null
  room.trade = null
  log(room, reason)
}
function finishTurn(room, now) {
  if (live(room).length <= 1) {
    finishGame(
      room,
      live(room).map((p) => p.id),
      'Ván kết thúc: chỉ còn một người chưa phá sản.',
    )
    return
  }
  if (
    room.settings.timeLimit &&
    now - room.startedAt - room.pausedMs >= room.settings.timeLimit * 60000
  ) {
    const best = Math.max(...live(room).map((p) => netWorth(room, p)))
    finishGame(
      room,
      live(room)
        .filter((p) => netWorth(room, p) === best)
        .map((p) => p.id),
      'Hết thời gian: xếp hạng theo tổng tài sản ròng.',
    )
    return
  }
  do {
    room.turn = (room.turn + 1) % room.players.length
  } while (current(room).bankrupt)
  room.turnNumber++
  room.doubles = 0
  room.again = false
  room.phase = 'roll'
  room.card = null
  log(room, `Lượt ${room.turnNumber}: ${current(room).name}.`)
}
function pay(room, from, to, amount, reason) {
  if (amount > 0) room.effects.push({ from: from.id, to: to?.id || null, amount, reason })
}
function settle(room, now, rng) {
  while (room.effects.length) {
    const e = room.effects[0],
      from = room.players.find((p) => p.id === e.from),
      to = room.players.find((p) => p.id === e.to)
    if (from.bankrupt) {
      room.effects.shift()
      continue
    }
    if (from.cash < e.amount) {
      room.phase = 'debt'
      return
    }
    from.cash -= e.amount
    if (to && !to.bankrupt) to.cash += e.amount
    else if (room.settings.parkingPot && !e.to) room.pot += e.amount
    log(room, `${from.name} trả ${e.amount} cho ${to?.name || 'ngân hàng'}: ${e.reason}.`)
    room.effects.shift()
  }
  if (live(room).length <= 1) {
    finishGame(
      room,
      live(room).map((p) => p.id),
      'Người cuối cùng còn khả năng thanh toán chiến thắng.',
    )
    return
  }
  if (room.auctionQueue.length) {
    openAuction(room, room.auctionQueue.shift())
    return
  }
  const continuation = room.continuation
  room.continuation = null
  if (current(room).bankrupt) {
    finishTurn(room, now)
    return
  }
  if (continuation?.kind === 'move') {
    move(room, current(room), continuation.steps, now, rng)
    return
  }
  if (continuation?.kind === 'roll') {
    room.phase = 'roll'
    return
  }
  room.phase = room.again ? 'roll' : 'end'
}
function jail(room, p) {
  p.position = 10
  p.jail = true
  p.jailTurns = 0
  room.again = false
  room.doubles = 0
  room.phase = 'end'
  log(room, `${p.name} vào nhà tù.`)
}
function move(room, p, steps, now, rng) {
  const target = p.position + steps
  if (steps > 0 && target >= 40) {
    p.cash += 200
    log(room, `${p.name} qua Khởi hành, nhận 200.`)
  }
  p.position = (target + 40) % 40
  if (room.settings.doubleGo && p.position === 0 && steps > 0) p.cash += 200
  land(room, p, now, rng)
}
function draw(room, p, kind, now, rng) {
  const index = room.decks[kind].shift(),
    card = CARDS[kind][index]
  room.card = { kind, text: card.text }
  log(room, `${p.name}: ${card.text}`)
  if (card.jailCard) p.jailCards.push({ kind, index })
  else room.decks[kind].push(index)
  if (card.jail) {
    jail(room, p)
    return
  }
  if (card.move !== undefined) {
    move(room, p, (card.move - p.position + 40) % 40, now, rng)
    return
  }
  if (card.back) {
    move(room, p, -card.back, now, rng)
    return
  }
  if (card.nearest) {
    let steps = 1
    while (BOARD[(p.position + steps) % 40].kind !== card.nearest) steps++
    const target = (p.position + steps) % 40
    if (p.position + steps >= 40) p.cash += 200
    p.position = target
    land(room, p, now, rng, card.nearest)
    return
  }
  if (card.cash > 0) p.cash += card.cash
  if (card.cash < 0) pay(room, p, null, -card.cash, 'thẻ sự kiện')
  if (card.repair) {
    const cost = owned(room, p.id).reduce(
      (s, a) => s + (a.level === 5 ? card.repair[1] : a.level * card.repair[0]),
      0,
    )
    pay(room, p, null, cost, 'sửa chữa')
  }
  if (card.each)
    for (const other of live(room).filter((q) => q.id !== p.id)) {
      if (card.each > 0) pay(room, other, p, card.each, 'quà sinh nhật')
      else pay(room, p, other, -card.each, 'thẻ sự kiện')
    }
  settle(room, now, rng)
}
function land(room, p, now, rng, special = null) {
  const tile = BOARD[p.position]
  log(room, `${p.name} đến ${tile.name}.`)
  if (tile.kind === 'go-jail') {
    jail(room, p)
    return
  }
  if (tile.price) {
    const a = room.properties.find((prop) => prop.id === tile.id)
    if (!a.owner) {
      room.phase = 'buy'
      return
    }
    if (a.owner !== p.id) {
      let dice = room.dice[0] + room.dice[1]
      if (special === 'utility' && !a.mortgaged) {
        const rolled = [rng(6) + 1, rng(6) + 1]
        dice = rolled[0] + rolled[1]
        log(room, `Xúc xắc tính tiền tiện ích: ${rolled.join(' + ')}.`)
      }
      pay(
        room,
        p,
        room.players.find((q) => q.id === a.owner),
        rent(room, tile.id, dice, special),
        `thuê ${tile.name}`,
      )
    }
  } else if (tile.kind === 'tax') pay(room, p, null, tile.amount, tile.name)
  else if (tile.kind === 'chance' || tile.kind === 'chest') {
    draw(room, p, tile.kind, now, rng)
    return
  } else if (tile.kind === 'parking' && room.settings.parkingPot) {
    p.cash += room.pot
    log(room, `${p.name} nhận quỹ Công viên ${room.pot}.`)
    room.pot = 0
  }
  settle(room, now, rng)
}
function openAuction(room, tileId) {
  room.phase = 'auction'
  room.auction = { tileId, high: 0, bidder: null, passed: [], actor: live(room)[0].id }
  log(room, `Đấu giá ${BOARD[tileId].name}. Mọi người đều có quyền tham gia.`)
}
function advanceAuction(room, now, rng) {
  const a = room.auction,
    bidders = live(room).filter((p) => !a.passed.includes(p.id))
  if (!bidders.length || (bidders.length === 1 && a.bidder === bidders[0].id)) {
    if (a.bidder) {
      const winner = room.players.find((p) => p.id === a.bidder)
      winner.cash -= a.high
      room.properties.find((p) => p.id === a.tileId).owner = winner.id
      log(room, `${winner.name} thắng đấu giá ${BOARD[a.tileId].name} với ${a.high}.`)
    } else log(room, 'Không có giá mua. Đất vẫn thuộc ngân hàng.')
    room.auction = null
    settle(room, now, rng)
    return
  }
  let i = room.players.findIndex((p) => p.id === a.actor)
  do {
    i = (i + 1) % room.players.length
  } while (
    room.players[i].bankrupt ||
    a.passed.includes(room.players[i].id) ||
    room.players[i].id === a.bidder
  )
  a.actor = room.players[i].id
}
function removeBuildings(room, asset) {
  if (asset.level === 5) room.hotels++
  else room.houses += asset.level
  const cash = (asset.level * (BOARD[asset.id].houseCost || 0)) / 2
  asset.level = 0
  return cash
}
function bankrupt(room, p, now, rng, surrender = false) {
  const debt = room.effects[0]
  const creditor =
    !surrender && debt?.from === p.id
      ? room.players.find((q) => q.id === debt.to && !q.bankrupt)
      : null
  let interest = 0
  for (const a of owned(room, p.id)) {
    p.cash += removeBuildings(room, a)
    if (creditor) {
      a.owner = creditor.id
      if (a.mortgaged) interest += Math.ceil(BOARD[a.id].price / 20)
    } else {
      a.owner = null
      a.mortgaged = false
      room.auctionQueue.push(a.id)
    }
  }
  if (creditor) {
    creditor.cash += p.cash
    creditor.jailCards.push(...p.jailCards)
  } else for (const c of p.jailCards) room.decks[c.kind].push(c.index)
  p.cash = 0
  p.jailCards = []
  p.bankrupt = true
  room.trade = null
  room.effects = room.effects.filter((e) => e.from !== p.id && e.to !== p.id)
  if (interest)
    room.effects.unshift({
      from: creditor.id,
      to: null,
      amount: interest,
      reason: 'lãi nhận tài sản thế chấp',
    })
  log(
    room,
    `${p.name} ${surrender ? 'bỏ cuộc' : 'phá sản'}${creditor ? `; tài sản chuyển cho ${creditor.name}` : '; đất được đưa ra đấu giá'}.`,
  )
  settle(room, now, rng)
}
function manage(room, actor, action, id) {
  const a = room.properties.find((p) => p.id === id),
    tile = BOARD[id]
  check(a && a.owner === actor.id, 'Đây không phải tài sản của bạn.')
  const siblings = group(room, tile)
  if (action === 'mortgage') {
    check(
      !a.mortgaged && !siblings.some((p) => p.level),
      'Bán hết nhà trong nhóm trước khi thế chấp.',
    )
    a.mortgaged = true
    actor.cash += tile.price / 2
  } else if (action === 'redeem') {
    const amount = tile.price / 2 + Math.ceil(tile.price / 20)
    check(a.mortgaged && actor.cash >= amount, `Cần ${amount} để chuộc.`)
    actor.cash -= amount
    a.mortgaged = false
  } else if (action === 'build') {
    check(tile.kind === 'street' && monopoly(room, actor, tile), 'Cần sở hữu đủ nhóm màu.')
    check(!siblings.some((p) => p.mortgaged), 'Nhóm màu có đất thế chấp.')
    check(
      a.level < 5 && a.level === Math.min(...siblings.map((p) => p.level)),
      'Phải xây đều trong nhóm, tối đa một khách sạn.',
    )
    check(actor.cash >= tile.houseCost, 'Không đủ tiền xây.')
    check(
      a.level === 4 ? room.hotels > 0 : room.houses > 0,
      'Ngân hàng đã hết loại công trình này.',
    )
    if (a.level === 4) {
      room.hotels--
      room.houses += 4
    } else room.houses--
    a.level++
    actor.cash -= tile.houseCost
  } else if (action === 'sell') {
    check(
      a.level > 0 && a.level === Math.max(...siblings.map((p) => p.level)),
      'Bán nhà đều, từ đất có nhiều nhà nhất.',
    )
    check(
      a.level !== 5 || room.houses >= 4,
      'Không đủ 4 nhà để hạ khách sạn. Có thể bán toàn bộ công trình của nhóm.',
    )
    if (a.level === 5) {
      room.hotels++
      room.houses -= 4
    } else room.houses++
    a.level--
    actor.cash += tile.houseCost / 2
  } else if (action === 'sell-group') {
    check(tile.kind === 'street' && siblings.some((p) => p.level), 'Nhóm chưa có công trình.')
    for (const s of siblings) actor.cash += removeBuildings(room, s)
  }
  log(
    room,
    `${actor.name}: ${{ mortgage: 'thế chấp', redeem: 'chuộc', build: 'xây', sell: 'bán công trình tại', 'sell-group': 'bán toàn bộ công trình nhóm' }[action]} ${tile.name}.`,
  )
}
function transferCheck(room, id, ids) {
  check(
    Array.isArray(ids) && ids.length <= 28 && new Set(ids).size === ids.length,
    'Danh sách trao đổi không hợp lệ.',
  )
  return ids.map((tileId) => {
    const a = room.properties.find((p) => p.id === tileId)
    check(
      a && a.owner === id && !group(room, BOARD[tileId]).some((p) => p.level),
      'Chỉ trao đổi đất của mình và nhóm chưa có công trình.',
    )
    return a
  })
}
function apply(room, actor, action, input, now, rng) {
  check(room.expires > now, 'Phòng đã hết hạn sau 24 giờ.')
  check(actor && room.players.includes(actor), 'Phiên chơi không hợp lệ.')
  check(input.revision === room.revision, 'Bàn cờ vừa thay đổi. Hãy thao tác lại.')
  if (action === 'ready') {
    check(room.phase === 'lobby', 'Ván đã bắt đầu.')
    actor.ready = !actor.ready
    return
  }
  if (action === 'settings') {
    check(room.phase === 'lobby' && room.hostId === actor.id, 'Chỉ chủ phòng được chỉnh trước ván.')
    check(
      [1000, 1500, 2000, 2500].includes(input.startingCash) &&
        [0, 30, 60, 90].includes(input.timeLimit),
      'Cấu hình không hợp lệ.',
    )
    check(
      typeof input.parkingPot === 'boolean' && typeof input.doubleGo === 'boolean',
      'Cấu hình không hợp lệ.',
    )
    room.settings = {
      startingCash: input.startingCash,
      timeLimit: input.timeLimit,
      parkingPot: input.parkingPot,
      doubleGo: input.doubleGo,
    }
    room.players.forEach((p) => {
      p.ready = false
    })
    return
  }
  if (action === 'start') {
    check(
      room.phase === 'lobby' && room.hostId === actor.id && room.players.length >= 2,
      'Cần chủ phòng và ít nhất 2 người.',
    )
    check(
      room.players.every((p) => p.connected && p.ready),
      'Mọi người cần kết nối và sẵn sàng.',
    )
    room.players.forEach((p) => {
      p.cash = room.settings.startingCash
    })
    room.decks = Object.fromEntries(
      Object.entries(CARDS).map(([k, cards]) => [
        k,
        shuffle(
          cards.map((_, i) => i),
          rng,
        ),
      ]),
    )
    room.turn = rng(room.players.length)
    room.turnNumber = 1
    room.phase = 'roll'
    room.startedAt = now
    log(room, `Bắt đầu! ${current(room).name} đi trước (bốc thăm ngẫu nhiên).`)
    return
  }
  if (action === 'rematch') {
    check(
      room.phase === 'ended' && actor.id === room.hostId,
      'Chủ phòng mở ván mới khi ván cũ kết thúc.',
    )
    const old = room.players,
      settings = room.settings,
      code = room.code,
      revision = room.revision,
      expires = room.expires,
      hostId = room.hostId
    Object.assign(room, createRoom(actor.name, actor.token, now), {
      players: old.map((p) => ({
        ...player(p.name, p.token),
        id: p.id,
        secret: p.secret,
        connected: p.connected,
      })),
      settings,
      code,
      revision,
      expires,
      hostId,
    })
    return
  }
  check(
    !['lobby', 'ended'].includes(room.phase) && !actor.bankrupt,
    'Bạn không có lượt trong ván đang chơi.',
  )
  if (action === 'cancel-trade') {
    check(
      room.trade && [room.trade.from, room.trade.to].includes(actor.id),
      'Bạn không tham gia đề nghị này.',
    )
    room.trade = null
    return
  }
  check(!paused(room), 'Ván tạm dừng chờ người mất kết nối quay lại.')
  const debtActor = room.effects[0]?.from
  if (action === 'trade-reply') {
    const offer = room.trade
    check(
      offer && actor.id === offer.to && typeof input.accept === 'boolean',
      'Đề nghị không hợp lệ.',
    )
    if (input.accept) {
      const from = room.players.find((p) => p.id === offer.from),
        to = actor
      const give = transferCheck(room, from.id, offer.give),
        take = transferCheck(room, to.id, offer.take)
      const fromFee = take.reduce(
        (s, a) => s + (a.mortgaged ? Math.ceil(BOARD[a.id].price / 20) : 0),
        0,
      )
      const toFee = give.reduce(
        (s, a) => s + (a.mortgaged ? Math.ceil(BOARD[a.id].price / 20) : 0),
        0,
      )
      check(
        from.cash + offer.receiveCash - offer.giveCash >= fromFee &&
          to.cash + offer.giveCash - offer.receiveCash >= toFee,
        'Không đủ tiền trả giao dịch và lãi thế chấp 10%.',
      )
      from.cash += offer.receiveCash - offer.giveCash - fromFee
      to.cash += offer.giveCash - offer.receiveCash - toFee
      give.forEach((a) => {
        a.owner = to.id
      })
      take.forEach((a) => {
        a.owner = from.id
      })
      log(room, `${from.name} và ${to.name} hoàn tất trao đổi.`)
    }
    room.trade = null
    if (room.phase === 'debt') settle(room, now, rng)
    return
  }
  check(!room.trade, 'Hãy xử lý đề nghị trao đổi trước.')
  if (['mortgage', 'redeem', 'build', 'sell', 'sell-group'].includes(action)) {
    check(
      (room.phase === 'debt' &&
        debtActor === actor.id &&
        ['mortgage', 'sell', 'sell-group'].includes(action)) ||
        (['roll', 'end'].includes(room.phase) && current(room).id === actor.id),
      'Chỉ quản lý tài sản trong lượt của mình hoặc khi cần trả nợ.',
    )
    manage(room, actor, action, input.tileId)
    if (room.phase === 'debt') settle(room, now, rng)
    return
  }
  if (action === 'trade') {
    check(
      (['roll', 'end'].includes(room.phase) && current(room).id === actor.id) ||
        (room.phase === 'debt' && debtActor === actor.id),
      'Chỉ đề nghị trong lượt hoặc khi cần trả nợ.',
    )
    const to = room.players.find(
      (p) => p.id === input.to && p.id !== actor.id && !p.bankrupt && p.connected,
    )
    check(
      to && integer(input.giveCash, 0, 10000000) && integer(input.receiveCash, 0, 10000000),
      'Tiền hoặc người nhận không hợp lệ.',
    )
    transferCheck(room, actor.id, input.give)
    transferCheck(room, to.id, input.take)
    check(
      input.give.length + input.take.length + input.giveCash + input.receiveCash > 0,
      'Đề nghị đang trống.',
    )
    room.trade = {
      from: actor.id,
      to: to.id,
      give: input.give,
      take: input.take,
      giveCash: input.giveCash,
      receiveCash: input.receiveCash,
    }
    return
  }
  if (action === 'bankrupt') {
    check(
      room.phase === 'debt' && debtActor === actor.id,
      'Chỉ tuyên bố phá sản khi đang thiếu tiền trả nợ.',
    )
    bankrupt(room, actor, now, rng)
    return
  }
  if (action === 'bid' || action === 'pass') {
    check(
      room.phase === 'auction' && room.auction.actor === actor.id,
      'Chưa tới lượt đấu giá của bạn.',
    )
    if (action === 'bid') {
      check(
        integer(input.amount, room.auction.high + 1, actor.cash),
        'Giá phải cao hơn giá hiện tại và không vượt tiền mặt.',
      )
      room.auction.high = input.amount
      room.auction.bidder = actor.id
    } else room.auction.passed.push(actor.id)
    advanceAuction(room, now, rng)
    return
  }
  check(current(room).id === actor.id, 'Chưa tới lượt của bạn.')
  if (action === 'surrender') {
    check(['roll', 'end'].includes(room.phase), 'Chỉ bỏ cuộc trước gieo hoặc khi kết thúc lượt.')
    bankrupt(room, actor, now, rng, true)
    return
  }
  if (action === 'end') {
    check(room.phase === 'end', 'Hãy xử lý xong lượt này.')
    finishTurn(room, now)
    return
  }
  if (action === 'buy' || action === 'auction') {
    check(room.phase === 'buy', 'Không có đất đang chờ mua.')
    const a = room.properties.find((p) => p.id === actor.position),
      t = BOARD[actor.position]
    if (action === 'auction') {
      openAuction(room, t.id)
      return
    }
    check(actor.cash >= t.price && !a.owner, 'Không đủ tiền mua đất; hãy đưa ra đấu giá.')
    actor.cash -= t.price
    a.owner = actor.id
    log(room, `${actor.name} mua ${t.name} với ${t.price}.`)
    settle(room, now, rng)
    return
  }
  if (action === 'bail' || action === 'jail-card') {
    check(room.phase === 'roll' && actor.jail, 'Bạn không ở tù hoặc đã gieo xúc xắc.')
    if (action === 'jail-card') {
      check(actor.jailCards.length, 'Bạn chưa có giấy miễn tù.')
      const c = actor.jailCards.shift()
      room.decks[c.kind].push(c.index)
      actor.jail = false
      actor.jailTurns = 0
    } else {
      check(actor.cash >= 50, 'Cần 50 tiền mặt; có thể thế chấp hoặc thử gieo đôi.')
      actor.cash -= 50
      if (room.settings.parkingPot) room.pot += 50
      actor.jail = false
      actor.jailTurns = 0
    }
    return
  }
  if (action === 'roll') {
    check(room.phase === 'roll', 'Chưa được gieo xúc xắc.')
    room.card = null
    room.dice = [rng(6) + 1, rng(6) + 1]
    const [a, b] = room.dice,
      sum = a + b
    log(room, `${actor.name} gieo ${a} + ${b}.`)
    if (actor.jail) {
      room.again = false
      actor.jailTurns++
      if (a === b) {
        actor.jail = false
        actor.jailTurns = 0
        move(room, actor, sum, now, rng)
      } else if (actor.jailTurns === 3) {
        actor.jail = false
        actor.jailTurns = 0
        pay(room, actor, null, 50, 'ra tù lần ba')
        room.continuation = { kind: 'move', steps: sum }
        settle(room, now, rng)
      } else room.phase = 'end'
      return
    }
    room.again = a === b
    room.doubles = room.again ? room.doubles + 1 : 0
    if (room.doubles === 3) {
      jail(room, actor)
      return
    }
    move(room, actor, sum, now, rng)
    return
  }
  throw Error('Thao tác không được hỗ trợ.')
}
// Transactions isolate rejected requests: validation errors never partly change the live table.
export function command(room, id, action, input = {}, now = Date.now(), rng = randomInt) {
  const next = structuredClone(room),
    actor = next.players.find((p) => p.id === id)
  apply(next, actor, action, input, now, rng)
  next.revision++
  Object.assign(room, next)
}
export function view(room, myId) {
  const { decks: _decks, effects, continuation: _continuation, ...state } = room
  return {
    ...state,
    myId,
    paused: paused(room),
    debt: effects[0] || null,
    board: BOARD,
    players: room.players.map(({ secret: _secret, jailCards, ...p }) => ({
      ...p,
      jailCards: jailCards.length,
      worth: netWorth(room, p),
    })),
  }
}
