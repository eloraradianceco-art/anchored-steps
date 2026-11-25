// Front page + the bridge file that is added to each year's page (see build.mjs).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { APP_DIR, alias } from './vite.shared.mjs'

export default defineConfig({
  root: APP_DIR,
  plugins: [react()],
  resolve: { alias },
  build: {
    outDir: path.join(APP_DIR, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: { index: path.join(APP_DIR, 'index.html'), bridge: path.join(APP_DIR, 'src/bridge.js') },
      output: { entryFileNames: (chunk) => (chunk.name === 'bridge' ? 'bridge.js' : 'assets/[name]-[hash].js') },
    },
  },
})
