/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Deliberately separate from vite.config.ts's `test` block: the domain
// suite (`npm test`) is pure logic in a 'node' environment with zero DOM.
// Component tests need a DOM (happy-dom) and are named *.component.test.tsx
// so the two suites never overlap.
export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.component.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
