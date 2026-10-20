export interface Role {
  id: string
  name_vi: string
  name_en: string
  team: string
  balance_points: number | null
  quantity: number
  ability_vi: string
  win_condition_vi: string
  notes_vi: string
  wake_up: string
  enabled: boolean
  set: string
  setId?: string
  guide_vi?: string
  drunkEligible?: boolean
}
export interface Member {
  id: string
  name: string
  avatar: string
  host: boolean
  ready: boolean
  connected: boolean
  alive: boolean
  seen: boolean
  silenced: boolean
  banished: boolean
  hiddenRole: string | null
  seat: number
  wins: number
  losses: number
  role: string | null
}
export interface Log {
  at: number
  round: number
  phase: string
  message: string
}
export interface History {
  game: number
  winner: string
  logs: Log[]
  players: {
    id: string
    name: string
    avatar?: string
    role: string
    originalRole?: string
    won: boolean
    alive: boolean
  }[]
}
export interface RoomState {
  teenChecks?: { id: string; spoken: boolean | null }[]
  cardsOnly: boolean
  canResetNight: boolean
  code: string
  revision: number
  phase: string
  round: number
  game: number
  expires: number
  deadline: number | null
  remainingMs: number | null
  serverTime: number
  host: boolean
  myId: string
  members: Member[]
  paused: boolean
  waitingFor: string[]
  deck: string[]
  drunkRole: string | null
  seatOrder: string[]
  myRole: string | null
  myWon: boolean | null
  canVote: boolean
  voterCount: number
  clues: { round: number; letter: string }[]
  alive: boolean
  seen: boolean
  notes: string[]
  current: { key: string; total: number; confirmed: number } | null
  action: {
    key: string
    options: string[]
    confirmed: boolean
    targets: string[]
    save: boolean
    saveTarget: string | null
    redirectFrom?: string | null
    text: string
    activate: boolean
    max: number
    min?: number
    adjacentPair?: boolean
    pairs?: string[][]
    optional: boolean
    kind: 'targets' | 'letter' | 'activate'
    used: Record<string, boolean>
    wolfTarget: string | null
    wolfTargets: string[]
  } | null
  choices: {
    id: string
    targets: string[]
    save: boolean
    saveTarget?: string | null
    redirectFrom?: string | null
    text?: string
    activate?: boolean
    confirmed: boolean
  }[]
  nominee: string | null
  eligible: string[]
  voted: boolean
  vote: string | boolean | null
  voteCount: number
  ballot: number
  summary: string
  deaths: string[]
  winner: string | null
  logs: Log[]
  history: History[]
}
export interface Session {
  code: string
  id: string
  token: string
}
export interface Reply {
  ok: boolean
  error?: string
  code?: string
  session?: Session
}
export interface Input {
  cardsOnly?: boolean
  playerId?: string
  revision?: number
  name?: string
  avatar?: string
  code?: string
  id?: string
  token?: string
  deck?: string[]
  drunkRole?: string
  order?: string[]
  targets?: string[]
  save?: boolean
  saveTarget?: string | null
  redirectFrom?: string | null
  spoken?: boolean
  text?: string
  activate?: boolean
  vote?: string | boolean | null
}
export const artIds = [
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
]
export function artStyle(id: string | number) {
  const expansion = [
    'big_bad_wolf',
    'dire_wolf',
    'fruit_brute',
    'fang_face',
    'wolverine',
    'virginia_woolf',
    'mad_bomber',
    'mentalist',
    'revealer',
    'mystic_seer',
    'huntress',
    'alpha_wolf',
    'martyr',
    'old_man',
    'time_bandit',
    'sasquatch',
    'nostradamus',
    'bloody_mary',
    'leprechaun',
    'chupacabra',
    'beholder',
    'the_count',
    'insomniac',
    'the_thing',
    'dream_wolf',
    'bogeyman',
    'frankenstein',
    'blob',
    'zombie',
    'count_dracula',
    'the_mummy',
    'teenage_werewolf',
  ]
  const expansionIndex = typeof id === 'string' ? expansion.indexOf(id) : -1
  if (expansionIndex >= 0)
    return {
      backgroundImage: 'url(/werewolf-host/expansion.webp)',
      backgroundSize: '825% 425%',
      backgroundPosition: `${((expansionIndex % 8) * 100) / 7}% ${(Math.floor(expansionIndex / 8) * 100) / 3}%`,
    }
  const extra = [
    'apprentice_seer',
    'cult_leader',
    'cupid',
    'cursed',
    'diseased',
    'doppelganger',
    'drunk',
    'ghost',
    'hunter',
    'lone_wolf',
    'old_hag',
    'pi',
    'tanner',
    'tough_guy',
    'vampire',
    'wolf_cub',
    'hoodlum',
    'troublemaker',
    'priest',
  ]
  const extraIndex = typeof id === 'string' ? extra.indexOf(id) : -1
  if (extraIndex >= 0)
    return {
      backgroundImage: 'url(/werewolf-host/basic-extra.webp)',
      backgroundSize: '525% 425%',
      backgroundPosition: `${(extraIndex % 5) * 25}% ${(Math.floor(extraIndex / 5) * 100) / 3}%`,
    }
  const index = typeof id === 'number' ? id : Math.max(0, artIds.indexOf(id))
  return {
    backgroundImage: 'url(/werewolf-host/roles.webp)',
    backgroundSize: '425% 425%',
    backgroundPosition: `${[1, 34, 66, 99][index % 4]}% ${[0.7, 32.8, 64.5, 97.5][Math.floor(index / 4)]}%`,
  }
}
export const phaseNames: Record<string, string> = {
  martyr: 'Quyết định của Kẻ tử đạo',
  'teen-review': 'Kiểm tra điều kiện cuối ngày',
  manual: 'Ván đang diễn ra',
  lobby: 'Chuẩn bị buổi chơi',
  countdown: 'Chia bài',
  reveal: 'Nhận lá bài bí mật',
  dealt: 'Cả làng đã sẵn sàng',
  night: 'Đêm xuống',
  dawn: 'Bình minh',
  day: 'Cả làng thảo luận',
  nominate: 'Chọn người giải thích',
  defense: 'Lời biện hộ',
  verdict: 'Biểu quyết treo cổ',
  'day-end': 'Khép lại một ngày',
  'day-extra': 'Phiên biểu quyết thứ hai',
  'death-action': 'Phát bắn của Thợ săn',
  ended: 'Hạ màn',
}
export const teamNames: Record<string, string> = {
  village: 'Phe Dân làng',
  werewolf: 'Phe Sói',
  vampire: 'Phe Ma cà rồng',
  independent: 'Thắng riêng',
  switching: 'Có thể đổi phe',
  lovers: 'Cặp đôi khác phe',
  lone_wolf: 'Sói đơn độc',
  draw: 'Không phe nào sống sót',
  aborted: 'Ván đã hủy',
  utility: 'Lá phụ trợ',
}
export function winnerTitle(winner: string | null) {
  if (winner === 'manual') return 'Quản trò đã kết thúc ván'
  return winner === 'aborted'
    ? 'Ván chơi đã được hủy'
    : winner === 'draw'
      ? 'Không phe nào sống sót'
      : `${teamNames[winner || ''] || 'Kết thúc ván'} chiến thắng`
}
