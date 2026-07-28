import { describe, it, expect } from 'vitest';
import {
  hasScore,
  isScoreEntryComplete,
  parseScoreField,
  scoreName,
  scoreToStars,
} from './scoring';

describe('scoreName', () => {
  it('returns إعادة for a genuine zero score (regression: was returning "")', () => {
    expect(scoreName(0)).toBe('إعادة');
  });

  // Bands are 90/80/70/60 (was 85/75/65/50) — every boundary and the value
  // one below it is pinned so an off-by-one in a `>=` can't slip through.
  it.each([
    [0, 'إعادة'],
    [1, 'إعادة'],
    [59, 'إعادة'],
    [60, 'مقبول'],
    [69, 'مقبول'],
    [70, 'جيد'],
    [79, 'جيد'],
    [80, 'جيد جداً'],
    [89, 'جيد جداً'],
    [90, 'ممتاز'],
    [100, 'ممتاز'],
  ])('scoreName(%i) === %s', (input, expected) => {
    expect(scoreName(input)).toBe(expected);
  });

  it('returns empty string for unset/invalid input, never a real label', () => {
    expect(scoreName('')).toBe('');
    expect(scoreName(null)).toBe('');
    expect(scoreName(undefined)).toBe('');
    expect(scoreName('abc')).toBe('');
  });
});

describe('scoreToStars', () => {
  // Stars are derived from the SAME bands as scoreName, so every boundary is
  // pinned here too — this is the invariant that keeps the label, the parent
  // page and the WhatsApp message from disagreeing about the same session.
  it.each([
    [0, 0],
    [59, 0],
    [60, 2],
    [69, 2],
    [70, 3],
    [79, 3],
    [80, 4],
    [89, 4],
    [90, 5],
    [100, 5],
  ])('scoreToStars(%i) === %i', (input, expected) => {
    expect(scoreToStars(input)).toBe(expected);
  });

  it('never awards exactly one star — there is no 1-star grade', () => {
    for (let s = 0; s <= 100; s++) expect(scoreToStars(s)).not.toBe(1);
  });

  it('agrees with scoreName across the whole range', () => {
    const expectedStars: Record<string, number> = {
      ممتاز: 5,
      'جيد جداً': 4,
      جيد: 3,
      مقبول: 2,
      إعادة: 0,
    };
    for (let s = 0; s <= 100; s++) {
      expect(scoreToStars(s)).toBe(expectedStars[scoreName(s)]);
    }
  });

  it('returns 0 stars for unset/invalid input rather than guessing', () => {
    expect(scoreToStars('')).toBe(0);
    expect(scoreToStars(null)).toBe(0);
    expect(scoreToStars(undefined)).toBe(0);
    expect(scoreToStars('abc')).toBe(0);
  });
});

describe('hasScore', () => {
  it('is true for a genuine zero score', () => {
    expect(hasScore({ score: 0 })).toBe(true);
  });
  it('is false when score is null/undefined/missing', () => {
    expect(hasScore({ score: null })).toBe(false);
    expect(hasScore({})).toBe(false);
    expect(hasScore(null)).toBe(false);
    expect(hasScore(undefined)).toBe(false);
  });
  it('is true for any real numeric score', () => {
    expect(hasScore({ score: 85 })).toBe(true);
  });
});

describe('parseScoreField', () => {
  it('treats an empty field as legitimately not-evaluated, not an error', () => {
    expect(parseScoreField('')).toEqual({ value: null, invalid: false, clamped: false });
    expect(parseScoreField('   ')).toEqual({ value: null, invalid: false, clamped: false });
  });
  it('parses a normal in-range score', () => {
    expect(parseScoreField('90')).toEqual({ value: 90, invalid: false, clamped: false });
    expect(parseScoreField('0')).toEqual({ value: 0, invalid: false, clamped: false });
  });
  it('clamps and flags an out-of-range number instead of silently substituting it', () => {
    expect(parseScoreField('150')).toEqual({ value: 100, invalid: false, clamped: true });
    expect(parseScoreField('-5')).toEqual({ value: 0, invalid: false, clamped: true });
  });
  it('flags non-numeric text as invalid instead of silently saving a real zero (false "إعادة")', () => {
    expect(parseScoreField('abc')).toEqual({ value: null, invalid: true, clamped: false });
    expect(parseScoreField('٩٠عايز')).toEqual({ value: null, invalid: true, clamped: false });
  });
});

describe('isScoreEntryComplete', () => {
  it('is not complete after a single digit — a second digit could still come', () => {
    expect(isScoreEntryComplete('9')).toBe(false);
    expect(isScoreEntryComplete('0')).toBe(false);
  });
  it('is complete after two digits that cannot become a valid 3-digit score', () => {
    expect(isScoreEntryComplete('95')).toBe(true);
    expect(isScoreEntryComplete('50')).toBe(true);
  });
  it('is NOT complete after exactly "10" — it could still become "100"', () => {
    expect(isScoreEntryComplete('10')).toBe(false);
  });
  it('is complete after three digits ("100" — the only valid one)', () => {
    expect(isScoreEntryComplete('100')).toBe(true);
  });
});
