import { writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import jiti from 'jiti'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const VIEWS = join(ROOT, 'src', 'views')
const SITEMAPS_DIR = join(DIST, 'sitemaps')

const SITE_URL = 'https://hachitu.example'
const TODAY = new Date().toISOString().split('T')[0]

function collectPages() {
  const loadTs = jiti(import.meta.url, { interopDefault: true })
  const apps = []

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
    apps.push(`/${entry}`)
  }

  return { apps }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildUrlset(urls) {
  const entries = urls
    .map(
      ({ loc, changefreq, priority }) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

function buildSitemapIndex(sitemaps) {
  const entries = sitemaps
    .map(
      (name) =>
        `  <sitemap>\n    <loc>${SITE_URL}/sitemaps/${name}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </sitemap>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`
}

const CATEGORIES = [
  'game',
  'fun',
  'tool',
  'learn',
  'spiritual',
  'creative',
  'connect',
  'health',
  'finance',
  'other',
]

const { apps } = collectPages()
mkdirSync(SITEMAPS_DIR, { recursive: true })

const sitemaps = [
  {
    name: 'main.xml',
    urls: [
      { loc: SITE_URL, changefreq: 'daily', priority: '1.0' },
      { loc: `${SITE_URL}/bookmarks`, changefreq: 'monthly', priority: '0.3' },
      ...CATEGORIES.map((id) => ({
        loc: `${SITE_URL}/category/${id}`,
        changefreq: 'weekly',
        priority: '0.6',
      })),
    ],
  },
  {
    name: 'apps.xml',
    urls: apps.map((path) => ({
      loc: `${SITE_URL}${path}`,
      changefreq: 'weekly',
      priority: '0.8',
    })),
  },
]

for (const { name, urls } of sitemaps) {
  writeFileSync(join(SITEMAPS_DIR, name), buildUrlset(urls))
  console.log(`[generate-sitemap] ${name}: ${urls.length} URLs`)
}

const totalUrls = sitemaps.reduce((sum, sitemap) => sum + sitemap.urls.length, 0)
writeFileSync(join(DIST, 'sitemap.xml'), buildSitemapIndex(sitemaps.map((sitemap) => sitemap.name)))
console.log(`[generate-sitemap] sitemap.xml index -> ${sitemaps.length} sitemaps, ${totalUrls} URLs total`)
