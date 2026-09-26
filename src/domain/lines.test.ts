import { describe, it, expect } from 'vitest';
import { LINE_FIRST_AYAH, LINE_LAST_AYAH, TOTAL_LINES, LINES_PER_FULL_PAGE } from './lineTable';
import { linesInPathSpan } from './lines';
import { computeLohSpan, computeTopPages } from './statsScreen';
import type { SessionRecord } from '../types';
import { TOTAL_AYAT, globalAyahIndex } from './pages';

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

describe('linesInPathSpan — the span model, one level finer than pages', () => {
  const students = [{ id: 's_1', name: 'زيد' }];

  function linesFor(records: SessionRecord[]): number {
    const span = computeLohSpan(students[0], records, 'all');
    return span ? linesInPathSpan(span.startPos, span.endPos, span.direction) : 0;
  }
  function pagesFor(records: SessionRecord[]): number {
    return computeTopPages(students, records, Infinity, 'all')[0]?.pages ?? 0;
  }

  /** Two assignments two months apart with the weeks between unrecorded. */
  const withGap: SessionRecord[] = [
    {
      id: 'r1',
      studentId: 's_1',
      date: '2026-05-01',
      newLoh: [{ sura: 'الحاقة', from: '38', to: '52' }],
    },
    {
      id: 'r2',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'التحريم', from: '1', to: '12' }],
      loh: { score: 90 },
    },
    { id: 'g1', studentId: 's_1', date: '2026-08-01', loh: { score: 90 } },
  ];

  it('credits the ground between two assignments, exactly as the pages card does', () => {
    // An unrecorded week must not punch a permanent hole in a student's total.
    expect(pagesFor(withGap)).toBe(6);
    expect(linesFor(withGap)).toBeGreaterThan(6 * 15);
  });

  it('keeps ground the student had to repeat, exactly as the pages card does', () => {
    const repeated: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', loh: { score: 40, stars: 0 } },
    ];
    expect(pagesFor(repeated)).toBe(1);
    expect(linesFor(repeated)).toBe(7);
  });

  it('agrees with the pages count whenever a span is whole pages', () => {
    const fatiha: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', loh: { score: 90 } },
    ];
    expect(pagesFor(fatiha)).toBe(1);
    // Page 1 carries seven lines of Qur'an; the sura header is not one.
    expect(linesFor(fatiha)).toBe(7);
  });

  it('counts nothing for an empty or backwards span', () => {
    expect(linesInPathSpan(0, 0, 'descending')).toBe(0);
    expect(linesInPathSpan(50, 10, 'descending')).toBe(0);
  });
});
