export interface Tile {
  id: number
  name: string
  kind: string
  group?: string
  price?: number
  houseCost?: number
  rents?: number[]
  amount?: number
}
export interface Player {
  id: string
  name: string
  token: string
  connected: boolean
  ready: boolean
  cash: number
  worth: number
  position: number
  jail: boolean
  jailTurns: number
  jailCards: number
  bankrupt: boolean
}
export interface Property {
  id: number
  owner: string | null
  level: number
  mortgaged: boolean
}
export interface Settings {
  startingCash: number
  timeLimit: number
  parkingPot: boolean
  doubleGo: boolean
}
export interface Trade {
  from: string
  to: string
  give: number[]
  take: number[]
  giveCash: number
  receiveCash: number
}
export interface GameState {
  code: string
  myId: string
  hostId: string
  revision: number
  phase: string
  players: Player[]
  board: Tile[]
  properties: Property[]
  settings: Settings
  turn: number
  turnNumber: number
  dice: number[]
  again: boolean
  paused: boolean
  houses: number
  hotels: number
  pot: number
  logs: string[]
  winnerIds: string[]
  debt: { from: string; to: string | null; amount: number; reason: string } | null
  auction: {
    tileId: number
    high: number
    bidder: string | null
    actor: string
    passed: string[]
  } | null
  trade: Trade | null
  card: { kind: string; text: string } | null
}
export interface Session {
  code: string
  id: string
  secret: string
}
export interface Input {
  name?: string
  token?: string
  code?: string
  id?: string
  secret?: string
  revision?: number
  tileId?: number
  amount?: number
  startingCash?: number
  timeLimit?: number
  parkingPot?: boolean
  doubleGo?: boolean
  to?: string
  give?: number[]
  take?: number[]
  giveCash?: number
  receiveCash?: number
  accept?: boolean
}
export interface Reply {
  ok: boolean
  error?: string
  code?: string
  session?: Session
}
export const tokens = [
  { id: 'car', icon: 'lucide:car', name: 'Siêu xe' },
  { id: 'cat', icon: 'lucide:cat', name: 'Mèo may mắn' },
  { id: 'ship', icon: 'lucide:ship', name: 'Du thuyền' },
  { id: 'rocket', icon: 'lucide:rocket', name: 'Tên lửa' },
  { id: 'bike', icon: 'lucide:bike', name: 'Xe đạp' },
  { id: 'crown', icon: 'lucide:crown', name: 'Vương miện' },
]
export const tokenIcon = (id: string) => tokens.find((t) => t.id === id)?.icon || 'lucide:car'
export const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value)
