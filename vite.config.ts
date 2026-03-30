import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createDevApiApp } from './scripts/dev-api-app.js'

/** Em dev e preview, serve /api/* no mesmo processo do Vite (sem depender da porta 3001). */
function devApiMiddlewarePlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      const app = createDevApiApp()
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''
        if (!pathname.startsWith('/api')) return next()
        app(req, res, next)
      })
    },
    configurePreviewServer(server) {
      const app = createDevApiApp()
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''
        if (!pathname.startsWith('/api')) return next()
        app(req, res, next)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [devApiMiddlewarePlugin(), react()],
  server: {
    headers: {
      // Permite que o popup do Google OAuth converse com a janela que o abriu (evita erro COOP no console).
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
