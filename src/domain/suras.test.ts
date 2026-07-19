import { describe, it, expect } from 'vitest';
import {
  SURAS,
  ayahRange,
  countAyat,
  findSuraByName,
  joinSuraNames,
  suraLabel,
  suraNumber,
  suraPageLabel,
} from './suras';

describe('SURAS', () => {
  it('has exactly 114 suras', () => {
    expect(SURAS.length).toBe(114);
  });
  it('starts with الفاتحة (7 ayat) and ends with الناس (6 ayat)', () => {
    expect(SURAS[0]).toEqual({ name: 'الفاتحة', count: 7, pageStart: 1, pageEnd: 1 });
    expect(SURAS[113]).toEqual({ name: 'الناس', count: 6, pageStart: 604, pageEnd: 604 });
  });
  it('has no duplicate sura names', () => {
    const names = SURAS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
  it('carries Madinah-Mushaf page ranges (البقرة 2-49, الكهف 293-304)', () => {
    expect(findSuraByName('البقرة')).toMatchObject({ pageStart: 2, pageEnd: 49 });
    expect(findSuraByName('الكهف')).toMatchObject({ pageStart: 293, pageEnd: 304 });
  });
  it('every page range is valid (1..604, start ≤ end)', () => {
    for (const s of SURAS) {
      expect(s.pageStart).toBeGreaterThanOrEqual(1);
      expect(s.pageEnd).toBeLessThanOrEqual(604);
      expect(s.pageStart).toBeLessThanOrEqual(s.pageEnd);
    }
  });
});

describe('findSuraByName', () => {
  it('finds an exact match', () => {
    expect(findSuraByName('البقرة')).toMatchObject({ name: 'البقرة', count: 286 });
  });
  it('normalizes collapsed whitespace', () => {
    expect(findSuraByName('آل   عمران')).toMatchObject({ name: 'آل عمران', count: 200 });
  });
  it('returns undefined for a non-existent name', () => {
    expect(findSuraByName('سورة غير موجودة')).toBeUndefined();
  });
});

describe('suraNumber', () => {
  it('returns the 1-based Mushaf ordinal', () => {
    expect(suraNumber('الفاتحة')).toBe(1);
    expect(suraNumber('البقرة')).toBe(2);
    expect(suraNumber('الناس')).toBe(114);
  });
  it('returns 0 for an unknown name', () => {
    expect(suraNumber('غير موجودة')).toBe(0);
  });
});

describe('suraPageLabel', () => {
  it('single page shows "صفحة N"', () => {
    expect(suraPageLabel(findSuraByName('الفاتحة')!)).toBe('صفحة 1');
  });
  it('multi-page shows "صفحات A-B"', () => {
    expect(suraPageLabel(findSuraByName('البقرة')!)).toBe('صفحات 2-49');
  });
});

describe('ayahRange', () => {
  it('formats a full range', () => {
    expect(ayahRange('3', '10')).toBe(' (3–10)');
  });
  it('formats an open-ended "from" only', () => {
    expect(ayahRange('5', undefined)).toBe(' (من 5)');
  });
  it('returns empty string with no range at all', () => {
    expect(ayahRange(undefined, undefined)).toBe('');
  });
});

describe('joinSuraNames', () => {
  it('returns a single sura unadorned', () => {
    expect(joinSuraNames([{ sura: 'الإخلاص' }])).toBe('الإخلاص');
  });
  it('joins two suras with و', () => {
    expect(joinSuraNames([{ sura: 'الناس' }, { sura: 'الفلق' }])).toBe('الناس والفلق');
  });
  it('joins three+ suras with Arabic commas between middle items and a final و', () => {
    expect(joinSuraNames([{ sura: 'الناس' }, { sura: 'الفلق' }, { sura: 'الإخلاص' }])).toBe(
      'الناس، الفلق والإخلاص',
    );
  });
  it('includes ayah ranges in the joined output', () => {
    expect(joinSuraNames([{ sura: 'البقرة', from: '1', to: '10' }])).toBe('البقرة (1–10)');
  });
  it('renders a whole-sura range as "من X إلى Y"', () => {
    expect(joinSuraNames([{ sura: 'الملك', toSura: 'الناس', range: true }])).toBe(
      'من الملك إلى الناس',
    );
  });
  it('mixes a range item with ordinary items', () => {
    expect(
      joinSuraNames([
        { sura: 'البقرة', from: '1', to: '5' },
        { sura: 'الملك', toSura: 'الناس', range: true },
      ]),
    ).toBe('البقرة (1–5) ومن الملك إلى الناس');
  });
  it('preserves entry order (never sorts by mushaf order)', () => {
    // الناس (114) entered before البقرة (2): output must keep entry order.
    expect(joinSuraNames([{ sura: 'الناس' }, { sura: 'البقرة' }])).toBe('الناس والبقرة');
  });
});

describe('suraLabel', () => {
  it('labels a plain sura with no range', () => {
    expect(suraLabel({ sura: 'الإخلاص' })).toBe('الإخلاص');
  });
  it('labels an ayah range', () => {
    expect(suraLabel({ sura: 'البقرة', from: '1', to: '10' })).toBe('البقرة (1–10)');
  });
  it('labels a whole-sura range as "من X إلى Y"', () => {
    expect(suraLabel({ sura: 'الملك', toSura: 'الناس', range: true })).toBe('من الملك إلى الناس');
  });
  it('falls back to the plain sura name when a range is missing its toSura', () => {
    expect(suraLabel({ sura: 'الملك', range: true })).toBe('الملك');
  });
});

describe('countAyat', () => {
  it('counts an inclusive range', () => {
    expect(countAyat('1', '10')).toBe(10);
  });
  it('returns 0 for an invalid (reversed) range', () => {
    expect(countAyat('10', '1')).toBe(0);
  });
  it('returns 0 when either bound is missing', () => {
    expect(countAyat(undefined, '10')).toBe(0);
    expect(countAyat('1', undefined)).toBe(0);
  });
  it('returns 0 for a zero "from" (falsy)', () => {
    expect(countAyat('0', '5')).toBe(0);
  });
});
