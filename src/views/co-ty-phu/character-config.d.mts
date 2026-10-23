export interface CharacterConfig {
  skin: number
  hair: number
  shirt: number
  pants: number
  hairStyle: number
  face: number
  accessory: number
  shirtPattern: number
  shoes: number
  accessoryColor: number
}
export const characterRanges: Record<keyof CharacterConfig, number>
export const defaultCharacter: CharacterConfig
export function validateCharacter(value: CharacterConfig): CharacterConfig
export function characterKey(value: CharacterConfig): string
export function randomCharacter(random?: () => number): CharacterConfig
