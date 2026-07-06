import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_BADGE_THRESHOLD,
  EXCLUDED_HALAQA_DATES,
  computeAttendanceStreak,
  getAttendanceRanking,
  sortedHalaqaDatesDesc,
} from './attendance';
import type { SessionRecord, Student } from '../types';

describe('sortedHalaqaDatesDesc', () => {
  it('returns unique dates newest-first', () => {
    const records: SessionRecord[] = [
      { id: '1', date: '2026-07-01' },
      { id: '2', date: '2026-07-03' },
      { id: '3', date: '2026-07-01' }, // duplicate date
    ];
    expect(sortedHalaqaDatesDesc(records)).toEqual(['2026-07-03', '2026-07-01']);
  });

  it('excludes EXCLUDED_HALAQA_DATES', () => {
    const records: SessionRecord[] = [
      { id: '1', date: '2026-07-01' },
      { id: '2', date: EXCLUDED_HALAQA_DATES[0] },
    ];
    expect(sortedHalaqaDatesDesc(records)).toEqual(['2026-07-01']);
  });
});

describe('computeAttendanceStreak', () => {
  it('counts consecutive halaqa days from the most recent, stopping at the first gap', () => {
    const halaqaDatesDesc = ['2026-07-05', '2026-07-04', '2026-07-03', '2026-07-02', '2026-07-01'];
    const studentDates = new Set(['2026-07-05', '2026-07-04', '2026-07-02']); // missing 07-03
    expect(computeAttendanceStreak(studentDates, halaqaDatesDesc)).toBe(2);
  });

  it('returns 0 when the student missed the most recent day', () => {
    const halaqaDatesDesc = ['2026-07-05', '2026-07-04'];
    const studentDates = new Set(['2026-07-04']);
    expect(computeAttendanceStreak(studentDates, halaqaDatesDesc)).toBe(0);
  });

  it('returns the full length when attendance is perfect', () => {
    const halaqaDatesDesc = ['2026-07-03', '2026-07-02', '2026-07-01'];
    const studentDates = new Set(halaqaDatesDesc);
    expect(computeAttendanceStreak(studentDates, halaqaDatesDesc)).toBe(3);
  });
});

describe('getAttendanceRanking', () => {
  const students: Student[] = [
    { id: 's_1', name: 'أحمد' },
    { id: 's_2', name: 'محمد' },
    { id: 's_3', name: 'زيد' },
  ];
  const records: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-01' },
    { id: 'r2', studentId: 's_1', date: '2026-07-02' },
    { id: 'r3', studentId: 's_2', date: '2026-07-01' },
    { id: 'r4', studentId: 's_2', date: '2026-07-02' },
    { id: 'r5', studentId: 's_3', date: '2026-07-01' },
  ];

  it('computes attendPct relative to total unique halaqa days', () => {
    const { list } = getAttendanceRanking(students, records);
    const ahmed = list.find((x) => x.name === 'أحمد')!;
    const zaid = list.find((x) => x.name === 'زيد')!;
    expect(ahmed.attendPct).toBe(100); // attended both days
    expect(zaid.attendPct).toBe(50); // attended 1 of 2 days
  });

  it('assigns dense ranks (ties share a rank, no gaps)', () => {
    const { list } = getAttendanceRanking(students, records);
    const ahmed = list.find((x) => x.name === 'أحمد')!;
    const mohamed = list.find((x) => x.name === 'محمد')!;
    const zaid = list.find((x) => x.name === 'زيد')!;
    expect(ahmed.rank).toBe(1);
    expect(mohamed.rank).toBe(1); // tied with ahmed at 100%
    expect(zaid.rank).toBe(2); // next rank is 2, not 3
  });

  it('omits students with zero records entirely', () => {
    const withGhost = [...students, { id: 's_4', name: 'طالب بلا سجلات' }];
    const { list } = getAttendanceRanking(withGhost, records);
    expect(list.find((x) => x.name === 'طالب بلا سجلات')).toBeUndefined();
  });

  it('filters by minPct when provided', () => {
    const { list } = getAttendanceRanking(students, records, ATTENDANCE_BADGE_THRESHOLD);
    expect(list.every((x) => x.attendPct >= ATTENDANCE_BADGE_THRESHOLD)).toBe(true);
    expect(list.find((x) => x.name === 'زيد')).toBeUndefined(); // 50% < 70%
  });
});
