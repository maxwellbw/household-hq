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
})
