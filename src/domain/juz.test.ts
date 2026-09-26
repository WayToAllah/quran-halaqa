import { describe, it, expect } from 'vitest';
import {
  JUZ_FIRST_AYAH,
  JUZ_NAMES,
  TOTAL_JUZ,
  juzLabel,
  juzName,
  juzOfGlobalAyah,
  juzOfAyah,
} from './juz';
import { globalAyahIndex, TOTAL_AYAT } from './pages';

describe('JUZ_FIRST_AYAH', () => {
  it('has one entry per juz, strictly ascending, starting at ayah 1', () => {
    expect(JUZ_FIRST_AYAH).toHaveLength(TOTAL_JUZ);
    expect(JUZ_FIRST_AYAH[0]).toBe(1);
    for (let i = 1; i < JUZ_FIRST_AYAH.length; i++) {
      expect(JUZ_FIRST_AYAH[i]).toBeGreaterThan(JUZ_FIRST_AYAH[i - 1]);
    }
    expect(JUZ_FIRST_AYAH[TOTAL_JUZ - 1]).toBeLessThanOrEqual(TOTAL_AYAT);
  });

  it('matches the Hafs boundaries, spot-checked at both ends and the middle', () => {
    // جزء عمّ opens at النبأ ١, تبارك at الملك ١ — the two the halaqa names aloud.
    expect(JUZ_FIRST_AYAH[29]).toBe(globalAyahIndex(78, 1));
    expect(JUZ_FIRST_AYAH[28]).toBe(globalAyahIndex(67, 1));
    expect(JUZ_FIRST_AYAH[1]).toBe(globalAyahIndex(2, 142));
    expect(JUZ_FIRST_AYAH[14]).toBe(globalAyahIndex(17, 1));
    expect(JUZ_FIRST_AYAH[25]).toBe(globalAyahIndex(46, 1));
  });

  it('names every juz', () => {
    expect(JUZ_NAMES).toHaveLength(TOTAL_JUZ);
    expect(JUZ_NAMES.every((n) => n.length > 0)).toBe(true);
    expect(juzName(30)).toBe('عمّ');
    expect(juzName(29)).toBe('تبارك');
  });

  it('returns an empty name for a juz number out of range', () => {
    expect(juzName(0)).toBe('');
    expect(juzName(31)).toBe('');
  });
});

describe('juzOfGlobalAyah', () => {
  it('puts each juz start in its own juz', () => {
    JUZ_FIRST_AYAH.forEach((g, i) => {
      expect(juzOfGlobalAyah(g)).toBe(i + 1);
    });
  });

  it('puts the ayah before each start in the preceding juz', () => {
    JUZ_FIRST_AYAH.slice(1).forEach((g, i) => {
      expect(juzOfGlobalAyah(g - 1)).toBe(i + 1);
    });
  });

  it('covers the whole mushaf', () => {
    expect(juzOfGlobalAyah(1)).toBe(1);
    expect(juzOfGlobalAyah(TOTAL_AYAT)).toBe(TOTAL_JUZ);
  });

  it('returns 0 outside the mushaf', () => {
    expect(juzOfGlobalAyah(0)).toBe(0);
    expect(juzOfGlobalAyah(-5)).toBe(0);
    expect(juzOfGlobalAyah(TOTAL_AYAT + 1)).toBe(0);
    expect(juzOfGlobalAyah(Number.NaN)).toBe(0);
  });
});

describe('juzOfAyah', () => {
  it('reads sura and ayah directly', () => {
    expect(juzOfAyah(114, 1)).toBe(30); // الناس — where the halaqa starts
    expect(juzOfAyah(67, 1)).toBe(29); // تبارك
    expect(juzOfAyah(2, 1)).toBe(1); // البقرة — the far end of the path
    expect(juzOfAyah(1, 1)).toBe(1); // الفاتحة sits in الجزء الأول
  });

  it('returns 0 for a sura number out of range', () => {
    expect(juzOfAyah(0, 1)).toBe(0);
    expect(juzOfAyah(115, 1)).toBe(0);
  });
});

describe('juzLabel', () => {
  it('counts ajzaa the way Arabic counts them', () => {
    expect(juzLabel(1)).toBe('جزء واحد');
    expect(juzLabel(2)).toBe('جزءين');
    expect(juzLabel(3)).toBe('٣ أجزاء');
    expect(juzLabel(12)).toBe('١٢ جزءاً');
  });
});
