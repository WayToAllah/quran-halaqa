import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_BADGE_THRESHOLD,
  EXCLUDED_HALAQA_DATES,
  computeAbsenceStreak,
  computeAttendanceStreak,
  enrolledHalaqaDates,
  firstRecordDate,
  getAttendanceRanking,
  getPersonalAttendanceRanking,
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

describe('computeAbsenceStreak', () => {
  const days = ['2026-07-22', '2026-07-15', '2026-07-08', '2026-07-01']; // desc

  it('counts consecutive most-recent halaqa days the student missed', () => {
    const attended = new Set(['2026-07-08', '2026-07-01']);
    expect(computeAbsenceStreak(attended, days)).toBe(2);
  });

  it('is zero when the student attended the latest halaqa day', () => {
    expect(computeAbsenceStreak(new Set(['2026-07-22']), days)).toBe(0);
  });

  it('stops at the first attended day rather than counting total absences', () => {
    // Missed the newest day, attended the one before, missed two older ones.
    const attended = new Set(['2026-07-15']);
    expect(computeAbsenceStreak(attended, days)).toBe(1);
  });

  it('counts every halaqa day for a student who never attended', () => {
    expect(computeAbsenceStreak(new Set(), days)).toBe(4);
  });

  it('is zero when there are no halaqa days at all', () => {
    expect(computeAbsenceStreak(new Set(), [])).toBe(0);
  });
});

describe('getPersonalAttendanceRanking', () => {
  const students: Student[] = [
    { id: 's_1', name: 'أحمد' }, // enrolled from the start
    { id: 's_2', name: 'محمد' }, // joined late
  ];
  const halaqa: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-01' },
    { id: 'r2', studentId: 's_1', date: '2026-07-02' },
    { id: 'r3', studentId: 's_1', date: '2026-07-04' },
    { id: 'r4', studentId: 's_2', date: '2026-07-04' },
  ];

  it('measures each student against the halaqa days since they joined, not all of them', () => {
    const { list } = getPersonalAttendanceRanking(students, halaqa, halaqa);
    const ahmed = list.find((x) => x.id === 's_1')!;
    const mohamed = list.find((x) => x.id === 's_2')!;
    // 3 halaqa days exist; أحمد attended all 3.
    expect(ahmed).toMatchObject({ attendedDays: 3, enrolledDays: 3, attendPct: 100 });
    // محمد's first day is 07-04, so only that one day is his denominator.
    expect(mohamed).toMatchObject({ attendedDays: 1, enrolledDays: 1, attendPct: 100 });
  });

  it('takes the enrolment date from the FULL history, not the filtered window', () => {
    // Viewing July only, but أحمد has been around since June.
    const july = halaqa.filter((r) => r.date!.startsWith('2026-07'));
    const all: SessionRecord[] = [{ id: 'r0', studentId: 's_1', date: '2026-06-01' }, ...halaqa];
    // A June-only halaqa day must not leak into the July denominator.
    const { list } = getPersonalAttendanceRanking(students, july, all);
    expect(list.find((x) => x.id === 's_1')!.enrolledDays).toBe(3);
  });

  it('does not count a day the student had not joined yet even if he attended later', () => {
    const recs: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: '2026-07-01' },
      { id: 'b', studentId: 's_1', date: '2026-07-02' },
      { id: 'c', studentId: 's_1', date: '2026-07-03' },
      { id: 'd', studentId: 's_2', date: '2026-07-02' },
    ];
    const { list } = getPersonalAttendanceRanking(students, recs, recs);
    const mohamed = list.find((x) => x.id === 's_2')!;
    expect(mohamed.enrolledDays).toBe(2); // 07-02 and 07-03
    expect(mohamed.attendedDays).toBe(1);
    expect(mohamed.attendPct).toBe(50);
  });

  it('excludes EXCLUDED_HALAQA_DATES from the denominator', () => {
    const recs: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: '2026-07-01' },
      { id: 'b', studentId: 's_1', date: EXCLUDED_HALAQA_DATES[0] },
      { id: 'c', studentId: 's_2', date: '2026-07-01' },
      { id: 'd', studentId: 's_2', date: EXCLUDED_HALAQA_DATES[0] },
    ];
    const { list } = getPersonalAttendanceRanking(students, recs, recs);
    expect(list.every((x) => x.enrolledDays === 1)).toBe(true);
  });

  it('ranks densely — ties share a rank with no gap after them', () => {
    const recs: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: '2026-07-01' },
      { id: 'b', studentId: 's_1', date: '2026-07-02' },
      { id: 'c', studentId: 's_2', date: '2026-07-01' },
      { id: 'd', studentId: 's_2', date: '2026-07-02' },
      { id: 'e', studentId: 's_3', date: '2026-07-01' },
    ];
    const withThird = [...students, { id: 's_3', name: 'زيد' } as Student];
    const { list } = getPersonalAttendanceRanking(withThird, recs, recs);
    expect(list.find((x) => x.id === 's_1')!.rank).toBe(1);
    expect(list.find((x) => x.id === 's_2')!.rank).toBe(1);
    expect(list.find((x) => x.id === 's_3')!.rank).toBe(2);
  });

  it('leaves out students with no record inside the window', () => {
    const withGhost = [...students, { id: 's_9', name: 'شبح' } as Student];
    const { list } = getPersonalAttendanceRanking(withGhost, halaqa, halaqa);
    expect(list.some((x) => x.id === 's_9')).toBe(false);
  });
});
