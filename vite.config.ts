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
  build: {
    // Two independent entry points: the admin app (index.html → main.tsx) and
    // the public, read-only parent page (child.html → child-main.tsx). Keeping
    // them separate means a parent never downloads the admin bundle, auth, or
    // any write code — smaller payload and a smaller attack surface.
    rollupOptions: {
      input: {
        main: 'index.html',
        child: 'child.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
