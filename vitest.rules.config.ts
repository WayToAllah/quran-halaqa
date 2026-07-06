import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts's test block: the domain suite
// (`npm test`) is pure logic, runs in ~1.5s, no network needed. This one
// needs a live Firestore Emulator on localhost:8080 — see package.json's
// `test:rules` script, which starts the emulator via `firebase
// emulators:exec` before running this config.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['firestore.rules.test.ts'],
    testTimeout: 20000,
  },
});
