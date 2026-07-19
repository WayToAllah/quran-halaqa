import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NIYYAH,
  cleanNiyyat,
  displayNiyyat,
  parseNiyyatText,
  niyyatToText,
} from './niyyat';

describe('cleanNiyyat', () => {
  it('returns [] for null/undefined/empty', () => {
    expect(cleanNiyyat(null)).toEqual([]);
    expect(cleanNiyyat(undefined)).toEqual([]);
    expect(cleanNiyyat([])).toEqual([]);
  });
  it('trims whitespace and drops blank entries', () => {
    expect(cleanNiyyat(['  نية أولى  ', '', '   ', 'نية تانية'])).toEqual([
      'نية أولى',
      'نية تانية',
    ]);
  });
  it('de-duplicates while preserving author order', () => {
    expect(cleanNiyyat(['أ', 'ب', 'أ', 'ج', 'ب'])).toEqual(['أ', 'ب', 'ج']);
  });
});

describe('displayNiyyat', () => {
  it('falls back to the default verse when empty', () => {
    expect(displayNiyyat([])).toEqual([DEFAULT_NIYYAH]);
    expect(displayNiyyat(null)).toEqual([DEFAULT_NIYYAH]);
    expect(displayNiyyat(['   '])).toEqual([DEFAULT_NIYYAH]);
  });
  it('returns the cleaned list when non-empty', () => {
    expect(displayNiyyat(['نية'])).toEqual(['نية']);
  });
  it('never returns an empty array', () => {
    expect(displayNiyyat(undefined).length).toBeGreaterThan(0);
  });
});

describe('parseNiyyatText / niyyatToText round-trip', () => {
  it('parses one-per-line, cleaning blanks', () => {
    expect(parseNiyyatText('نية ١\n\n  نية ٢  \nنية ١')).toEqual(['نية ١', 'نية ٢']);
  });
  it('serializes back to newline-separated text', () => {
    expect(niyyatToText(['نية ١', 'نية ٢'])).toBe('نية ١\nنية ٢');
  });
  it('round-trips a clean list unchanged', () => {
    const list = ['اللهم اجعله خالصًا', 'نسأل الله الإخلاص'];
    expect(parseNiyyatText(niyyatToText(list))).toEqual(list);
  });
});
