import { describe, it, expect } from 'vitest';
import {
  liveMistakeScore,
  committedMistakeScore,
  summarizeMistakes,
  rebuildMistakeHistory,
  mistakeScoreColor,
  type MistakeKind,
} from './mistakes';

describe('liveMistakeScore', () => {
  it('starts at 100 with no mistakes', () => {
    expect(liveMistakeScore([])).toBe(100);
  });

  it('subtracts 1 per full mistake', () => {
    expect(liveMistakeScore(['full'])).toBe(99);
    expect(liveMistakeScore(['full', 'full', 'full'])).toBe(97);
  });

  it('subtracts 0.5 per tajweed mistake (keeps the half)', () => {
    expect(liveMistakeScore(['tajweed'])).toBe(99.5);
    expect(liveMistakeScore(['tajweed', 'tajweed'])).toBe(99);
  });

  it('mixes both kinds', () => {
    expect(liveMistakeScore(['full', 'tajweed'])).toBe(98.5);
    expect(liveMistakeScore(['full', 'full', 'tajweed', 'tajweed'])).toBe(97);
  });

  it('never goes below zero', () => {
    const many: MistakeKind[] = Array(250).fill('full');
    expect(liveMistakeScore(many)).toBe(0);
  });
});

describe('committedMistakeScore', () => {
  it('rounds a lone tajweed mistake back to nearest integer', () => {
    // 99.5 rounds to 100 — a single tajweed slip does not move the field
    expect(committedMistakeScore(['tajweed'])).toBe(100);
  });

  it('two tajweed mistakes actually move the score', () => {
    expect(committedMistakeScore(['tajweed', 'tajweed'])).toBe(99);
  });

  it('full mistakes commit exactly', () => {
    expect(committedMistakeScore(['full', 'full', 'full'])).toBe(97);
  });

  it('mixed rounds half up', () => {
    // 98.5 -> 99 (Math.round rounds .5 up)
    expect(committedMistakeScore(['full', 'tajweed'])).toBe(99);
  });

  it('clamps at zero', () => {
    const many: MistakeKind[] = Array(300).fill('full');
    expect(committedMistakeScore(many)).toBe(0);
  });
});

describe('summarizeMistakes', () => {
  it('returns null for an empty history (no mistakes field saved)', () => {
    expect(summarizeMistakes([])).toBeNull();
  });

  it('tallies full and tajweed counts', () => {
    expect(summarizeMistakes(['full', 'tajweed', 'full'])).toEqual({ full: 2, tajweed: 1 });
  });

  it('tallies a single kind', () => {
    expect(summarizeMistakes(['tajweed', 'tajweed'])).toEqual({ full: 0, tajweed: 2 });
  });
});

describe('rebuildMistakeHistory', () => {
  it('returns [] for null/undefined', () => {
    expect(rebuildMistakeHistory(null)).toEqual([]);
    expect(rebuildMistakeHistory(undefined)).toEqual([]);
  });

  it('rebuilds full entries then tajweed entries', () => {
    expect(rebuildMistakeHistory({ full: 2, tajweed: 1 })).toEqual(['full', 'full', 'tajweed']);
  });

  it('round-trips through summarize', () => {
    const original: MistakeKind[] = ['full', 'tajweed', 'full', 'tajweed', 'tajweed'];
    const tally = summarizeMistakes(original)!;
    const rebuilt = rebuildMistakeHistory(tally);
    // Same committed score after a round trip, regardless of tap order
    expect(committedMistakeScore(rebuilt)).toBe(committedMistakeScore(original));
    expect(summarizeMistakes(rebuilt)).toEqual(tally);
  });

  it('handles a tally missing a key gracefully', () => {
    expect(rebuildMistakeHistory({ full: 1 } as never)).toEqual(['full']);
  });
});

describe('mistakeScoreColor', () => {
  it('maps score bands to the live thresholds', () => {
    expect(mistakeScoreColor(100)).toBe('#15613a');
    expect(mistakeScoreColor(85)).toBe('#15613a');
    expect(mistakeScoreColor(80)).toBe('#3a8a5c');
    expect(mistakeScoreColor(70)).toBe('#b8720a');
    expect(mistakeScoreColor(55)).toBe('#c98a1f');
    expect(mistakeScoreColor(40)).toBe('#c0392b');
  });
});
