import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { pageComponents } from '@/data/pages-loader'
import { usePagesStore } from '@/stores/usePagesStore'
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore'
import type { PageInfo } from '@/types/page'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    description?: string
    author?: string
    showToolbar?: boolean
    pagePath?: string
  }
}

const HomePage = () => import('@/views/HomePage.vue')
const BookmarksPage = () => import('@/views/BookmarksPage.vue')
const CategoryPage = () => import('@/views/CategoryPage.vue')
const NotFound = () => import('@/views/NotFound.vue')

function buildPageRoutes(pages: PageInfo[]): RouteRecordRaw[] {
  return pages.map((page) => {
    const componentPath = `/src/views${page.path}/index.vue`
    const loader = pageComponents[componentPath]
    if (!loader) {
      console.warn(`[router] No component found for page "${page.name}" at ${componentPath}`)
    }
    return {
      path: page.path,
      name: page.path.slice(1),
      component: loader ? () => loader() : NotFound,
      meta: {
        title: `${page.name} - HACHITU`,
        description: page.description,
        author: page.author,
        showToolbar: page.showToolbar !== false,
        pagePath: page.path,
      },
    }
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (to, _from, savedPosition) => {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
      meta: {
        title: 'HACHITU - Personal Mini-App Launcher',
        description:
          'Bộ launcher cá nhân cho các mini-app, công cụ nhỏ và playground được xây với Vue 3, TypeScript và Tailwind CSS.',
      },
    },
    {
      path: '/bookmarks',
      name: 'bookmarks',
      component: BookmarksPage,
      meta: {
        title: 'Yêu thích - HACHITU',
        description: 'Danh sách các mini-app bạn đã lưu lại trong HACHITU.',
      },
    },
    {
      path: '/category/:id',
      name: 'category',
      component: CategoryPage,
      meta: {
        title: 'Danh mục - HACHITU',
        description: 'Khám phá mini-app trong HACHITU theo từng danh mục.',
      },
    },
  ],
})

let pagesInitialized = false

router.beforeEach(async (to) => {
  if (!pagesInitialized) {
    const store = usePagesStore()
    await store.init()

    for (const route of buildPageRoutes(store.pages)) {
      router.addRoute(route)
    }

    router.addRoute({
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFound,
      meta: {
        title: '404 - Không tìm thấy trang | HACHITU',
        description: 'Trang bạn tìm không tồn tại trong HACHITU.',
      },
    })

    pagesInitialized = true

    if (to.matched.length === 0) {
      return to.fullPath
    }
  }
})

export function handleChunkError(error: Error, to: { fullPath: string }) {
  const isChunkError =
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.name === 'ChunkLoadError'

  if (!isChunkError) return

  const reloadKey = `chunk-reload:${to.fullPath}`
  if (sessionStorage.getItem(reloadKey)) return
  sessionStorage.setItem(reloadKey, '1')
  window.location.href = to.fullPath
}

router.afterEach((to) => {
  const pagePath = to.meta.pagePath
  if (typeof pagePath !== 'string') return
  useRecentlyViewedStore().addVisit(pagePath)
})

router.onError((error, to) => {
  if (!to) return
  handleChunkError(error, to)
})

export default router
