export type Player = 0 | 1
export interface Move {
  player: Player
  from: number
  to: number
}
export interface Round {
  total: number
  current: Player
  winner: Player | null
  moves: Move[]
}

export const TARGET = 21
export const WIN_TARGET = 3

export function newRound(starter: Player = 0): Round {
  return { total: 0, current: starter, winner: null, moves: [] }
}

export function takeTurn(round: Round, amount: number): Round {
  if (round.winner !== null || !Number.isInteger(amount) || amount < 1 || amount > 3) return round
  const total = round.total + amount
  if (total > TARGET) return round
  const opponent: Player = round.current === 0 ? 1 : 0
  return {
    total,
    current: opponent,
    winner: total === TARGET ? opponent : null,
    moves: [...round.moves, { player: round.current, from: round.total + 1, to: total }],
  }
}

export function chooseBotMove(total: number, random = Math.random): number {
  const safeMax = Math.min(3, TARGET - 1 - total)
  if (safeMax < 1) return 1
  const strategic = (TARGET - 1 - total) % 4
  // A fallible opponent leaves room to learn and win without a difficulty menu.
  if (strategic > 0 && random() < 0.65) return strategic
  return Math.min(safeMax, 1 + Math.floor(random() * safeMax))
}
