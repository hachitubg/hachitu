import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import jiti from 'jiti'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const VIEWS = join(ROOT, 'src', 'views')

const SITE_NAME = 'HACHITU'
const SITE_URL = 'https://hachitu.example'
const DEFAULT_TITLE = `${SITE_NAME} - Personal Mini-App Launcher`
const DEFAULT_DESCRIPTION =
  'HACHITU là starter launcher cá nhân cho nhiều mini-app với Vue 3, TypeScript, Vite và Tailwind CSS v4.'

const staticRoutes = [
  {
    path: '/bookmarks',
    title: 'Yêu thích - HACHITU',
    description: 'Danh sách các mini-app bạn đã lưu lại trong HACHITU.',
  },
]

function collectPageMeta() {
  const loadTs = jiti(import.meta.url, { interopDefault: true })
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

    pages.push({
      path: `/${entry}`,
      title: `${meta.name} - ${SITE_NAME}`,
      description: meta.description,
    })
  }

  return pages
}

function buildMetaTags({ title, description, path }) {
  const url = `${SITE_URL}${path}`
  return [
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
    `<meta property="og:description" content="${escapeAttr(description)}" />`,
    `<meta property="og:url" content="${escapeAttr(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
  ].join('\n    ')
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function injectMeta(template, route) {
  let html = template

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(route.title)}</title>`)
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeAttr(route.description)}">`,
  )

  const ogTags = buildMetaTags(route)
  html = html.replace('</head>', `    ${ogTags}\n  </head>`)

  return html
}

const template = readFileSync(join(DIST, 'index.html'), 'utf-8')
const dynamicPages = collectPageMeta()
const allRoutes = [...dynamicPages, ...staticRoutes]

const homepageRoute = { path: '/', title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }
writeFileSync(join(DIST, 'index.html'), injectMeta(template, homepageRoute))

let count = 0
for (const route of allRoutes) {
  const dir = join(DIST, route.path.slice(1))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), injectMeta(template, route))
  count++
}

console.log(`[generate-og-pages] Generated OG tags for ${count} routes + homepage`)
