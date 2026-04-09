/**
 * Generates public/data/pages.json from all src/views/[slug]/meta.ts files.
 */

import { writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import jiti from 'jiti'

const ROOT = resolve(import.meta.dirname, '..')
const VIEWS = join(ROOT, 'src', 'views')
const OUT = join(ROOT, 'public', 'data', 'pages.json')

const featuredPaths = ['/hello-world']

export async function generatePagesJson() {
  const loadTs = jiti(import.meta.url, { interopDefault: true })
  const featuredIndex = new Map(featuredPaths.map((p, i) => [p, i]))

  const pages = []
  for (const entry of readdirSync(VIEWS)) {
    const metaPath = join(VIEWS, entry, 'meta.ts')
    try {
      statSync(metaPath)
    } catch {
      continue
    }
    const raw = loadTs(metaPath)
    const meta = raw?.default ?? raw
    if (!meta?.name || meta.hidden) continue
    const isFeatured = featuredPaths.includes(`/${entry}`)
    pages.push({ ...meta, path: `/${entry}`, ...(isFeatured && { featured: true }) })
  }

  pages.sort((a, b) => {
    const aIdx = featuredIndex.get(a.path) ?? Infinity
    const bIdx = featuredIndex.get(b.path) ?? Infinity
    if (aIdx !== bIdx) return aIdx - bIdx
    return a.name.localeCompare(b.name)
  })

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(pages))
  console.log(`[generate-pages-json] Written ${pages.length} pages to public/data/pages.json`)
}

if (process.argv[1] === import.meta.filename) {
  await generatePagesJson()
}
