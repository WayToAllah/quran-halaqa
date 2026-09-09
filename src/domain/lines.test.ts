import { describe, it, expect } from 'vitest';
import { LINE_FIRST_AYAH, LINE_LAST_AYAH, TOTAL_LINES, LINES_PER_FULL_PAGE } from './lineTable';
import { completedLines } from './lines';
import { TOTAL_AYAT, globalAyahIndex } from './pages';
import type { DatedAssignment } from './pages';

describe('the mushaf line table', () => {
  it('holds every line of the Madinah mushaf', () => {
    expect(TOTAL_LINES).toBe(8820);
    expect(LINE_FIRST_AYAH).toHaveLength(TOTAL_LINES);
    expect(LINE_LAST_AYAH).toHaveLength(TOTAL_LINES);
    expect(LINES_PER_FULL_PAGE).toBe(15);
  });

  it('runs from the first ayah of the mushaf to the last', () => {
    expect(LINE_FIRST_AYAH[0]).toBe(1);
    expect(LINE_LAST_AYAH[TOTAL_LINES - 1]).toBe(TOTAL_AYAT);
  });

  it('never goes backwards', () => {
    for (let i = 1; i < TOTAL_LINES; i++) {
      expect(LINE_FIRST_AYAH[i]).toBeGreaterThanOrEqual(LINE_FIRST_AYAH[i - 1]);
      expect(LINE_LAST_AYAH[i]).toBeGreaterThanOrEqual(LINE_LAST_AYAH[i - 1]);
      expect(LINE_LAST_AYAH[i]).toBeGreaterThanOrEqual(LINE_FIRST_AYAH[i]);
    }
  });

  it('leaves no ayah between two lines', () => {
    // A line either opens the next ayah or carries on the one the line above
    // ended in. Anything else would mean an ayah nobody can ever be credited
    // for memorizing.
    for (let i = 1; i < TOTAL_LINES; i++) {
      const step = LINE_FIRST_AYAH[i] - LINE_LAST_AYAH[i - 1];
      expect(step === 0 || step === 1).toBe(true);
    }
  });

  it('places الفاتحة on the opening lines and الناس on the closing one', () => {
    expect(LINE_LAST_AYAH[0]).toBe(globalAyahIndex(1, 1));
    expect(LINE_LAST_AYAH[TOTAL_LINES - 1]).toBe(globalAyahIndex(114, 6));
  });
});

describe('completedLines', () => {
  const on = (item: { sura: string; from?: string; to?: string }): DatedAssignment => ({
    item,
    date: '2026-07-01',
  });

  it('counts nothing for a student with no assignments', () => {
    expect(completedLines([])).toBe(0);
  });

  it('credits a beginner who memorized only the opening two ayat of البقرة', () => {
    // The whole reason for counting lines: البقرة ١–٢ fills the first line of
    // page 2 exactly. Under whole-page counting this student scored zero for
    // months while turning up every week.
    expect(completedLines([on({ sura: 'البقرة', from: '1', to: '2' })])).toBe(1);
  });

  it('gives no credit for part of a line', () => {
    expect(completedLines([on({ sura: 'البقرة', from: '1', to: '1' })])).toBe(0);
  });

  it('credits a whole short sura', () => {
    expect(completedLines([on({ sura: 'الإخلاص' })])).toBeGreaterThan(0);
  });

  it('does not count the same ground twice when it is re-assigned', () => {
    const once = completedLines([on({ sura: 'الإخلاص' })]);
    const twice = completedLines([on({ sura: 'الإخلاص' }), on({ sura: 'الإخلاص' })]);
    expect(twice).toBe(once);
  });

  it('does not credit the gap between two separate assignments', () => {
    // الناس and النصر with nothing in between: the lines lying between them
    // were never memorized and must not be counted.
    const ends = completedLines([on({ sura: 'الناس' }), on({ sura: 'النصر' })]);
    const span = completedLines([
      on({ sura: 'النصر' }),
      on({ sura: 'الكافرون' }),
      on({ sura: 'المسد' }),
      on({ sura: 'الإخلاص' }),
      on({ sura: 'الفلق' }),
      on({ sura: 'الناس' }),
    ]);
    expect(ends).toBeLessThan(span);
  });

  it('adds up across assignments that join into one run', () => {
    const first = completedLines([on({ sura: 'الفلق' })]);
    const both = completedLines([on({ sura: 'الفلق' }), on({ sura: 'الناس' })]);
    expect(both).toBeGreaterThan(first);
  });

  it('ignores an assignment with no usable date', () => {
    expect(completedLines([{ item: { sura: 'الإخلاص' }, date: '' }])).toBe(0);
  });
});
