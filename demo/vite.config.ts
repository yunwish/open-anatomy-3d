import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://mervinr07.github.io/open-anatomy-3d/ in production.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
}))
