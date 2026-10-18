import type { Role } from '../types'
export function deckSlots(deck: string[], count: number): (string | null)[] {
  return Array.from({ length: count }, (_, index) => deck[index] || null)
}
export function canReplaceCard(
  deck: (string | null)[],
  index: number,
  role: Role,
  cardsOnly = false,
) {
  return (
    (role.enabled || cardsOnly) &&
    role.team !== 'utility' &&
    index >= 0 &&
    index < deck.length &&
    deck.filter((id, slot) => slot !== index && id === role.id).length < role.quantity
  )
}
export function replaceCard(deck: (string | null)[], index: number, role: Role, cardsOnly = false) {
  if (!canReplaceCard(deck, index, role, cardsOnly)) return deck
  return deck.map((id, slot) => (slot === index ? role.id : id))
}
