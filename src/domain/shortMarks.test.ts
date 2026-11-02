import { describe, it, expect } from 'vitest';
import { genMarksCode, marksQueryOf, shortMarksUrl, MARKS_CODE_LENGTH } from './shortMarks';

const FULL = 'https://waytoallah.github.io/quran-halaqa/mushaf/?e=78.1.2.3_78.5.4&p=582-583&x=1';

describe('short mushaf marks links', () => {
  it('makes fixed-length codes without look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const c = genMarksCode();
      expect(c).toHaveLength(MARKS_CODE_LENGTH);
      expect(c).toMatch(/^[A-Za-z0-9]+$/);
      expect(c).not.toMatch(/[0O1lI]/);
    }
  });

  it('takes the marks part out of a full viewer link', () => {
    expect(marksQueryOf(FULL)).toBe('e=78.1.2.3_78.5.4&p=582-583&x=1');
  });

  it('refuses links the short page could not rebuild', () => {
    expect(marksQueryOf('not a url')).toBeNull();
    expect(marksQueryOf('https://x.test/mushaf/')).toBeNull();
    expect(marksQueryOf('https://x.test/mushaf/?p=1-2')).toBeNull(); // no marked words
    expect(marksQueryOf('https://x.test/mushaf/?e=1.1.1&n=%D8%B2')).toBeNull(); // Arabic name
    expect(marksQueryOf('https://x.test/mushaf/?e=' + '1.'.repeat(800))).toBeNull(); // too long
  });

  it('builds the short link next to the viewer folder, much shorter than the full one', () => {
    const short = shortMarksUrl(FULL, 'Ab3dEf7');
    expect(short).toBe('https://waytoallah.github.io/quran-halaqa/m/?Ab3dEf7');
    expect(short!.length).toBeLessThan(FULL.length);
    expect(shortMarksUrl('http://localhost:5173/mushaf/index.html?e=1.1.1', 'X')).toBe(
      'http://localhost:5173/m/?X',
    );
    expect(shortMarksUrl('https://x.test/other/?e=1.1.1', 'X')).toBeNull();
  });
});
