export const characterRanges = {
  skin: 4,
  hair: 8,
  shirt: 8,
  pants: 8,
  hairStyle: 11,
  face: 8,
  accessory: 9,
  shirtPattern: 6,
  shoes: 6,
  accessoryColor: 6,
}
export const defaultCharacter = {
  skin: 1,
  hair: 0,
  shirt: 0,
  pants: 0,
  hairStyle: 0,
  face: 1,
  accessory: 0,
  shirtPattern: 0,
  shoes: 0,
  accessoryColor: 0,
}
export function validateCharacter(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== Object.keys(characterRanges).length
  )
    throw Error('Cấu hình nhân vật không hợp lệ.')
  const result = {}
  for (const [key, count] of Object.entries(characterRanges)) {
    if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] >= count)
      throw Error('Cấu hình nhân vật không hợp lệ.')
    result[key] = value[key]
  }
  return result
}
export function characterKey(value) {
  const c = validateCharacter(value)
  if (c.hairStyle === 3) c.hair = 0
  if (![3, 4, 5].includes(c.accessory)) c.accessoryColor = 0
  return Object.keys(characterRanges)
    .map((key) => c[key])
    .join(':')
}
export function randomCharacter(random = Math.random) {
  return Object.fromEntries(
    Object.entries(characterRanges).map(([key, count]) => [key, Math.floor(random() * count)]),
  )
}
