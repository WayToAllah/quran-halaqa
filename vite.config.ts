/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],
  // GitHub Pages serves this from /quran-halaqa/v2/ — a subfolder alongside
  // the existing production root, added additively without touching any
  // existing file (see the /v2/ deployment step in Phase 4).
  base: '/quran-halaqa/v2/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
