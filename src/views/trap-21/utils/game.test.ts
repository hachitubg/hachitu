import { describe, expect, it } from 'vitest'
import { chooseBotMove, newRound, takeTurn, TARGET } from './game'

describe('Bẫy 21', () => {
  it('alternates players and records the claimed numbers', () => {
    const first = takeTurn(newRound(), 3)
    const second = takeTurn(first, 2)
    expect(first.total).toBe(3)
    expect(second.current).toBe(0)
    expect(second.moves).toEqual([
      { player: 0, from: 1, to: 3 },
      { player: 1, from: 4, to: 5 },
    ])
    expect(first.moves).toHaveLength(1)
  })

  it('awards the opponent when someone reaches 21 and locks the round', () => {
    let round = newRound()
    for (let i = 0; i < 7; i++) round = takeTurn(round, 3)
    expect(round.total).toBe(TARGET)
    expect(round.winner).toBe(1)
    expect(takeTurn(round, 1)).toBe(round)
  })

  it('rejects illegal moves, including overshooting the trap', () => {
    const round = { ...newRound(), total: 20 }
    for (const amount of [0, -1, 2, 3, 4, 1.5, NaN]) expect(takeTurn(round, amount)).toBe(round)
    expect(takeTurn(round, 1).winner).toBe(1)
  })

  it('allows either player to start a fresh round', () => {
    expect(takeTurn(newRound(1), 2).current).toBe(0)
    expect(newRound(1).moves).toEqual([])
  })

  it('always chooses a legal move and avoids 21 unless forced', () => {
    for (let total = 0; total < TARGET; total++) {
      for (const sample of [0, 0.5, 0.9, 0.99999]) {
        const move = chooseBotMove(total, () => sample)
        expect(move).toBeGreaterThanOrEqual(1)
        expect(move).toBeLessThanOrEqual(3)
        expect(total + move).toBeLessThanOrEqual(total === 20 ? TARGET : TARGET - 1)
      }
    }
    expect(chooseBotMove(17, () => 0)).toBe(3)
  })
})
