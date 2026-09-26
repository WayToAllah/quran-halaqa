import { describe, it, expect } from 'vitest';
import type { Student, SessionRecord } from '../types';
import { computeJuzDistribution, FATIHA_JUZ } from './juzDistribution';

const students: Student[] = [
  { id: 's1', name: 'زيد أحمد' },
  { id: 's2', name: 'عمر خالد' },
  { id: 's3', name: 'علي حسن' },
  { id: 's4', name: 'أنس محمود' },
  { id: 's5', name: 'يوسف سامي' },
  { id: 's6', name: 'حمزة طارق' },
];

/** Each student gets one assignment plus a following session that grades it —
 * an assignment nobody has recited yet is not memorized ground, so the span
 * only closes once the next session carries a score. */
const records: SessionRecord[] = [
  // s1 + s2 are both in جزء عمّ.
  {
    id: 'a1',
    studentId: 's1',
    date: '2026-07-01',
    newLoh: [{ sura: 'الناس', from: '1', to: '6' }],
  },
  { id: 'a2', studentId: 's1', date: '2026-07-08', loh: { score: 90, stars: 5 } },
  {
    id: 'b1',
    studentId: 's2',
    date: '2026-07-01',
    newLoh: [{ sura: 'النبأ', from: '1', to: '20' }],
  },
  { id: 'b2', studentId: 's2', date: '2026-07-08', loh: { score: 85, stars: 4 } },
  // s3 is in جزء تبارك.
  {
    id: 'c1',
    studentId: 's3',
    date: '2026-07-01',
    newLoh: [{ sura: 'الملك', from: '1', to: '10' }],
  },
  { id: 'c2', studentId: 's3', date: '2026-07-08', loh: { score: 75, stars: 3 } },
  // s4 has reached البقرة — the far end of the path, الجزء الأول.
  {
    id: 'd1',
    studentId: 's4',
    date: '2026-07-01',
    newLoh: [{ sura: 'البقرة', from: '1', to: '5' }],
  },
  { id: 'd2', studentId: 's4', date: '2026-07-08', loh: { score: 95, stars: 5 } },
  // s5 is still on الفاتحة — the very start of the halaqa's order.
  {
    id: 'e1',
    studentId: 's5',
    date: '2026-07-01',
    newLoh: [{ sura: 'الفاتحة', from: '1', to: '7' }],
  },
  { id: 'e2', studentId: 's5', date: '2026-07-08', loh: { score: 90, stars: 5 } },
  // s6 has an assignment nobody has heard yet.
  {
    id: 'f1',
    studentId: 's6',
    date: '2026-07-01',
    newLoh: [{ sura: 'الفلق', from: '1', to: '5' }],
  },
];

describe('computeJuzDistribution', () => {
  it('counts students by the juz their last recited assignment sits in', () => {
    const d = computeJuzDistribution(students, records);
    const byJuz = Object.fromEntries(d.rows.map((r) => [r.juz, r.count]));
    expect(byJuz[30]).toBe(2); // s1 + s2
    expect(byJuz[29]).toBe(1); // s3
    expect(byJuz[1]).toBe(1); // s4
  });

  it('keeps الفاتحة out of الجزء الأول — it is memorized first, not last', () => {
    const d = computeJuzDistribution(students, records);
    const fatiha = d.rows.find((r) => r.juz === FATIHA_JUZ);
    expect(fatiha?.count).toBe(1);
    expect(fatiha?.students[0].id).toBe('s5');
    expect(d.rows.find((r) => r.juz === 1)?.students.map((s) => s.id)).toEqual(['s4']);
  });

  it('omits juz with nobody in them', () => {
    const d = computeJuzDistribution(students, records);
    expect(d.rows.every((r) => r.count > 0)).toBe(true);
    expect(d.rows.find((r) => r.juz === 15)).toBeUndefined();
  });

  it('orders rows along the memorization path — الفاتحة, then ٣٠ downwards', () => {
    const d = computeJuzDistribution(students, records);
    expect(d.rows.map((r) => r.juz)).toEqual([FATIHA_JUZ, 30, 29, 1]);
  });

  it('sets a percentage of the placed students, not of the roster', () => {
    const d = computeJuzDistribution(students, records);
    expect(d.placed).toBe(5);
    expect(d.rows.find((r) => r.juz === 30)?.pct).toBe(40);
  });

  it('counts students with no recited assignment as not started', () => {
    const d = computeJuzDistribution(students, records);
    expect(d.notStarted).toBe(1); // s6 — assignment never heard
    expect(d.total).toBe(6);
    expect(d.rows.flatMap((r) => r.students).find((s) => s.id === 's6')).toBeUndefined();
  });

  it('counts a student with no records at all as not started', () => {
    const d = computeJuzDistribution([...students, { id: 's7', name: 'سيف' }], records);
    expect(d.notStarted).toBe(2);
    expect(d.total).toBe(7);
  });

  it('names every row', () => {
    const d = computeJuzDistribution(students, records);
    expect(d.rows.find((r) => r.juz === 30)?.name).toBe('عمّ');
    expect(d.rows.find((r) => r.juz === 29)?.name).toBe('تبارك');
    expect(d.rows.find((r) => r.juz === FATIHA_JUZ)?.name).toBe('الفاتحة');
  });

  it('lists each row students by name, so a wrong placement is visible', () => {
    const d = computeJuzDistribution(students, records);
    const juz30 = d.rows.find((r) => r.juz === 30);
    expect(juz30?.students.map((s) => s.name).sort()).toEqual(['زيد أحمد', 'عمر خالد']);
  });

  it('returns an empty distribution for an empty roster', () => {
    const d = computeJuzDistribution([], []);
    expect(d.rows).toEqual([]);
    expect(d.placed).toBe(0);
    expect(d.notStarted).toBe(0);
    expect(d.total).toBe(0);
  });
});
