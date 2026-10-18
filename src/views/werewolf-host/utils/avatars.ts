export const avatarStyles = [
  { id: 'adventurer', name: 'Phiêu lưu' },
  { id: 'bottts', name: 'Robot' },
  { id: 'lorelei', name: 'Chân dung' },
  { id: 'pixel-art', name: 'Pixel' },
  { id: 'fun-emoji', name: 'Biểu cảm' },
] as const
export type AvatarStyle = (typeof avatarStyles)[number]['id']
const descriptor = /^dicebear:(adventurer|bottts|lorelei|pixel-art|fun-emoji):([a-f0-9]{32})$/
export function randomAvatar(style: AvatarStyle = 'adventurer') {
  return `dicebear:${style}:${crypto.randomUUID().replace(/-/g, '')}`
}
export function avatarUrl(value: string) {
  const match = descriptor.exec(value)
  if (match) return `https://api.dicebear.com/10.x/${match[1]}/svg?seed=${match[2]}`
  if (/^preset:(?:[0-9]|1[0-5])$/.test(value))
    return `https://api.dicebear.com/10.x/bottts/svg?seed=hachitu-legacy-${value.slice(7)}`
  if (value.length < 65000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))
    return value
  return ''
}
