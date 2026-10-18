import { describe, expect, it } from 'vitest'
import { deckSlots, canReplaceCard, replaceCard } from './deck-editor'
import { nightJournal, sessionStandings } from './journal'
import { avatarUrl, randomAvatar } from './avatars'
import type { Role, History, Log, Member } from '../types'

const role = (id: string, quantity: number, enabled = true) => ({ id, quantity, enabled }) as Role
describe('selected deck replacement', () => {
  it('replaces one physical slot, keeping duplicates and total size', () => {
    const original = ['werewolf', 'villager', 'villager', 'seer', 'bodyguard']
    const next = replaceCard(original, 1, role('witch', 1))
    expect(next).toEqual(['werewolf', 'witch', 'villager', 'seer', 'bodyguard'])
    expect(original[1]).toBe('villager')
    expect(next.length).toBe(original.length)
  })
  it('counts quantities excluding the slot being replaced, and blocks deferred roles', () => {
    const cards = ['werewolf', 'seer', 'villager']
    expect(canReplaceCard(cards, 1, role('seer', 1))).toBe(true)
    expect(canReplaceCard(cards, 2, role('seer', 1))).toBe(false)
    expect(canReplaceCard(cards, 2, role('ghost', 1, false))).toBe(false)
    expect(replaceCard(cards, -1, role('witch', 1))).toBe(cards)
  })
  it('creates exactly one editable slot per player even before a suggestion', () => {
    expect(deckSlots([], 5)).toEqual([null, null, null, null, null])
    expect(deckSlots(['werewolf', 'villager'], 3)).toEqual(['werewolf', 'villager', null])
  })
})

describe('journal and independent standings', () => {
  it('groups night actions and dawn results, without mixing daytime votes into a night', () => {
    const logs: Log[] = [
      { at: 1, round: 0, phase: 'countdown', message: 'Chia bài' },
      { at: 2, round: 1, phase: 'night', message: 'Sói chọn mục tiêu' },
      { at: 3, round: 1, phase: 'dawn', message: 'Không ai chết' },
      { at: 4, round: 1, phase: 'verdict', message: 'Treo cổ' },
      { at: 5, round: 2, phase: 'night', message: 'Bảo vệ chọn mục tiêu' },
    ]
    expect(nightJournal(logs)).toEqual([
      { round: 2, entries: [logs[4]] },
      { round: 1, entries: [logs[1], logs[2]] },
    ])
  })
  it('keeps departed players in standings, excludes aborted games and avoids double counting', () => {
    const game: History = {
      game: 1,
      winner: 'village',
      logs: [],
      players: [
        { id: 'a', name: 'An', role: 'seer', won: true, alive: true },
        { id: 'b', name: 'Bình', avatar: 'preset:2', role: 'werewolf', won: false, alive: false },
      ],
    }
    const members = [
      { id: 'host', host: true, wins: 0, losses: 0 },
      { id: 'a', host: false, name: 'An', avatar: 'preset:1', wins: 1, losses: 0 },
    ] as Member[]
    const result = sessionStandings(members, [
      game,
      { ...game, game: 2, winner: 'aborted' },
      { ...game, game: 3, winner: 'manual' },
    ])
    expect(result).toHaveLength(2)
    expect(result.find((p) => p.id === 'a')).toMatchObject({ wins: 1, losses: 0, present: true })
    expect(result.find((p) => p.id === 'b')).toMatchObject({
      wins: 0,
      losses: 1,
      present: false,
      avatar: 'preset:2',
    })
  })
})

describe('avatar descriptors', () => {
  it('generates new random identities and sends only their seed to DiceBear', () => {
    const values = new Set(Array.from({ length: 40 }, () => randomAvatar('bottts')))
    expect(values.size).toBe(40)
    for (const value of values)
      expect(avatarUrl(value)).toMatch(
        /^https:\/\/api\.dicebear\.com\/10\.x\/bottts\/svg\?seed=[a-f0-9]{32}$/,
      )
  })
  it('rejects arbitrary external URLs and SVG uploads instead of rendering untrusted source', () => {
    expect(avatarUrl('https://evil.example/image.svg')).toBe('')
    expect(avatarUrl('data:image/svg+xml;base64,aaaa')).toBe('')
    expect(avatarUrl('dicebear:../evil:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe('')
    expect(avatarUrl('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA')
  })
})
