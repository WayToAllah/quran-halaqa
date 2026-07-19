import { describe, it, expect } from 'vitest';
import { hijriStr, hijriLong, hijriShort, hijriFull } from './hijri';

// The exact Hijri wording depends on the runtime's ICU data (e.g. some builds
// append "هـ", some localize the weekday separator), so these tests assert
// STRUCTURE and INVARIANTS rather than brittle exact strings — the one thing
// we fully control is the noon-anchoring behavior, which is asserted directly.

const ARABIC_INDIC = /[\u0660-\u0669]/; // ٠..٩

describe('hijriStr', () => {
  it('returns a non-empty Umm al-Qura string for a valid date', () => {
    const out = hijriStr('2026-07-06');
    expect(out.length).toBeGreaterThan(0);
    // Umm al-Qura years are 14xx AH; the string must contain Arabic-Indic digits.
    expect(ARABIC_INDIC.test(out)).toBe(true);
  });

  it('accepts a Date object as well as a YYYY-MM-DD string', () => {
    const fromStr = hijriStr('2026-07-06');
    const fromDate = hijriStr(new Date('2026-07-06T12:00:00'));
    expect(fromDate).toBe(fromStr);
  });

  it('returns empty string for an unparseable input', () => {
    expect(hijriStr('not-a-date')).toBe('');
    expect(hijriStr('')).toBe('');
  });

  it('anchors a bare date at local noon so it never rolls to the previous Hijri day', () => {
    // A bare 'YYYY-MM-DD' parsed as midnight-UTC lands on the previous evening
    // in any negative-offset timezone, shifting the Hijri day back by one.
    // Noon anchoring must match noon in the LOCAL zone, not midnight-UTC.
    const ds = '2026-07-06';
    const noonLocal = hijriStr(new Date(ds + 'T12:00:00'));
    expect(hijriStr(ds)).toBe(noonLocal);
    // And it must equal what the raw Intl formatter produces at local noon.
    const ref = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(ds + 'T12:00:00'));
    expect(hijriStr(ds)).toBe(ref);
  });

  it('honors custom options (short month only, no year)', () => {
    const short = hijriStr('2026-07-06', { day: 'numeric', month: 'short' });
    const long = hijriStr('2026-07-06', { day: 'numeric', month: 'long', year: 'numeric' });
    expect(short).not.toBe(long);
    expect(short.length).toBeLessThanOrEqual(long.length);
  });
});

describe('hijri format helpers', () => {
  const ds = '2026-07-06';
  it('hijriLong matches the default hijriStr formatting', () => {
    expect(hijriLong(ds)).toBe(hijriStr(ds, { day: 'numeric', month: 'long', year: 'numeric' }));
  });
  it('hijriShort omits the year (shorter than long)', () => {
    expect(hijriShort(ds).length).toBeLessThan(hijriLong(ds).length);
  });
  it('hijriFull includes a weekday (longer than long)', () => {
    expect(hijriFull(ds).length).toBeGreaterThan(hijriLong(ds).length);
  });
  it('all helpers return empty string on bad input', () => {
    expect(hijriLong('xxx')).toBe('');
    expect(hijriShort('xxx')).toBe('');
    expect(hijriFull('xxx')).toBe('');
  });
});
