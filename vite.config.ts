/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    // Installable PWA for the admin app. Everything is scoped to
    // /quran-halaqa/v2/ so the service worker, manifest, and cache never touch
    // the production app at the site root — the two stay fully isolated.
    VitePWA({
      registerType: 'autoUpdate', // new deploys activate immediately, no prompt
      // Only the admin entry becomes the installable app; the parent page
      // (child.html) is intentionally excluded — parents open a one-off report
      // link, they don't install an app.
      filename: 'sw.js',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'متابعة حفظ القرآن',
        short_name: 'حلقة التيسير',
        description: 'متابعة حفظ وتسميع حلقة القرآن',
        lang: 'ar',
        dir: 'rtl',
        // Scope/start_url are resolved relative to `base`, so they land under
        // /quran-halaqa/v2/ — the app opens to the admin index, not the site root.
        scope: '/quran-halaqa/v2/',
        start_url: '/quran-halaqa/v2/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF7F0',
        theme_color: '#0F3D2E',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell + assets. Google Fonts are cached at
        // runtime (they're cross-origin, not in the build output).
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // SPA-style navigation fallback to the admin index, but ONLY within the
        // v2 scope — never intercept the production root.
        navigateFallback: '/quran-halaqa/v2/index.html',
        navigateFallbackDenylist: [/child\.html$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
        ],
      },
      // Keep the dev server unaffected (no SW in `npm run dev`).
      devOptions: { enabled: false },
    }),
  ],
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
