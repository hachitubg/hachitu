import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
// @ts-expect-error Local ESM build script does not ship TypeScript declarations
import { generatePagesJson } from './scripts/generate-pages-json.mjs'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
      },
      '/api/chat': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/apps/chat-online': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/api/game': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    {
      name: 'pages-json-generator',
      async buildStart() {
        await generatePagesJson()
      },
      configureServer(server) {
        server.watcher.on('all', async (_event, file) => {
          if (file.includes('/views/') && file.endsWith('/meta.ts')) {
            await generatePagesJson()
            server.ws.send({ type: 'full-reload' })
          }
        })
      },
    },
    process.env.ANALYZE === 'true' &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'vueuse-vendor': ['@vueuse/core'],
          'iconify-vendor': ['@iconify/vue'],
          'unhead-vendor': ['@unhead/vue'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
