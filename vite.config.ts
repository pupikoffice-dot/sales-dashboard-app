import fs from 'fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const dashboardDataPath = path.resolve(__dirname, '../data_loader.js')

/** Dev-only: serve freshly exported data_loader.js from Dashboard/ (not GitHub CDN). */
function dashboardDataDevPlugin(): Plugin {
  return {
    name: 'dashboard-data-dev',
    configureServer(server) {
      server.middlewares.use('/dev-data/data_loader.js', (_req, res, next) => {
        if (!fs.existsSync(dashboardDataPath)) {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(fs.readFileSync(dashboardDataPath))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), dashboardDataDevPlugin()],
  resolve: {
    alias: {
      '@dashboard/shared': path.resolve(__dirname, 'shared/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
})
