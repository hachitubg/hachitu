import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '..')
const targets = [
  resolve(rootDir, '.wrangler', 'state'),
  resolve(rootDir, '.wrangler', 'tmp'),
]

for (const target of targets) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true })
    console.log(`Removed ${target}`)
  }
}
