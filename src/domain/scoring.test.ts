import { describe, it, expect } from 'vitest';
import { hasScore, isScoreEntryComplete, parseScoreField, scoreName, scoreToHalfStars, scoreToStars } from './scoring';

describe('scoreName', () => {
  it('returns إعادة for a genuine zero score (regression: was returning "")', () => {
    expect(scoreName(0)).toBe('إعادة');
  });

  it.each([
    [0, 'إعادة'],
    [1, 'إعادة'],
    [49, 'إعادة'],
    [50, 'مقبول'],
    [64, 'مقبول'],
    [65, 'جيد'],
    [74, 'جيد'],
    [75, 'جيد جداً'],
    [84, 'جيد جداً'],
    [85, 'ممتاز'],
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

describe('scoreToHalfStars', () => {
  it.each([
    [0, 0],
    [10, 0.5],
    [20, 1],
    [50, 2.5],
    [100, 5],
  ])('scoreToHalfStars(%i) === %s', (input, expected) => {
    expect(scoreToHalfStars(input)).toBe(expected);
  });

  it('clamps out-of-range input', () => {
    expect(scoreToHalfStars(150)).toBe(5);
    expect(scoreToHalfStars(-20)).toBe(0);
  });
});

describe('scoreToStars', () => {
  it('floors the half-star value to a whole star count', () => {
    expect(scoreToStars(84)).toBe(4); // half-stars = round(8.4)*0.5 = 4 -> floor 4
    expect(scoreToStars(85)).toBe(4); // half-stars = round(8.5)*0.5 = 4.5 -> floor 4
    expect(scoreToStars(90)).toBe(4); // half-stars = round(9)*0.5 = 4.5 -> floor 4
    expect(scoreToStars(100)).toBe(5); // half-stars = 5 -> floor 5
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
