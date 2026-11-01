// Human-adjudicated games never invoke automatic role abilities or win conditions.
export function manualControl(room, action, input, { check, players, phase, log }) {
  const people = players(room)
  const record = (message, eventPhase) => {
    log(room, message)
    if (eventPhase) room.logs[room.logs.length - 1].phase = eventPhase
  }
  const selected = (alive, limit = people.length) => {
    check(
      Array.isArray(input.targets) &&
        input.targets.length <= limit &&
        new Set(input.targets).size === input.targets.length,
      'Danh sách người chơi không hợp lệ.',
    )
    const list = input.targets.map((id) => people.find((p) => p.id === id && p.alive === alive))
    check(list.every(Boolean), 'Người chơi đã thay đổi trạng thái. Hãy chọn lại.')
    return list
  }
  if (action === 'finish-manual') {
    check(!['lobby', 'ended'].includes(room.phase), 'Không có ván đang chơi để kết thúc.')
    const winner = input.winningTeam || 'manual'
    check(
      ['manual', 'village', 'werewolf', 'vampire', 'independent'].includes(winner),
      'Phe thắng không hợp lệ.',
    )
    const ids = input.winnerIds || []
    check(
      Array.isArray(ids) &&
        new Set(ids).size === ids.length &&
        ids.every((id) => people.some((p) => p.id === id)),
      'Danh sách người thắng không hợp lệ.',
    )
    check(
      winner === 'manual' ? ids.length === 0 : ids.length > 0,
      'Hãy xác nhận người thắng hoặc chọn không tính kết quả.',
    )
    phase(room, 'ended')
    room.turn = null
    room.queue = []
    room.winner = winner
    const labels = {
      village: 'Phe Dân làng',
      werewolf: 'Phe Sói',
      vampire: 'Phe Ma cà rồng',
      independent: 'Người chơi thắng riêng',
    }
    room.lastSummary =
      winner === 'manual'
        ? 'Quản trò đã kết thúc ván. Không tính thắng/thua.'
        : `${labels[winner]} chiến thắng theo xác nhận của quản trò.`
    record(room.lastSummary)
    const summary = people.map((p) => {
      const won = ids.includes(p.id)
      if (winner !== 'manual') {
        if (won) p.wins++
        else p.losses++
      }
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        originalRole: p.originalRole,
        won,
        alive: p.alive,
      }
    })
    room.history.push({
      game: room.game,
      winner,
      adjudicated: true,
      players: summary,
      logs: structuredClone(room.logs),
    })
    return
  }
  check(
    room.phase === 'manual' || (action === 'manual-night' && room.phase === 'reveal'),
    'Chưa thể điều phối ván lúc này.',
  )
  if (action === 'manual-night') {
    check(room.manualStage !== 'night', 'Đêm hiện tại chưa kết thúc.')
    room.round++
    room.manualStage = 'night'
    room.deaths = []
    room.lastSummary = ''
    phase(room, 'manual')
    record(`Quản trò bắt đầu đêm ${room.round}.`, 'night')
    return
  }
  if (action === 'manual-dawn') {
    check(room.manualStage === 'night', 'Chưa bắt đầu đêm để công bố kết quả.')
    const dead = selected(true)
    for (const p of dead) {
      p.alive = false
      p.manualDeathReason = `Bị loại đêm ${room.round}`
      record(`Đêm ${room.round}: ${p.name} bị loại theo xác nhận của quản trò.`, 'dawn')
    }
    room.deaths = dead.map((p) => p.id)
    room.manualStage = 'day'
    room.lastSummary = dead.length
      ? `Đêm ${room.round}: ${dead.map((p) => p.name).join(', ')} đã bị loại.`
      : `Đêm ${room.round}: không ai bị loại.`
    record(room.lastSummary, 'dawn')
    room.revision++
    return
  }
  if (action === 'manual-execute') {
    check(room.manualStage === 'day', 'Chỉ ghi treo cổ trong ban ngày.')
    const dead = selected(true, 1)
    check(dead.length === 1, 'Hãy chọn một người bị treo cổ.')
    const p = dead[0]
    p.alive = false
    p.manualDeathReason = `Bị treo cổ ngày ${room.round}`
    room.lastSummary = `Ngày ${room.round}: ${p.name} bị treo cổ theo kết quả ngoài bàn chơi.`
    record(room.lastSummary, 'day')
    room.revision++
    return
  }
  if (action === 'manual-revive') {
    const list = selected(false, 1)
    check(list.length === 1, 'Hãy chọn một người cần khôi phục.')
    list[0].alive = true
    list[0].manualDeathReason = null
    room.deaths = room.deaths.filter((id) => id !== list[0].id)
    room.lastSummary = `Quản trò khôi phục ${list[0].name} để chỉnh kết quả.`
    record(room.lastSummary, room.manualStage === 'night' ? 'night' : 'day')
    room.revision++
    return
  }
  throw new Error('Thao tác điều phối không hợp lệ.')
}
