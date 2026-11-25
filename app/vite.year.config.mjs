// One year built as its own page under /year1/ or /year2/. YEAR_ROOT, YEAR_BASE and YEAR_OUT come from build.mjs.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { alias } from './vite.shared.mjs'

export default defineConfig({
  root: process.env.YEAR_ROOT,
  base: process.env.YEAR_BASE,
  plugins: [react()],
  resolve: { alias },
  build: { outDir: process.env.YEAR_OUT, emptyOutDir: true, target: 'esnext' },
})
