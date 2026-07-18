import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Household HQ is deployed as a GitHub Pages *project* site
// (https://<user>.github.io/household-hq/), so assets must be requested
// relative to that subpath, not the domain root.
export default defineConfig({
  base: '/household-hq/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Feature 030 US5 (FR-018): Schedule-X is the single heaviest dependency and is
        // only used by the (lazy-loaded) calendar view — its own chunk means it's never
        // fetched on the cold, dashboard-first landing path. The React runtime rarely
        // changes and is shared by every chunk, so it gets its own stable vendor chunk too.
        // Vite 8 bundles rolldown, whose `manualChunks` only accepts a function (the
        // classic Rollup object-of-arrays form isn't supported), hence the id matching here.
        manualChunks(id) {
          if (id.includes('/node_modules/@schedule-x/')) return 'schedule-x'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react'
        },
      },
    },
  },
})
