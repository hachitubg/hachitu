import { readFileSync } from 'node:fs'
import { randomBytes, randomInt } from 'node:crypto'
import { BASIC_GUIDES, DRUNK_ROLES } from './basic-guides.mjs'

const deck = JSON.parse(
  readFileSync(new URL('../../public/werewolf-host/deck.json', import.meta.url), 'utf8'),
)
const EXISTING_SUPPORTED = [
  'villager',
  'werewolf',
  'seer',
  'bodyguard',
  'witch',
  'mason',
  'mayor',
  'minion',
  'lycan',
  'wolf_man',
  'pacifist',
  'village_idiot',
  'prince',
  'spellcaster',
  'aura_seer',
  'sorceress',
  'mentalist',
  'mystic_seer',
  'priest',
  'huntress',
]
export const SUPPORTED = [
  ...new Set([
    ...deck.sets
      .find((set) => set.id === 'basic')
      .roles.filter((role) => role.team !== 'utility')
      .map((role) => role.id),
    ...EXISTING_SUPPORTED,
  ]),
]
export const catalog = deck.sets.flatMap((set) =>
  set.roles.map((role) => ({
    ...role,
    set: set.name_vi,
    setId: set.id,
    guide_vi: BASIC_GUIDES[role.id] || role.ability_vi,
    enabled: SUPPORTED.includes(role.id),
    drunkEligible: DRUNK_ROLES.includes(role.id),
  })),
)
const roles = new Map(catalog.map((role) => [role.id, role]))
const wolves = new Set(['werewolf', 'wolf_man', 'wolf_cub', 'lone_wolf'])
const id = () => randomBytes(16).toString('hex')
export const players = (room) => room.members.filter((member) => !member.host)
const alive = (room) => players(room).filter((member) => member.alive)
const check = (condition, message) => {
  if (!condition) throw new Error(message)
}
const role = (key) => roles.get(key)
const actualRole = (member) =>
  member.role === 'drunk' ? member.hiddenRole || 'villager' : member.role
const team = (member) => {
  const value = role(actualRole(member))?.team
  return !value || value === 'switching' ? 'village' : value
}
const wolf = (member) => wolves.has(member.role)
const affiliation = (member) =>
  team(member) === 'independent' ? `${member.role}:${member.id}` : team(member)
const seerWolf = (member) => member.role === 'lycan' || (wolf(member) && member.role !== 'wolf_man')
const voters = (room) => alive(room).filter((p) => !p.banished)
const publicName = (room, id) => room.members.find((p) => p.id === id)?.name || 'không chọn'
const shuffle = (values) => {
  const copy = [...values]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
export function profile(name, avatar) {
  check(
    typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 24,
    'Tên cần từ 1 đến 24 ký tự.',
  )
  check(
    typeof avatar === 'string' &&
      (/^preset:(?:[0-9]|1[0-5])$/.test(avatar) ||
        /^dicebear:(adventurer|bottts|lorelei|pixel-art|fun-emoji):[a-f0-9]{32}$/.test(avatar) ||
        (avatar.length < 65000 &&
          /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))),
    'Ảnh đại diện không hợp lệ.',
  )
  return { name: name.trim(), avatar }
}
export function member(name, avatar, host = false) {
  return {
    ...profile(name, avatar),
    id: id(),
    token: id(),
    host,
    ready: false,
    connected: true,
    alive: true,
    seen: false,
    role: null,
    wins: 0,
    losses: 0,
    notes: [],
    used: {},
    lastGuard: null,
    silenced: false,
  }
}
export function createRoom(name, avatar, now = Date.now(), cardsOnly = false) {
  const host = member(name, avatar, true)
  return {
    code: randomBytes(3).toString('hex').toUpperCase(),
    members: [host],
    created: now,
    expires: now + 24 * 3600_000,
    phase: 'lobby',
    cardsOnly: cardsOnly === true,
    nightCheckpoint: null,
    revision: 0,
    round: 0,
    deck: [],
    turn: null,
    queue: [],
    logs: [],
    history: [],
    decisions: {},
    votes: {},
    nominee: null,
    ballot: 0,
    eligible: [],
    deadline: null,
    winner: null,
    game: 0,
    deaths: [],
    lastSummary: '',
    drunkRole: 'villager',
    seatOrder: [],
    lovers: [],
    pendingHunters: [],
    ghostClues: [],
    cultFollowers: [],
    doubleBiteNight: 0,
    sickNight: 0,
    wolfTargets: [],
    executionsLeft: 1,
  }
}
export function addPlayer(room, name, avatar) {
  check(room.phase === 'lobby', 'Ván đang diễn ra. Bạn có thể vào khi quản trò mở ván mới.')
  check(players(room).length < 24, 'Phòng tối đa 24 người chơi.')
  const person = member(name, avatar)
  check(
    !avatar.startsWith('dicebear:') || !room.members.some((p) => p.avatar === avatar),
    'Avatar này đã có người dùng trong phòng. Hãy bấm Ngẫu nhiên để chọn avatar khác.',
  )
  check(
    !room.members.some((p) => p.name.toLocaleLowerCase() === person.name.toLocaleLowerCase()),
    'Tên đã có trong phòng. Hãy chọn tên khác.',
  )
  room.members.push(person)
  room.seatOrder = [
    ...(room.seatOrder || []).filter((id) => players(room).some((p) => p.id === id)),
    person.id,
  ]
  room.deck = []
  return person
}
function log(room, message) {
  room.logs.push({
    at: Date.now(),
    round: room.round,
    phase: room.phase === 'death-action' ? room.deathLogPhase || 'dawn' : room.phase,
    message,
  })
}
function phase(room, value) {
  room.phase = value
  room.revision++
  room.deadline = null
}
export function validateDeck(list, count, drunkRole = 'villager', cardsOnly = false) {
  check(Array.isArray(list) && list.length === count, `Cần đúng ${count} lá bài.`)
  const counts = new Map()
  for (const key of list) {
    check(
      cardsOnly ? role(key) && role(key).team !== 'utility' : SUPPORTED.includes(key),
      'Có vai trò chưa được hỗ trợ.',
    )
    counts.set(key, (counts.get(key) || 0) + 1)
    check(counts.get(key) <= role(key).quantity, `Vượt số lá ${role(key).name_vi} trong bộ bài.`)
  }
  if (cardsOnly) return list.reduce((sum, key) => sum + (role(key).balance_points || 0), 0)
  if (counts.has('drunk')) {
    check(DRUNK_ROLES.includes(drunkRole), 'Chọn lá ẩn hợp lệ cho Kẻ say rượu.')
    check(
      (counts.get(drunkRole) || 0) + 1 <= role(drunkRole).quantity,
      'Lá ẩn của Kẻ say rượu đã hết bản sao trong bộ bài.',
    )
  }
  const pack = list.filter((key) => wolves.has(key)).length
  const enemies =
    list.filter((key) => role(key).team === 'werewolf').length +
    (counts.has('drunk') && role(drunkRole).team === 'werewolf' ? 1 : 0)
  const vampireCount =
    (counts.get('vampire') || 0) + (counts.has('drunk') && drunkRole === 'vampire' ? 1 : 0)
  check(
    (pack > 0 || counts.has('vampire')) && enemies < count / 2 && vampireCount < count / 2,
    'Cần Sói hoặc Ma cà rồng; mỗi phe săn người phải ít hơn nửa phòng.',
  )
  check((counts.get('mason') || 0) !== 1, 'Hội Tam điểm cần đủ 2 lá.')
  check(!counts.has('minion') || pack >= 1, 'Kẻ phản bội cần có Sói.')
  check(
    !counts.has('sorceress') || counts.has('seer'),
    'Tiên tri Sói cần Tiên tri thường trong ván.',
  )
  check(
    !counts.has('apprentice_seer') || counts.has('seer'),
    'Tiên tri tập sự cần có Tiên tri thường trong bộ bài.',
  )
  return list.reduce((sum, key) => sum + role(key).balance_points, 0)
}
export function suggestDeck(count) {
  check(Number.isInteger(count) && count >= 5 && count <= 24, 'Cần từ 5 đến 24 người chơi.')
  const pack = Math.max(1, Math.floor(count / 4))
  const pool = [
    'seer',
    'bodyguard',
    'witch',
    'mayor',
    'prince',
    'aura_seer',
    'priest',
    'lycan',
    'pacifist',
    'village_idiot',
    'spellcaster',
    'hunter',
    'cursed',
    'diseased',
    'tough_guy',
    'old_hag',
    'pi',
  ]
  if (count >= 8)
    pool.push(
      'cupid',
      'hoodlum',
      'tanner',
      'ghost',
      'cult_leader',
      'apprentice_seer',
      'troublemaker',
      'mason',
      'mason',
    )
  if (count >= 10) pool.push('drunk')
  let best = null,
    bestScore = Infinity
  for (let attempt = 0; attempt < 400; attempt++) {
    const specialCount = Math.max(
      count - pack - 12,
      Math.min(Math.floor(count / 2), 1 + (attempt % Math.max(1, Math.floor(count / 2)))),
    )
    const list = [...Array(pack).fill('werewolf'), ...shuffle(pool).slice(0, specialCount)]
    if (count >= 8 && attempt % 3 === 0) list[0] = 'wolf_cub'
    if (count >= 10 && pack >= 2 && attempt % 7 === 0) list[0] = 'lone_wolf'
    while (list.length < count) list.push('villager')
    if (list.length !== count) continue
    let balance
    try {
      balance = validateDeck(list, count)
    } catch {
      continue
    }
    const score =
      Math.abs(balance) +
      (list.includes('seer') || list.includes('aura_seer') ? 0 : 4) +
      specialCount * 0.1
    if (score < bestScore) {
      best = list
      bestScore = score
    }
  }
  check(best, 'Chưa tìm được bộ bài. Quản trò hãy chọn thủ công.')
  return best
}
const requiredOnline = (room) =>
  room.members.filter(
    (p) => p.host || room.phase === 'lobby' || p.alive || room.turn?.actors.includes(p.id),
  )
export function paused(room) {
  return (
    !room.cardsOnly &&
    !['ended', 'lobby'].includes(room.phase) &&
    requiredOnline(room).some((p) => !p.connected)
  )
}
function recordWinner(room) {
  if (room.pendingHunters?.length) return false
  const living = alive(room),
    pack = living.filter(wolf),
    enemies = living.filter((p) => team(p) === 'werewolf')
  const vampires = living.filter((p) => team(p) === 'vampire')
  const potentialWolves = living.filter((p) => p.role === 'drunk' && wolves.has(p.hiddenRole))
  const lovers = (room.lovers || [])
    .map((id) => room.members.find((p) => p.id === id))
    .filter(Boolean)
  const mixedLovers = lovers.length === 2 && affiliation(lovers[0]) !== affiliation(lovers[1])
  const lone = living.find((p) => p.role === 'lone_wolf')
  let winner = null
  if (!living.length) winner = 'draw'
  else if (mixedLovers && living.length === 2 && lovers.every((p) => p.alive)) winner = 'lovers'
  else if (
    lone &&
    (living.length === 1 ||
      (living.length === 2 &&
        living.every((p) => p === lone || (!wolf(p) && team(p) !== 'werewolf'))))
  )
    winner = 'lone_wolf'
  else if (vampires.length === living.length) winner = 'vampire'
  else if (!pack.length && !potentialWolves.length && !vampires.length) winner = 'village'
  else if (
    pack.some((p) => p.role !== 'lone_wolf') &&
    !vampires.length &&
    enemies.length >= living.length - enemies.length
  )
    winner = 'werewolf'
  if (!winner) return false
  room.winner = winner
  phase(room, 'ended')
  log(
    room,
    `${{ village: 'Dân làng', werewolf: 'Phe Sói', vampire: 'Phe Ma cà rồng', lone_wolf: 'Sói đơn độc', lovers: 'Cặp đôi khác phe' }[winner] || 'Không phe nào'}${winner === 'draw' ? ' sống sót. Ván hòa.' : ' chiến thắng.'}`,
  )
  const summary = players(room).map((p) => {
    const mixedPartner = mixedLovers && lovers.includes(p)
    let won = winner === 'lovers' ? lovers.includes(p) : !mixedPartner && team(p) === winner
    if (p.role === 'lone_wolf') won = winner === 'lone_wolf' && p.alive
    if (p.role === 'tanner') won = !p.alive
    if (p.role === 'hoodlum')
      won =
        p.alive &&
        p.hoodlumTargets?.length === 2 &&
        p.hoodlumTargets.every((id) => !room.members.find((target) => target.id === id)?.alive)
    if (p.role === 'cult_leader')
      won =
        living.length > 0 &&
        living.every((target) => (p.followers || []).includes(target.id) || target.id === p.id)
    won = Boolean(won)
    if (mixedPartner) won = winner === 'lovers'
    if (won) p.wins++
    else p.losses++
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      role: actualRole(p),
      originalRole: p.originalRole || p.role,
      won,
      alive: p.alive,
    }
  })
  room.history.push({ game: room.game, winner, players: summary, logs: [...room.logs] })
  return true
}
function kill(room, person, reason) {
  if (!person?.alive) return
  person.alive = false
  person.deathRound = room.round
  person.deathReason = reason
  room.deaths.push(person.id)
  const endings = {
    'Sói cắn': 'chết vì bị Sói cắn',
    'bình độc': 'chết vì trúng bình độc',
    'Nữ thợ săn': 'chết vì bị Nữ thợ săn bắn',
    'treo cổ': 'bị treo cổ',
  }
  log(room, `${person.name} ${endings[reason] || `bị loại (${reason})`}.`)
  if (person.role === 'wolf_cub') {
    room.doubleBiteNight = room.round + 1
    log(
      room,
      `Sói con (${person.name}) đã chết. Đàn Sói được cắn hai người ở đêm ${room.round + 1}.`,
    )
  }
  if (person.role === 'diseased' && reason === 'Sói cắn') {
    room.sickNight = room.round + 1
    log(room, `Sói ăn phải Con bệnh (${person.name}), phải nghỉ săn ở đêm ${room.round + 1}.`)
  }
  if (person.role === 'hunter' && !person.used.hunter) {
    room.pendingHunters ||= []
    room.pendingHunters.push(person.id)
  }
  for (const clone of alive(room).filter(
    (p) => p.role === 'doppelganger' && p.copyTarget === person.id,
  )) {
    clone.role = person.role
    clone.hiddenRole = person.hiddenRole
    // Inherit skill resources, but keep effects already applied to the clone itself.
    const blessed = clone.used.blessed
    clone.used = { ...person.used }
    delete clone.used.blessed
    if (blessed) clone.used.blessed = true
    clone.lastGuard = person.lastGuard
    clone.followers = [...(person.followers || [])]
    clone.hoodlumTargets = [...(person.hoodlumTargets || [])]
    clone.notes.push(`Bạn đã thừa hưởng vai ${role(clone.role).name_vi} từ ${person.name}.`)
    log(
      room,
      `Người nhân bản (${clone.name}) thừa hưởng vai ${role(clone.role).name_vi} từ ${person.name}.`,
    )
    if (clone.role === 'minion')
      clone.notes.push(
        `Các Sói: ${alive(room)
          .filter(wolf)
          .map((p) => p.name)
          .join(', ')}.`,
      )
    if (clone.role === 'mason')
      clone.notes.push(
        `Hội Tam điểm: ${alive(room)
          .filter((p) => p.role === 'mason')
          .map((p) => p.name)
          .join(', ')}.`,
      )
    if (clone.role === 'ghost') kill(room, clone, 'trở thành Hồn ma')
  }
  const partner = (room.lovers || []).includes(person.id)
    ? room.members.find((p) => p.id !== person.id && room.lovers.includes(p.id))
    : null
  if (partner?.alive) kill(room, partner, `đau buồn vì người yêu ${person.name} đã chết`)
}
function advanceHunter(room) {
  const id = room.pendingHunters?.shift()
  if (id) {
    room.turn = { key: 'hunter', actors: [id] }
    room.decisions = {}
    phase(room, 'death-action')
    return true
  }
  room.turn = null
  return false
}
function settle(room, destination) {
  if (room.pendingHunters?.length) {
    room.afterDeath = destination
    room.deathLogPhase = room.phase === 'dawn' ? 'dawn' : 'verdict'
    advanceHunter(room)
    return
  }
  if (!recordWinner(room)) phase(room, destination)
}
function afterBallot(room, forceEnd = false) {
  room.executionsLeft = forceEnd ? 0 : Math.max(0, (room.executionsLeft || 1) - 1)
  for (const p of alive(room))
    if (p.vampireDue && p.vampireDue <= room.round) {
      p.vampireDue = null
      kill(room, p, 'vết cắn của Ma cà rồng')
      room.lastSummary += ` ${p.name} chết vì vết cắn Ma cà rồng.`
    }
  settle(room, room.executionsLeft > 0 ? 'day-extra' : 'day-end')
}
function beginNight(room, checkpoint = true) {
  if (checkpoint) {
    const { nightCheckpoint: previous, ...snapshot } = room
    void previous
    room.nightCheckpoint = structuredClone(snapshot)
  }
  room.round++
  phase(room, 'night')
  room.protections = {}
  room.heals = []
  room.poisons = []
  room.shots = []
  room.pendingClues = []
  room.wolfTargets = []
  room.wolfTarget = null
  room.vampireTarget = null
  room.healed = null
  room.poisoned = null
  room.shot = null
  room.protected = null
  room.pendingClue = ''
  room.executionsLeft = 1
  for (const p of players(room)) {
    p.banished = false
    if (p.alive && p.role === 'drunk' && room.round >= 3) {
      p.role = p.hiddenRole || 'villager'
      p.notes.push(`Bạn đã tỉnh rượu và nhận vai ${role(p.role).name_vi}.`)
      log(room, `Kẻ say rượu (${p.name}) tỉnh lại và nhận vai ${role(p.role).name_vi}.`)
    }
  }
  room.votes = {}
  room.nominee = null
  room.eligible = []
  room.decisions = {}
  room.deaths = []
  room.queue = []
  const available = alive(room)
  const add = (key, ids) => {
    if (ids.length) room.queue.push({ key, actors: ids })
  }
  const byRole = (key) => available.filter((p) => p.role === key).map((p) => p.id)
  if (room.round === 1) {
    for (const key of ['cupid', 'doppelganger', 'hoodlum']) add(key, byRole(key))
    add('mason', byRole('mason'))
    add('minion', byRole('minion'))
  }
  for (const key of [
    'priest',
    'bodyguard',
    'wolves',
    'vampires',
    'witch',
    'huntress',
    'seer',
    'apprentice_seer',
    'aura_seer',
    'mystic_seer',
    'mentalist',
    'sorceress',
    'spellcaster',
    'old_hag',
    'cult_leader',
    'pi',
    'troublemaker',
    'ghost',
  ]) {
    if (key === 'wolves' && room.sickNight === room.round) {
      log(room, 'Đàn Sói đang mắc bệnh nên không săn trong đêm nay.')
      continue
    }
    if (
      key === 'apprentice_seer' &&
      (available.some((p) => p.role === 'seer') ||
        !players(room).some(
          (p) => p.role === 'seer' && !p.alive && (p.deathRound || 0) < room.round,
        ))
    )
      continue
    const actors =
      key === 'wolves'
        ? available.filter(wolf)
        : key === 'vampires'
          ? available.filter((p) => p.role === 'vampire')
          : key === 'ghost'
            ? players(room).filter(
                (p) => p.role === 'ghost' && !p.alive && room.round > (p.deathRound || 0),
              )
            : available.filter(
                (p) =>
                  p.role === key &&
                  (!['priest', 'huntress', 'pi', 'troublemaker'].includes(key) || !p.used[key]),
              )
    add(
      key,
      actors.map((p) => p.id),
    )
  }
  players(room).forEach((p) => (p.silenced = false))
  room.turn = room.queue.shift() || null
  log(room, `Cả làng đi ngủ. Bắt đầu đêm ${room.round}.`)
}
const acted = (room) => room.turn && room.turn.actors.every((id) => room.decisions[id]?.confirmed)
function candidates(room, person) {
  const key = room.turn?.key
  return alive(room)
    .filter((target) => {
      if (key === 'wolves') return !wolf(target) || target.role === 'wolf_cub'
      if (key === 'vampires') return target.role !== 'vampire'
      if (key === 'cult_leader')
        return target.id !== person.id && !(person.followers || []).includes(target.id)
      if (['ghost', 'troublemaker', 'mason', 'minion'].includes(key)) return false
      if (key === 'bodyguard') return target.id !== person.lastGuard
      if (key === 'spellcaster')
        return target.id !== person.id && !person.used[`silenced:${target.id}`]
      if (
        [
          'seer',
          'apprentice_seer',
          'doppelganger',
          'hoodlum',
          'old_hag',
          'hunter',
          'aura_seer',
          'mystic_seer',
          'sorceress',
          'mentalist',
          'priest',
          'huntress',
        ].includes(key)
      )
        return target.id !== person.id
      return true
    })
    .map((p) => p.id)
}
function actionRules(room, person) {
  const key = room.turn?.key,
    options = candidates(room, person)
  let max = ['mentalist', 'cupid', 'hoodlum'].includes(key)
    ? 2
    : key === 'wolves' && room.doubleBiteNight === room.round
      ? 2
      : ['ghost', 'troublemaker', 'mason', 'minion'].includes(key) ||
          (key === 'witch' && person.used.poison)
        ? 0
        : 1
  max = Math.min(max, options.length)
  return {
    max,
    optional: [
      'witch',
      'priest',
      'huntress',
      'hunter',
      'pi',
      'troublemaker',
      'ghost',
      'spellcaster',
    ].includes(key),
    kind: key === 'ghost' ? 'letter' : key === 'troublemaker' ? 'activate' : 'targets',
  }
}
function selection(room, person, input) {
  check(
    ['night', 'death-action'].includes(room.phase) && room.turn?.actors.includes(person.id),
    'Chưa tới lượt bạn.',
  )
  const targets = input?.targets
  check(
    Array.isArray(targets) &&
      targets.length <= 2 &&
      targets.every((t) => typeof t === 'string') &&
      new Set(targets).size === targets.length,
    'Lựa chọn không hợp lệ.',
  )
  const key = room.turn.key,
    options = candidates(room, person)
  check(
    targets.every((t) => options.includes(t)),
    'Mục tiêu không còn hợp lệ.',
  )
  const { max, optional } = actionRules(room, person)
  check(targets.length <= max && (optional || targets.length === max), `Cần chọn ${max} người.`)
  check(!targets.length || key !== 'witch' || !person.used.poison, 'Bạn đã dùng bình độc.')
  const save = key === 'witch' && input.save === true
  const bites = room.wolfTargets?.length
    ? room.wolfTargets
    : room.wolfTarget
      ? [room.wolfTarget]
      : []
  const saveTarget = save ? input.saveTarget || (bites.length === 1 ? bites[0] : null) : null
  check(
    !save || (!person.used.heal && bites.includes(saveTarget)),
    'Chọn đúng một nạn nhân Sói để dùng bình cứu.',
  )
  const text =
    key === 'ghost' && typeof input.text === 'string' ? input.text.trim().normalize('NFC') : ''
  const normalizeLetter = (value) =>
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
  if (text) {
    check(/^\p{L}$/u.test(text), 'Hồn ma chỉ được gửi một chữ cái hoặc bỏ qua.')
    check(
      !players(room).some((p) =>
        p.name
          .split(/\s+/)
          .some((word) => normalizeLetter(word[0] || '') === normalizeLetter(text)),
      ),
      'Không được dùng chữ đầu trong tên người chơi.',
    )
  }
  return {
    targets: [...targets],
    save,
    saveTarget,
    text,
    activate: key === 'troublemaker' && input.activate === true,
    confirmed: false,
  }
}
function confirmation(room, person, decision) {
  const key = room.turn.key,
    target = room.members.find((p) => p.id === decision.targets[0])
  if (['wolves', 'vampires'].includes(key)) {
    check(
      room.turn.actors.every((id) => sameTargets(room.decisions[id]?.targets, decision.targets)),
      'Cả phe cần thống nhất các mục tiêu trước khi xác nhận.',
    )
  }
  decision.confirmed = true
  room.decisions[person.id] = decision
  let info = ''
  if (target) {
    if (['seer', 'apprentice_seer'].includes(key))
      info = `${target.name}: ${seerWolf(target) ? 'Sói' : 'Không phải Sói'}.`
    if (key === 'aura_seer')
      info = `${target.name}: ${['villager', 'werewolf', 'drunk'].includes(target.role) ? 'Vai thường' : 'Vai đặc biệt'}.`
    if (key === 'mystic_seer') info = `${target.name}: ${role(target.role).name_vi}.`
    if (key === 'sorceress')
      info = `${target.name}: ${target.role === 'seer' ? 'Là Tiên tri' : 'Không phải Tiên tri'}.`
    if (key === 'mentalist' && decision.targets.length === 2) {
      const second = room.members.find((p) => p.id === decision.targets[1])
      info = `${target.name} và ${second.name}: ${affiliation(target) === affiliation(second) ? 'cùng phe' : 'khác phe'}.`
    }
    if (key === 'pi') {
      const ring = (room.seatOrder?.length ? room.seatOrder : players(room).map((p) => p.id))
        .map((id) => room.members.find((p) => p.id === id))
        .filter((p) => p?.alive)
      const index = ring.indexOf(target)
      const trio = [
        ring[index],
        ring[(index + 1) % ring.length],
        ring[(index + ring.length - 1) % ring.length],
      ]
      info = `Nhóm quanh ${target.name}: ${trio.some(wolf) ? 'có Sói' : 'không có Sói'}.`
    }
  }
  if (key === 'mason')
    info = `Hội Tam điểm: ${alive(room)
      .filter((p) => p.role === 'mason')
      .map((p) => p.name)
      .join(', ')}.`
  if (key === 'minion')
    info = `Các Sói: ${alive(room)
      .filter(wolf)
      .map((p) => p.name)
      .join(', ')}.`
  if (info) person.notes.push(`Đêm ${room.round}: ${info}`)
  for (const message of nightStories(room, person, decision, info)) log(room, message)
}
function sameTargets(a, b) {
  return Array.isArray(a) && a.length === b.length && a.every((id) => b.includes(id))
}

function nightStories(room, person, decision, info) {
  const key = room.turn.key
  const target = room.members.find((p) => p.id === decision.targets[0])
  const actor = (name) => `${name} (${person.name})`
  switch (key) {
    case 'wolves': {
      if (!acted(room)) return []
      const names = room.turn.actors.map((id) => room.members.find((p) => p.id === id).name)
      const victims = decision.targets.map((id) => publicName(room, id)).join(' và ')
      return [
        names.length === 1
          ? `Sói (${names[0]}) cắn ${victims}.`
          : `Bầy Sói (${names.join(', ')}) thống nhất cắn ${victims}.`,
      ]
    }
    case 'vampires':
      return acted(room)
        ? [
            `Ma cà rồng (${room.turn.actors.map((id) => publicName(room, id)).join(', ')}) cắn ${publicName(room, decision.targets[0])}; nạn nhân sẽ chết sau phiên biểu quyết ngày mai nếu không được bảo vệ.`,
          ]
        : []
    case 'cupid':
      return [
        `${actor('Thần tình yêu')} ghép đôi ${decision.targets.map((id) => publicName(room, id)).join(' và ')}.`,
      ]
    case 'doppelganger':
      return [
        `${actor('Người nhân bản')} chọn thừa hưởng vai của ${target.name} khi người đó chết.`,
      ]
    case 'hoodlum':
      return [
        `${actor('Du côn')} chọn hai mục tiêu riêng: ${decision.targets.map((id) => publicName(room, id)).join(' và ')}.`,
      ]
    case 'cult_leader':
      return [
        target
          ? `${actor('Trưởng giáo phái')} thu nạp ${target.name}.`
          : `${actor('Trưởng giáo phái')} đã thu nạp hết người đang sống.`,
      ]
    case 'old_hag':
      return [
        target
          ? `${actor('Bà già')} đuổi ${target.name} khỏi cuộc thảo luận và bỏ phiếu ngày mai.`
          : `${actor('Bà già')} không có mục tiêu.`,
      ]
    case 'pi':
      return [
        info ? `${actor('P.I.')} kiểm tra ${info}` : `${actor('P.I.')} giữ lại lượt điều tra.`,
      ]
    case 'troublemaker':
      return [
        decision.activate
          ? `${actor('Kẻ phá rối')} khiến ngày mai có hai phiên biểu quyết xử tử.`
          : `${actor('Kẻ phá rối')} chưa kích hoạt khả năng.`,
      ]
    case 'ghost':
      return [
        decision.text
          ? `${actor('Hồn ma')} để lại chữ “${decision.text}” cho buổi sáng.`
          : `${actor('Hồn ma')} không gửi gợi ý trong đêm nay.`,
      ]
    case 'hunter':
      return [
        target
          ? `${actor('Thợ săn')} chọn bắn ${target.name} trước khi rời ván.`
          : `${actor('Thợ săn')} quyết định không bắn ai.`,
      ]
    case 'bodyguard':
      return [
        target.id === person.id
          ? `${actor('Bảo vệ')} tự bảo vệ mình.`
          : `${actor('Bảo vệ')} bảo vệ ${target.name}.`,
      ]
    case 'witch': {
      const messages = []
      if (decision.save)
        messages.push(
          `${actor('Phù thủy')} dùng bình cứu cho ${publicName(room, decision.saveTarget)}.`,
        )
      if (target) messages.push(`${actor('Phù thủy')} dùng bình độc lên ${target.name}.`)
      if (!messages.length) messages.push(`${actor('Phù thủy')} không dùng thuốc trong đêm nay.`)
      return messages
    }
    case 'priest':
      return [
        target
          ? `${actor('Tu sĩ')} ban phước cho ${target.name}.`
          : `${actor('Tu sĩ')} giữ lại phép ban phước.`,
      ]
    case 'huntress':
      return [
        target
          ? `${actor('Nữ thợ săn')} bắn ${target.name}.`
          : `${actor('Nữ thợ săn')} chưa bắn ai, giữ lại phát bắn duy nhất.`,
      ]
    case 'spellcaster':
      return [
        target
          ? `${actor('Pháp sư câm')} khiến ${target.name} không được nói vào ngày mai.`
          : `${actor('Pháp sư câm')} không còn mục tiêu hợp lệ trong đêm nay.`,
      ]
    case 'seer':
      return [`${actor('Tiên tri')} soi ${info}`]
    case 'apprentice_seer':
      return [`${actor('Tiên tri tập sự')} soi ${info}`]
    case 'aura_seer':
      return [`${actor('Tiên tri hào quang')} soi ${info}`]
    case 'mystic_seer':
      return [`${actor('Tiên tri bí ẩn')} soi ${info}`]
    case 'sorceress':
      return [`${actor('Tiên tri Sói')} soi ${info}`]
    case 'mentalist':
      return [`${actor('Thám tử')} kiểm tra ${info}`]
    case 'mason':
      return acted(room)
        ? [
            `Hội Tam điểm (${room.turn.actors.map((id) => room.members.find((p) => p.id === id).name).join(', ')}) nhận ra đồng đội của mình.`,
          ]
        : []
    case 'minion':
      return [
        `${actor('Kẻ phản bội')} nhận diện bầy Sói: ${alive(room)
          .filter(wolf)
          .map((p) => p.name)
          .join(', ')}.`,
      ]
    default:
      return []
  }
}
function finishTurn(room) {
  check(acted(room), 'Chờ tất cả người có lượt xác nhận.')
  const key = room.turn.key
  if (key === 'hunter' && room.phase === 'death-action') {
    const actor = room.members.find((p) => p.id === room.turn.actors[0])
    actor.used.hunter = true
    const target = room.members.find((p) => p.id === room.decisions[actor.id].targets[0])
    if (target) kill(room, target, `phát bắn cuối của Thợ săn ${actor.name}`)
    room.lastSummary = `Những người đã bị loại trong lượt này: ${room.deaths.map((id) => publicName(room, id)).join(', ')}.`
    if (!advanceHunter(room)) settle(room, room.afterDeath || 'day-end')
    return
  }
  for (const id of room.turn.actors) {
    const p = room.members.find((p) => p.id === id),
      d = room.decisions[id]
    if (key === 'wolves') {
      room.wolfTarget = d.targets[0]
      room.wolfTargets = [...d.targets]
    }
    if (key === 'vampires') room.vampireTarget = d.targets[0]
    if (key === 'bodyguard') {
      room.protected = d.targets[0]
      room.protections ||= {}
      room.protections[d.targets[0]] = p.id
      p.lastGuard = d.targets[0]
    }
    if (key === 'priest' && d.targets.length) {
      room.members.find((p) => p.id === d.targets[0]).used.blessed = true
      room.members.find((p) => p.id === d.targets[0]).blessedBy = p.id
      p.used.priest = true
    }
    if (key === 'witch') {
      if (d.save) {
        room.healed = d.saveTarget
        room.heals ||= []
        room.heals.push(d.saveTarget)
        p.used.heal = true
      }
      if (d.targets.length) {
        room.poisoned = d.targets[0]
        room.poisons ||= []
        room.poisons.push(d.targets[0])
        p.used.poison = true
      }
    }
    if (key === 'huntress' && d.targets.length) {
      room.shot = d.targets[0]
      room.shots ||= []
      room.shots.push(d.targets[0])
      p.used.huntress = true
    }
    if (key === 'spellcaster' && d.targets.length) {
      room.members.find((p) => p.id === d.targets[0]).silenced = true
      p.used[`silenced:${d.targets[0]}`] = true
    }
    if (key === 'cupid') {
      room.lovers = [...d.targets]
      p.used.cupid = true
      for (const loverId of room.lovers)
        room.members
          .find((member) => member.id === loverId)
          .notes.push(
            `Bạn là cặp đôi với ${publicName(
              room,
              room.lovers.find((other) => other !== loverId),
            )}. Không được biết vai của người ấy. Một người chết thì người kia chết theo.`,
          )
    }
    if (key === 'doppelganger') {
      p.copyTarget = d.targets[0]
      p.notes.push(`Bạn sẽ thừa hưởng chức năng của ${publicName(room, p.copyTarget)} khi họ chết.`)
    }
    if (key === 'hoodlum') {
      p.hoodlumTargets = [...d.targets]
      p.notes.push(
        `Hai mục tiêu của bạn: ${d.targets.map((target) => publicName(room, target)).join(', ')}.`,
      )
    }
    if (key === 'cult_leader' && d.targets.length) {
      p.followers ||= []
      p.followers.push(d.targets[0])
      p.notes.push(`Đã thu nạp ${publicName(room, d.targets[0])}.`)
    }
    if (key === 'old_hag' && d.targets.length)
      room.members.find((member) => member.id === d.targets[0]).banished = true
    if (key === 'pi' && d.targets.length) p.used.pi = true
    if (key === 'troublemaker' && d.activate) {
      p.used.troublemaker = true
      room.executionsLeft = 2
    }
    if (key === 'ghost' && d.text) {
      room.pendingClues ||= []
      room.pendingClues.push({ round: room.round, letter: d.text })
    }
  }
  room.turn = room.queue.shift() || null
  room.decisions = {}
  room.revision++
}
function resolveNight(room) {
  for (const p of alive(room))
    if (p.woundDue && p.woundDue <= room.round) kill(room, p, 'vết thương Sói cắn từ đêm trước')
  const bites = room.wolfTargets?.length
    ? room.wolfTargets
    : room.wolfTarget
      ? [room.wolfTarget]
      : []
  for (const id of bites)
    if (id !== room.healed && !(room.heals || []).includes(id)) nightAttack(room, id, 'Sói cắn')
  for (const id of room.poisons?.length ? room.poisons : room.poisoned ? [room.poisoned] : [])
    nightAttack(room, id, 'bình độc')
  for (const id of room.shots?.length ? room.shots : room.shot ? [room.shot] : [])
    nightAttack(room, id, 'Nữ thợ săn')
  if (room.vampireTarget) nightAttack(room, room.vampireTarget, 'Ma cà rồng')
  if (room.round === 1)
    for (const p of alive(room).filter((p) => p.role === 'ghost')) kill(room, p, 'định mệnh Hồn ma')
  room.ghostClues ||= []
  room.ghostClues.push(...(room.pendingClues || []))
  room.lastSummary = room.deaths.length
    ? `Trời sáng. ${room.deaths.map((id) => room.members.find((p) => p.id === id).name).join(', ')} đã chết trong đêm.`
    : 'Trời sáng. Không ai chết trong đêm.'
  log(room, room.lastSummary)
  settle(room, 'day')
}
function nightAttack(room, id, reason) {
  const target = room.members.find((p) => p.id === id)
  if (!target?.alive) return
  if (reason === 'Sói cắn' && target.role === 'vampire') {
    log(room, `Sói không giết được Ma cà rồng (${target.name}).`)
    return
  }
  const guardId = room.protections?.[id]
  if (guardId || id === room.protected) {
    log(
      room,
      `${target.name} thoát chết nhờ Bảo vệ (${guardId ? publicName(room, guardId) : room.members.find((p) => p.role === 'bodyguard')?.name || 'đã hành động'}).`,
    )
    return
  }
  if (target.used.blessed) {
    target.used.blessed = false
    log(room, `${target.name} được phép ban phước của Tu sĩ cứu. Phép bảo hộ đã dùng hết.`)
    return
  }
  if (reason === 'Sói cắn' && target.role === 'cursed') {
    target.role = 'werewolf'
    target.notes.push('Lời nguyền đã thức tỉnh: bạn trở thành Sói và đi săn từ đêm tiếp theo.')
    log(room, `Kẻ bị nguyền rủa (${target.name}) sống sót và trở thành Sói.`)
    return
  }
  if (reason === 'Sói cắn' && target.role === 'tough_guy') {
    target.woundDue = room.round + 1
    target.notes.push(`Bạn bị thương và sẽ chết khi đêm ${target.woundDue} kết thúc.`)
    log(
      room,
      `Lực sĩ (${target.name}) chưa chết ngay; vết thương sẽ giết họ cuối đêm ${target.woundDue}.`,
    )
    return
  }
  if (reason === 'Ma cà rồng') {
    target.vampireDue = room.round
    log(room, `${target.name} mang vết cắn Ma cà rồng và sẽ chết sau phiên biểu quyết kế tiếp.`)
    return
  }
  kill(room, target, reason)
}
function openNomination(room, eligible = null) {
  room.votes = {}
  room.deaths = []
  room.eligible = eligible || voters(room).map((p) => p.id)
  phase(room, 'nominate')
}
const weighted = (p) => (p.role === 'mayor' ? 2 : 1)
function finishBallot(room) {
  check(
    voters(room).every((p) => Object.hasOwn(room.votes, p.id)),
    'Chờ mọi người xác nhận phiếu.',
  )
  if (room.phase === 'nominate') {
    const tally = new Map()
    for (const p of voters(room)) {
      const target = room.votes[p.id]
      if (target) tally.set(target, (tally.get(target) || 0) + weighted(p))
    }
    const max = Math.max(0, ...tally.values()),
      tied = [...tally.keys()].filter((id) => tally.get(id) === max)
    log(
      room,
      `Đề cử: ${voters(room)
        .map(
          (p) =>
            `${p.name} → ${room.members.find((t) => t.id === room.votes[p.id])?.name || 'trắng'}`,
        )
        .join('; ')}.`,
    )
    if (tied.length === 1) {
      room.nominee = tied[0]
      phase(room, 'defense')
      log(room, `${room.members.find((p) => p.id === tied[0]).name} được mời giải thích.`)
    } else if (tied.length > 1 && room.ballot === 0) {
      room.ballot = 1
      openNomination(room, tied)
    } else {
      room.lastSummary = 'Không có người được đề cử. Không treo cổ hôm nay.'
      afterBallot(room)
    }
  } else {
    const yes = voters(room).reduce(
      (sum, p) => sum + (room.votes[p.id] === true ? weighted(p) : 0),
      0,
    )
    const total = voters(room).reduce((sum, p) => sum + weighted(p), 0)
    const target = room.members.find((p) => p.id === room.nominee)
    log(
      room,
      `Treo cổ ${target.name}: ${yes}/${total} phiếu Có. ${voters(room)
        .map((p) => `${p.name}: ${room.votes[p.id] ? 'Có' : 'Không'}`)
        .join('; ')}.`,
    )
    room.deaths = []
    let princeEndsDay = false
    if (yes > total / 2) {
      if (target.role === 'prince' && !target.used.pardon) {
        target.used.pardon = true
        princeEndsDay = true
        room.lastSummary = `${target.name} là Hoàng tử, được miễn treo cổ lần đầu.`
        target.publicRole = target.role
        log(room, room.lastSummary)
      } else {
        kill(room, target, 'treo cổ')
        room.lastSummary = `${target.name} bị treo cổ.`
      }
    } else room.lastSummary = `${target.name} không bị treo cổ (${yes}/${total} phiếu Có).`
    afterBallot(room, princeEndsDay)
  }
}
export function tick(room, now = Date.now()) {
  if (!room.deadline || now < room.deadline || paused(room)) return false
  if (room.phase === 'countdown') {
    phase(room, 'reveal')
    return true
  }
  if (room.phase === 'dawn') {
    resolveNight(room)
    return true
  }
  return false
}
export function command(room, actor, action, input = {}, now = Date.now()) {
  check(room.expires > now, 'Buổi chơi đã hết hạn.')
  check(actor && room.members.includes(actor), 'Phiên không hợp lệ.')
  if (action === 'reset-night') {
    check(actor.host, 'Chỉ quản trò được làm lại đêm.')
    check(input.revision === room.revision, 'Màn hình đã đổi. Hãy kiểm tra lại.')
    const snapshot = room.nightCheckpoint
    check(
      !room.cardsOnly &&
        snapshot &&
        room.round > 0 &&
        !['lobby', 'countdown', 'reveal', 'dealt'].includes(room.phase),
      'Không có đêm để khôi phục.',
    )
    check(
      snapshot.game === room.game &&
        snapshot.members.length === room.members.length &&
        snapshot.members.every((p) => room.members.some((current) => current.id === p.id)),
      'Danh sách người chơi đã thay đổi, không thể khôi phục ván cũ.',
    )
    const revision = room.revision + 1
    const connections = new Map(room.members.map((p) => [p.id, p.connected]))
    const currentMembers = room.members
    for (const key of Object.keys(room)) delete room[key]
    Object.assign(room, structuredClone(snapshot))
    // Socket handlers keep member references, so restore their values in place.
    room.members = currentMembers.map((member) => {
      const saved = room.members.find((p) => p.id === member.id)
      for (const key of Object.keys(member)) delete member[key]
      Object.assign(member, saved, { connected: connections.get(saved.id) })
      return member
    })
    room.pauseStarted = null
    room.revision = revision
    room.nightCheckpoint = snapshot
    beginNight(room, false)
    log(
      room,
      `Quản trò làm lại đêm ${room.round}. Những thông tin đã xem trước đó không thể thu hồi.`,
    )
    return
  }
  if (action === 'finish-manual') {
    check(
      actor.host && room.cardsOnly,
      'Chỉ quản trò phòng chỉ dùng bộ bài được kết thúc thủ công.',
    )
    check(
      input.revision === room.revision && !['lobby', 'ended'].includes(room.phase),
      'Không có ván đang chơi để kết thúc.',
    )
    phase(room, 'ended')
    room.winner = 'manual'
    room.lastSummary = 'Quản trò đã kết thúc ván. Ứng dụng không tự tính thắng/thua.'
    log(room, room.lastSummary)
    room.history.push({
      game: room.game,
      winner: 'manual',
      players: players(room).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        originalRole: p.originalRole,
        won: false,
        alive: p.alive,
      })),
      logs: [...room.logs],
    })
    return
  }
  if (action === 'abort') {
    check(actor.host, 'Chỉ quản trò được hủy ván.')
    check(input.revision === room.revision, 'Màn hình đã đổi. Hãy kiểm tra lại.')
    check(!['lobby', 'ended'].includes(room.phase), 'Không có ván đang diễn ra.')
    phase(room, 'ended')
    room.winner = 'aborted'
    room.turn = null
    room.queue = []
    room.lastSummary = 'Quản trò đã hủy ván. Không tính thắng/thua.'
    log(room, room.lastSummary)
    room.history.push({
      game: room.game,
      winner: 'aborted',
      players: players(room).map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        won: false,
        alive: p.alive,
      })),
      logs: [...room.logs],
    })
    return
  }
  check(!paused(room), 'Ván đang tạm dừng để chờ người mất kết nối.')
  if (action !== 'ready')
    check(input.revision === room.revision, 'Màn hình đã đổi. Hãy thử lại trên lượt hiện tại.')
  if (action === 'ready') {
    check(room.phase === 'lobby' && !actor.host, 'Không thể sẵn sàng lúc này.')
    actor.ready = !actor.ready
    return
  }
  if (action === 'seen') {
    check(room.phase === 'reveal' && !actor.host, 'Không thể xem bài lúc này.')
    actor.seen = true
    if (players(room).every((p) => p.seen)) phase(room, room.cardsOnly ? 'manual' : 'dealt')
    return
  }
  if (action === 'draft' || action === 'confirm') {
    check(
      !actor.host &&
        (actor.alive ||
          (['ghost', 'hunter'].includes(room.turn?.key) && room.turn.actors.includes(actor.id))) &&
        !room.decisions[actor.id]?.confirmed,
      'Bạn đã xác nhận hoặc không có lượt.',
    )
    const d = selection(room, actor, input)
    if (action === 'draft') {
      if (['wolves', 'vampires'].includes(room.turn.key))
        check(
          !room.turn.actors.some(
            (id) =>
              room.decisions[id]?.confirmed && !sameTargets(room.decisions[id].targets, d.targets),
          ),
          'Đồng đội đã xác nhận. Hãy chọn đúng các mục tiêu đã thống nhất.',
        )
      room.decisions[actor.id] = d
    } else confirmation(room, actor, d)
    return
  }
  if (action === 'vote') {
    check(
      !actor.host && actor.alive && !actor.banished && ['nominate', 'verdict'].includes(room.phase),
      'Bạn không có quyền bỏ phiếu.',
    )
    check(!Object.hasOwn(room.votes, actor.id), 'Bạn đã xác nhận phiếu.')
    if (room.phase === 'nominate')
      check(
        input.vote === null || room.eligible.includes(input.vote),
        'Người được chọn không hợp lệ.',
      )
    else {
      check(typeof input.vote === 'boolean', 'Hãy chọn Có hoặc Không.')
      check(
        actor.role !== 'pacifist' || input.vote === false,
        'Vai Yêu hòa bình phải bỏ phiếu Không.',
      )
      check(actor.role !== 'village_idiot' || input.vote === true, 'Vai Dân ngốc phải bỏ phiếu Có.')
    }
    room.votes[actor.id] = input.vote
    return
  }
  check(actor.host, 'Chỉ quản trò được thực hiện thao tác này.')
  if (action === 'seats') {
    check(room.phase === 'lobby', 'Chỉ đổi chỗ ngồi trước ván.')
    const ids = players(room).map((p) => p.id)
    check(
      Array.isArray(input.order) &&
        input.order.length === ids.length &&
        new Set(input.order).size === ids.length &&
        input.order.every((id) => ids.includes(id)),
      'Thứ tự chỗ ngồi không hợp lệ.',
    )
    room.seatOrder = [...input.order]
    room.revision++
    return
  }
  if (action === 'suggest' || action === 'deck') {
    check(room.phase === 'lobby', 'Chỉ chỉnh bộ bài trước ván.')
    const list = action === 'suggest' ? suggestDeck(players(room).length) : input.deck
    const hiddenRole =
      action === 'suggest' ? 'villager' : input.drunkRole || room.drunkRole || 'villager'
    validateDeck(list, players(room).length, hiddenRole, room.cardsOnly)
    room.drunkRole = hiddenRole
    room.deck = [...list]
    room.revision++
    return
  }
  if (action === 'start') {
    check(
      room.phase === 'lobby' && players(room).length >= 5,
      'Cần ít nhất 5 người chơi, không tính quản trò.',
    )
    check(
      room.members.every((p) => p.connected && (p.host || p.ready)),
      'Chờ mọi người kết nối và sẵn sàng.',
    )
    validateDeck(room.deck, players(room).length, room.drunkRole, room.cardsOnly)
    const cards = shuffle(room.deck)
    players(room).forEach((p, i) =>
      Object.assign(p, {
        role: cards[i],
        originalRole: cards[i],
        hiddenRole: !room.cardsOnly && cards[i] === 'drunk' ? room.drunkRole : null,
        alive: true,
        seen: false,
        notes: [],
        used: {},
        silenced: false,
        lastGuard: null,
        publicRole: null,
        banished: false,
        woundDue: null,
        vampireDue: null,
        copyTarget: null,
        hoodlumTargets: [],
        followers: [],
        deathRound: null,
        blessedBy: null,
      }),
    )
    room.logs = []
    room.nightCheckpoint = null
    room.round = 0
    room.game++
    room.winner = null
    room.deaths = []
    room.lastSummary = ''
    room.lovers = []
    room.pendingHunters = []
    room.ghostClues = []
    room.doubleBiteNight = 0
    room.sickNight = 0
    room.executionsLeft = 1
    room.seatOrder = [
      ...(room.seatOrder || []).filter((id) => players(room).some((p) => p.id === id)),
      ...players(room)
        .filter((p) => !(room.seatOrder || []).includes(p.id))
        .map((p) => p.id),
    ]
    phase(room, 'countdown')
    room.deadline = now + 5000
    log(room, `Ván ${room.game}: chia ${cards.length} lá bài.`)
    return
  }
  if (action === 'next') {
    check(!room.cardsOnly, 'Phòng này chỉ chia bài; quản trò điều hành trực tiếp.')
    if (['dealt', 'day-end'].includes(room.phase)) {
      room.wolfTarget = room.healed = room.poisoned = room.shot = room.protected = null
      beginNight(room)
    } else if (room.phase === 'death-action') finishTurn(room)
    else if (room.phase === 'day-extra') {
      room.ballot = 0
      openNomination(room)
    } else if (room.phase === 'night') {
      if (room.turn) finishTurn(room)
      else {
        phase(room, 'dawn')
        room.deadline = now + 10000
      }
    } else if (room.phase === 'day') {
      room.ballot = 0
      openNomination(room)
    } else if (['nominate', 'verdict'].includes(room.phase)) finishBallot(room)
    else if (room.phase === 'defense') {
      room.votes = {}
      phase(room, 'verdict')
    } else throw new Error('Chưa thể chuyển giai đoạn.')
    return
  }
  if (action === 'rematch') {
    check(room.phase === 'ended', 'Ván chưa kết thúc.')
    players(room).forEach((p) =>
      Object.assign(p, {
        ready: false,
        role: null,
        alive: true,
        seen: false,
        notes: [],
        publicRole: null,
        silenced: false,
        banished: false,
      }),
    )
    room.logs = []
    room.nightCheckpoint = null
    room.winner = null
    room.turn = null
    room.decisions = {}
    room.votes = {}
    room.deaths = []
    room.round = 0
    room.lastSummary = ''
    phase(room, 'lobby')
    return
  }
  throw new Error('Thao tác không được hỗ trợ.')
}
export function view(room, viewer, now = Date.now()) {
  const canSeeRoles =
    (viewer.host && !['lobby', 'countdown', 'reveal'].includes(room.phase)) ||
    room.phase === 'ended'
  const isActor =
    ['night', 'death-action'].includes(room.phase) && room.turn?.actors.includes(viewer.id)
  const isPack = isActor && ['wolves', 'vampires'].includes(room.turn.key)
  const decision = room.decisions[viewer.id]
  const roster = room.members.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    host: p.host,
    connected: p.connected,
    ready: p.ready,
    alive: p.alive,
    seen: p.seen,
    silenced:
      p.silenced &&
      ['day', 'nominate', 'defense', 'verdict', 'day-end', 'day-extra'].includes(room.phase),
    banished:
      p.banished &&
      ['day', 'nominate', 'defense', 'verdict', 'day-end', 'day-extra'].includes(room.phase),
    wins: p.wins,
    losses: p.losses,
    role: canSeeRoles
      ? room.phase === 'ended' && !room.cardsOnly
        ? actualRole(p)
        : p.role
      : p.publicRole || null,
    hiddenRole: viewer.host && canSeeRoles ? p.hiddenRole || null : null,
    seat: (room.seatOrder || []).indexOf(p.id) + 1,
  }))
  return {
    code: room.code,
    revision: room.revision,
    phase: room.phase,
    cardsOnly: !!room.cardsOnly,
    canResetNight: !!(
      viewer.host &&
      !room.cardsOnly &&
      room.nightCheckpoint &&
      room.round > 0 &&
      room.phase !== 'lobby' &&
      room.nightCheckpoint.game === room.game &&
      room.nightCheckpoint.members.length === room.members.length &&
      room.nightCheckpoint.members.every((p) => room.members.some((current) => current.id === p.id))
    ),
    round: room.round,
    game: room.game,
    expires: room.expires,
    deadline: room.deadline,
    remainingMs: room.deadline ? Math.max(0, room.deadline - (room.pauseStarted || now)) : null,
    serverTime: now,
    host: viewer.host,
    myId: viewer.id,
    members: roster,
    paused: paused(room),
    waitingFor: viewer.host
      ? ['night', 'death-action'].includes(room.phase) && room.turn
        ? room.turn.actors.filter((id) => !room.decisions[id]?.confirmed)
        : ['nominate', 'verdict'].includes(room.phase)
          ? voters(room)
              .filter((p) => !Object.hasOwn(room.votes, p.id))
              .map((p) => p.id)
          : room.phase === 'reveal'
            ? players(room)
                .filter((p) => !p.seen)
                .map((p) => p.id)
            : []
      : [],
    deck: room.phase === 'lobby' ? room.deck : [],
    drunkRole: viewer.host && room.phase === 'lobby' ? room.drunkRole : null,
    seatOrder: (room.seatOrder || []).filter((id) => players(room).some((p) => p.id === id)),
    myRole:
      !viewer.host && !['lobby', 'countdown'].includes(room.phase)
        ? room.phase === 'ended' && !room.cardsOnly
          ? actualRole(viewer)
          : viewer.role
        : null,
    myWon:
      room.phase === 'ended' && !['manual', 'aborted'].includes(room.winner)
        ? (room.history[room.history.length - 1]?.players.find((p) => p.id === viewer.id)?.won ??
          null)
        : null,
    alive: viewer.alive,
    seen: viewer.seen,
    notes: viewer.host || viewer.alive || isActor ? viewer.notes : [],
    clues: room.ghostClues || [],
    canVote: !viewer.host && viewer.alive && !viewer.banished,
    voterCount: voters(room).length,
    current: room.turn
      ? {
          key: room.turn.key,
          total: room.turn.actors.length,
          confirmed: room.turn.actors.filter((id) => room.decisions[id]?.confirmed).length,
        }
      : null,
    action: isActor
      ? {
          key: room.turn.key,
          options: candidates(room, viewer),
          confirmed: !!decision?.confirmed,
          targets: decision?.targets || [],
          save: decision?.save || false,
          saveTarget: decision?.saveTarget || null,
          text: decision?.text || '',
          activate: decision?.activate || false,
          ...actionRules(room, viewer),
          used: viewer.used,
          wolfTarget: room.turn.key === 'witch' && !viewer.used.heal ? room.wolfTarget : null,
          wolfTargets:
            room.turn.key === 'witch' && !viewer.used.heal
              ? room.wolfTargets?.length
                ? room.wolfTargets
                : room.wolfTarget
                  ? [room.wolfTarget]
                  : []
              : [],
        }
      : null,
    choices:
      (viewer.host || isPack) && ['night', 'death-action'].includes(room.phase)
        ? Object.entries(room.decisions).map(([id, d]) => ({ id, ...d }))
        : [],
    nominee: ['defense', 'verdict', 'day-end'].includes(room.phase) ? room.nominee : null,
    eligible: room.phase === 'nominate' ? room.eligible : [],
    voted: Object.hasOwn(room.votes, viewer.id),
    vote: room.votes[viewer.id] ?? null,
    voteCount: ['nominate', 'verdict'].includes(room.phase) ? Object.keys(room.votes).length : 0,
    ballot: room.ballot,
    summary: ['day', 'day-end', 'day-extra', 'death-action', 'ended'].includes(room.phase)
      ? room.lastSummary
      : '',
    deaths: ['day', 'day-end', 'day-extra', 'death-action', 'ended'].includes(room.phase)
      ? room.deaths
      : [],
    winner: room.winner,
    logs: canSeeRoles ? room.logs : [],
    history: ['lobby', 'ended'].includes(room.phase) ? room.history : [],
  }
}
