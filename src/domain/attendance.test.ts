import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_BADGE_THRESHOLD,
  EXCLUDED_HALAQA_DATES,
  computeAttendanceStreak,
  enrolledHalaqaDates,
  firstRecordDate,
  getAttendanceRanking,
  rankBadgeEmoji,
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

describe('rankBadgeEmoji', () => {
  it('returns medal emoji for ranks 1-3', () => {
    expect(rankBadgeEmoji(1)).toBe('👑');
    expect(rankBadgeEmoji(2)).toBe('🥈');
    expect(rankBadgeEmoji(3)).toBe('🥉');
  });
  it('returns the plain number for rank 4+', () => {
    expect(rankBadgeEmoji(4)).toBe('4');
    expect(rankBadgeEmoji(10)).toBe('10');
  });
});

describe('firstRecordDate', () => {
  it('returns the earliest date regardless of input order', () => {
    const recs: SessionRecord[] = [
      { id: 'r2', date: '2026-07-05' },
      { id: 'r1', date: '2026-06-20' },
      { id: 'r3', date: '2026-07-01' },
    ];
    expect(firstRecordDate(recs)).toBe('2026-06-20');
  });

  it('counts an attendance-only mark as a start date', () => {
    const recs: SessionRecord[] = [
      { id: 'att_1', date: '2026-06-10', attendance_only: true },
      { id: 'r1', date: '2026-07-01' },
    ];
    expect(firstRecordDate(recs)).toBe('2026-06-10');
  });

  it('ignores blank dates, and returns null when there is nothing dated', () => {
    expect(
      firstRecordDate([
        { id: 'r1', date: '' },
        { id: 'r2', date: '2026-07-01' },
      ]),
    ).toBe('2026-07-01');
    expect(firstRecordDate([])).toBeNull();
    expect(firstRecordDate([{ id: 'r1', date: '' }])).toBeNull();
  });
});

describe('enrolledHalaqaDates', () => {
  const halaqaDatesDesc = ['2026-07-05', '2026-07-03', '2026-07-01', '2026-06-28', '2026-06-25'];

  it('keeps only halaqa days from the student first recorded day onward', () => {
    const recs: SessionRecord[] = [{ id: 'r1', date: '2026-07-01' }];
    expect(enrolledHalaqaDates(recs, halaqaDatesDesc)).toEqual([
      '2026-07-05',
      '2026-07-03',
      '2026-07-01',
    ]);
  });

  it('includes the whole calendar for a student present since the first day', () => {
    const recs: SessionRecord[] = [{ id: 'r1', date: '2026-06-25' }];
    expect(enrolledHalaqaDates(recs, halaqaDatesDesc)).toEqual(halaqaDatesDesc);
  });

  it('returns an empty window for a student with no dated records', () => {
    expect(enrolledHalaqaDates([], halaqaDatesDesc)).toEqual([]);
  });

  it('still counts later days when the student joined on an excluded date', () => {
    // The excluded day is absent from halaqaDates, but joining on it must not
    // wipe out the window that follows it.
    const recs: SessionRecord[] = [{ id: 'r1', date: EXCLUDED_HALAQA_DATES[0] }];
    expect(enrolledHalaqaDates(recs, halaqaDatesDesc)).toEqual(halaqaDatesDesc);
  });

  it('de-duplicates repeated dates in the input calendar', () => {
    const recs: SessionRecord[] = [{ id: 'r1', date: '2026-07-01' }];
    const dup = ['2026-07-03', '2026-07-03', '2026-07-01'];
    expect(enrolledHalaqaDates(recs, dup)).toEqual(['2026-07-03', '2026-07-01']);
  });
});
