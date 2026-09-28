import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/preact';

afterEach(() => {
  cleanup();
});

// Seasons come from a live Firestore listener; no component test should open
// one. Tests that need seasons set `globalThis.__testSeasons` before rendering.
vi.mock('./hooks/useSeasons', () => ({
  useSeasons: () => ({
    seasons: (globalThis as { __testSeasons?: unknown[] }).__testSeasons ?? [],
    loaded: true,
    save: vi.fn(() => Promise.resolve()),
  }),
}));
