/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact(), tailwindcss()],
  // GitHub Pages serves this repo from /quran-halaqa/ — same as the current
  // production site. Kept relative-friendly for local dev via base override
  // if ever needed.
  base: '/quran-halaqa/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
