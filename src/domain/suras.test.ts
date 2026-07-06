import { describe, it, expect } from 'vitest';
import { SURAS, ayahRange, countAyat, findSuraByName, joinSuraNames } from './suras';

describe('SURAS', () => {
  it('has exactly 114 suras', () => {
    expect(SURAS.length).toBe(114);
  });
  it('starts with الفاتحة (7 ayat) and ends with الناس (6 ayat)', () => {
    expect(SURAS[0]).toEqual(['الفاتحة', 7]);
    expect(SURAS[113]).toEqual(['الناس', 6]);
  });
  it('has no duplicate sura names', () => {
    const names = SURAS.map(([n]) => n);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('findSuraByName', () => {
  it('finds an exact match', () => {
    expect(findSuraByName('البقرة')).toEqual(['البقرة', 286]);
  });
  it('normalizes collapsed whitespace', () => {
    expect(findSuraByName('آل   عمران')).toEqual(['آل عمران', 200]);
  });
  it('returns undefined for a non-existent name', () => {
    expect(findSuraByName('سورة غير موجودة')).toBeUndefined();
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
