import { createInterface } from 'node:readline/promises'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { stdin, stdout, argv, exit } from 'node:process'
import { parseArgs } from 'node:util'

const VIEWS_DIR = resolve(import.meta.dirname, '..', 'src', 'views')
const VALID_CATEGORIES = [
  'game',
  'tool',
  'creative',
  'fun',
  'learn',
  'health',
  'finance',
  'spiritual',
  'connect',
  'other',
]
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const { values: flags, positionals } = parseArgs({
  args: argv.slice(2),
  options: {
    name: { type: 'string' },
    description: { type: 'string' },
    author: { type: 'string' },
    facebook: { type: 'string' },
    category: { type: 'string' },
    'hide-toolbar': { type: 'boolean' },
  },
  allowPositionals: true,
})

const slug = positionals[0]

if (!slug) {
  console.error(
    'Usage: pnpm create:page <slug> [--name "..."] [--description "..."] [--author "..."] [--category game|tool|creative|fun|learn|health|finance|spiritual|connect|other] [--facebook "..."] [--hide-toolbar]',
  )
  exit(1)
}

if (!KEBAB_RE.test(slug)) {
  console.error(`Invalid slug "${slug}". Use lowercase kebab-case (e.g. my-cool-app).`)
  exit(1)
}

const pageDir = join(VIEWS_DIR, slug)

if (existsSync(pageDir)) {
  console.error(`Page "${slug}" already exists at src/views/${slug}/`)
  exit(1)
}

if (flags.category && !VALID_CATEGORIES.includes(flags.category)) {
  console.error(
    `Invalid category "${flags.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
  )
  exit(1)
}

async function main() {
  let { name, description, author, facebook, category } = flags

  const needsPrompt = !name || !description || !author || !category
  const rl = needsPrompt ? createInterface({ input: stdin, output: stdout }) : null

  try {
    if (!name) {
      name = (await rl.question('Display name: ')).trim()
      if (!name) {
        console.error('Display name is required.')
        exit(1)
      }
    }

    if (!description) {
      description = (await rl.question('Description: ')).trim()
      if (!description) {
        console.error('Description is required.')
        exit(1)
      }
    }

    if (!author) {
      author = (await rl.question('Author: ')).trim()
      if (!author) {
        console.error('Author is required.')
        exit(1)
      }
    }

    if (facebook === undefined && rl) {
      facebook = (await rl.question('Facebook URL (optional): ')).trim()
    }

    if (!category) {
      category = ''
      while (!VALID_CATEGORIES.includes(category)) {
        category = (await rl.question(`Category (${VALID_CATEGORIES.join('|')}): `)).trim()
      }
    }
  } finally {
    rl?.close()
  }

  const facebookLine = facebook ? `\n  facebook: '${facebook}',` : ''
  const showToolbarLine = flags['hide-toolbar'] ? '\n  showToolbar: false,' : ''
  const metaContent = `import type { PageMeta } from '@/types/page'

const meta: PageMeta = {
  name: '${name}',
  description: '${description}',
  author: '${author}',${facebookLine}
  category: '${category}',${showToolbarLine}
}

export default meta
`

  const vueContent = `<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <h1 class="font-display text-4xl sm:text-6xl font-bold text-accent-coral animate-fade-up">
        ${name}
      </h1>
      <p class="mt-4 max-w-2xl text-base sm:text-lg text-text-secondary animate-fade-up animate-delay-2">
        ${description}
      </p>

      <div class="mt-10 border border-border-default bg-bg-surface p-6 animate-fade-up animate-delay-3">
        <p class="text-sm text-text-secondary">
          Bắt đầu xây mini-app của bạn tại đây.
        </p>
      </div>

      <RouterLink
        to="/"
        class="mt-8 inline-flex items-center gap-2 border border-border-default bg-bg-surface px-5 py-2.5 text-sm text-text-secondary transition hover:border-accent-coral hover:text-text-primary animate-fade-up animate-delay-4"
      >
        <Icon icon="lucide:arrow-left" class="size-4" />
        Về trang chủ
      </RouterLink>
    </div>
  </div>
</template>
`

  mkdirSync(pageDir, { recursive: true })
  writeFileSync(join(pageDir, 'meta.ts'), metaContent)
  writeFileSync(join(pageDir, 'index.vue'), vueContent)

  console.log(`\nPage created at src/views/${slug}/`)
  console.log('  - meta.ts')
  console.log('  - index.vue')
  console.log(`\nRun "pnpm dev" and visit /${slug} to see your page.`)
}

main()
