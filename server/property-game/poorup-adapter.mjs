import { BOARD } from './board.mjs'
import {
  canBuildOnTile,
  canMortgageTile,
  canSellFromTile,
  canUnmortgageTile,
} from '../../vendor/poorup/server/propertyRules.js'

export function propertyEligibility(room, player, tileId) {
  const tiles = room.properties.map((a) => ({
    index: a.id,
    type: { street: 'property', station: 'railroad', utility: 'utility' }[BOARD[a.id].kind],
    ownerId: a.owner,
    group: BOARD[a.id].group,
    houseCount: a.level,
    mortgaged: a.mortgaged,
  }))
  const game = {
    tiles,
    settings: { evenBuild: true, mortgage: true, houseLimit: 32, hotelLimit: 12 },
    isConstructionBlocked: () => false,
    isLoanCollateral: () => false,
    isPlayerContractCollateral: () => false,
    globalEventActive: () => false,
    activeEventEffects: () => ({}),
    getPlayerById: (id) => room.players.find((p) => p.id === id),
    getGroupTiles: (group) => (group ? tiles.filter((t) => t.group === group) : []),
    hasFullSet: (id, group) =>
      !!group && tiles.filter((t) => t.group === group).every((t) => t.ownerId === id),
  }
  const tile = tiles.find((t) => t.index === tileId)
  return {
    build: canBuildOnTile(game, player, tile),
    sell: canSellFromTile(game, player, tile),
    mortgage: canMortgageTile(game, player, tile),
    redeem: canUnmortgageTile(game, player, tile),
  }
}
