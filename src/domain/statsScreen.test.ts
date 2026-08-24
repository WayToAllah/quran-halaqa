import { describe, it, expect } from 'vitest';
import {
  computeSummaryStats,
  computeWeeklyBuckets,
  computeScoreDistribution,
  computeTopAyat,
  computeTopPages,
  computeFollowUpList,
  computeLohSpan,
  detectMemorizationDirection,
  computeStudentStatsRows,
  sortStudentStatsRows,
  getWeekStart,
  countRecentlyActiveStudents,
} from './statsScreen';
import type { SessionRecord, Student } from '../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
];

describe('getWeekStart', () => {
  it('returns the same date when given a Saturday', () => {
    // 2026-07-04 is a Saturday
    expect(getWeekStart('2026-07-04')).toBe('2026-07-04');
  });
  it('returns the prior Saturday for a mid-week date', () => {
    // 2026-07-08 is a Wednesday -> prior Saturday is 2026-07-04
    expect(getWeekStart('2026-07-08')).toBe('2026-07-04');
  });
  it('returns the same-week Saturday for a Friday (week end)', () => {
    // 2026-07-10 is a Friday -> week started 2026-07-04
    expect(getWeekStart('2026-07-10')).toBe('2026-07-04');
  });
});

describe('computeSummaryStats', () => {
  it('counts total sessions and unique active students', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01' },
      { id: 'r2', studentId: 's_1', date: '2026-07-02' },
      { id: 'r3', studentId: 's_2', date: '2026-07-01' },
    ];
    const s = computeSummaryStats(records);
    expect(s.totalSessions).toBe(3);
    expect(s.activeStudents).toBe(2);
  });

  it('includes a genuine zero loh score in avgLoh (not skipped)', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 0 } },
      { id: 'r2', studentId: 's_1', date: '2026-07-02', loh: { score: 100 } },
    ];
    expect(computeSummaryStats(records).avgLoh).toBe(50);
  });

  it('falls back to a stars-based estimate when nothing is scored yet', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { stars: 4 } }, // no score, only stars
    ];
    expect(computeSummaryStats(records).avgLoh).toBe(80); // 4 * 20
  });

  it('includes a genuine zero madi score in avgMadi (not skipped)', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', madi: { score: 0 } },
      { id: 'r2', studentId: 's_1', date: '2026-07-02', madi: { score: 100 } },
    ];
    expect(computeSummaryStats(records).avgMadi).toBe(50);
  });

  it('falls back to a stars-based estimate for madi when nothing is scored yet', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', madi: { stars: 4 } },
    ];
    expect(computeSummaryStats(records).avgMadi).toBe(80);
  });

  it('averages madi independently of loh', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 100 }, madi: { score: 60 } },
      { id: 'r2', studentId: 's_1', date: '2026-07-02', loh: { score: 80 }, madi: { score: 70 } },
    ];
    const s = computeSummaryStats(records);
    expect(s.avgLoh).toBe(90);
    expect(s.avgMadi).toBe(65);
  });

  it('ignores unevaluated madi (score null) instead of counting it as zero', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', madi: { score: 90, stars: 5 } },
      { id: 'r2', studentId: 's_1', date: '2026-07-02', madi: { score: null } },
    ];
    expect(computeSummaryStats(records).avgMadi).toBe(90);
  });

  it('sums loh + madi + tajweed ayat into totalAyat', () => {
    const records: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_1',
        date: '2026-07-01',
        newLoh: [{ sura: 'البقرة', from: '1', to: '10' }], // 10 ayat
        newMadi: [{ sura: 'آل عمران', from: '1', to: '5' }], // 5 ayat
        tajweed: { sura: 'النساء', from: '1', to: '2' }, // 2 ayat
      },
    ];
    const s = computeSummaryStats(records);
    expect(s.lohAyat).toBe(10);
    expect(s.madiAyat).toBe(5);
    expect(s.totalAyat).toBe(17);
  });

  it('excludes EXCLUDED_HALAQA_DATES from totalHalaqaDays', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-06-04' }, // excluded bonus day
      { id: 'r2', studentId: 's_1', date: '2026-07-01' },
    ];
    expect(computeSummaryStats(records).totalHalaqaDays).toBe(1);
  });

  it('averages the distinct students present per halaqa day', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01' },
      { id: 'r2', studentId: 's_2', date: '2026-07-01' },
      { id: 'r3', studentId: 's_1', date: '2026-07-02' },
    ];
    // day 1 -> 2 present, day 2 -> 1 present => 1.5
    expect(computeSummaryStats(records).avgDailyAttendance).toBe(1.5);
  });

  it('counts a student once per day even with several records that day', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01' },
      { id: 'att_1', studentId: 's_1', date: '2026-07-01' },
    ];
    expect(computeSummaryStats(records).avgDailyAttendance).toBe(1);
  });

  it('excludes EXCLUDED_HALAQA_DATES from the daily attendance average', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-06-04' }, // excluded bonus day
      { id: 'r2', studentId: 's_2', date: '2026-06-04' },
      { id: 'r3', studentId: 's_1', date: '2026-07-01' },
    ];
    // only 2026-07-01 counts, with a single student present
    expect(computeSummaryStats(records).avgDailyAttendance).toBe(1);
  });

  it('divides by the same day count as totalHalaqaDays when a record has no student', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01' },
      { id: 'r2', date: '2026-07-02' }, // orphan record: day exists, nobody present
    ];
    const s = computeSummaryStats(records);
    expect(s.totalHalaqaDays).toBe(2);
    expect(s.avgDailyAttendance).toBe(0.5);
  });

  it('returns 0 when there are no halaqa days', () => {
    expect(computeSummaryStats([]).avgDailyAttendance).toBe(0);
  });
});

describe('countRecentlyActiveStudents', () => {
  const today = '2026-07-20';

  it('counts a student whose last session is within the window', () => {
    const records: SessionRecord[] = [{ id: 'r1', studentId: 's_1', date: '2026-07-10' }]; // 10 days ago
    expect(countRecentlyActiveStudents(students, records, 30, today)).toBe(1);
  });

  it('excludes a student whose last session is older than the window', () => {
    const records: SessionRecord[] = [{ id: 'r1', studentId: 's_1', date: '2026-05-01' }]; // ~80 days ago
    expect(countRecentlyActiveStudents(students, records, 30, today)).toBe(0);
  });

  it("uses each student's MOST RECENT session, not their first", () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-01-01' }, // old
      { id: 'r2', studentId: 's_1', date: '2026-07-15' }, // recent — this one counts
    ];
    expect(countRecentlyActiveStudents(students, records, 30, today)).toBe(1);
  });

  it('counts a registered student with zero records as not active', () => {
    expect(countRecentlyActiveStudents(students, [], 30, today)).toBe(0);
  });

  it('a date exactly at the cutoff boundary counts as active (inclusive)', () => {
    // 30 days before 2026-07-20 is 2026-06-20.
    const records: SessionRecord[] = [{ id: 'r1', studentId: 's_1', date: '2026-06-20' }];
    expect(countRecentlyActiveStudents(students, records, 30, today)).toBe(1);
  });

  it('counts multiple recently-active students independently', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-18' },
      { id: 'r2', studentId: 's_2', date: '2026-07-19' },
    ];
    expect(countRecentlyActiveStudents(students, records, 30, today)).toBe(2);
  });

  it('never exceeds the number of registered students, even with extra record studentIds', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-18' },
      { id: 'r2', studentId: 's_ghost_deleted', date: '2026-07-18' }, // not in `students`
    ];
    expect(countRecentlyActiveStudents(students, records, 30, today)).toBe(1);
  });
});

describe('computeWeeklyBuckets', () => {
  it('groups sessions by halaqa-week (Saturday start)', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-04' }, // Saturday
      { id: 'r2', studentId: 's_1', date: '2026-07-08' }, // same week
      { id: 'r3', studentId: 's_1', date: '2026-07-11' }, // next Saturday, new week
    ];
    const buckets = computeWeeklyBuckets(records);
    expect(buckets).toEqual([
      { weekStart: '2026-07-04', count: 2 },
      { weekStart: '2026-07-11', count: 1 },
    ]);
  });

  it('caps at the most recent 8 weeks', () => {
    const dates = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2026-01-03'); // a Saturday
      d.setDate(d.getDate() + i * 7);
      return d.toISOString().slice(0, 10);
    });
    const recs: SessionRecord[] = dates.map((date, i) => ({ id: `w${i}`, studentId: 's_1', date }));
    expect(computeWeeklyBuckets(recs)).toHaveLength(8);
  });
});

describe('computeScoreDistribution', () => {
  it('buckets scores into the 5 fixed labels, counting each scored field separately', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 }, madi: { score: 0 } },
    ];
    const dist = computeScoreDistribution(records);
    const byLabel = Object.fromEntries(dist.map((d) => [d.label, d.count]));
    expect(byLabel['ممتاز']).toBe(1); // loh 90
    expect(byLabel['إعادة']).toBe(1); // madi 0 -- regression check for scoreName(0)
  });

  it('computes percentages summing to ~100 across all buckets', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } },
      { id: 'r2', studentId: 's_1', date: '2026-07-02', loh: { score: 60 } },
    ];
    const dist = computeScoreDistribution(records);
    const totalPct = dist.reduce((a, d) => a + d.pct, 0);
    expect(totalPct).toBe(100);
  });

  it('returns all-zero buckets when nothing is scored', () => {
    const dist = computeScoreDistribution([]);
    expect(dist.every((d) => d.count === 0 && d.pct === 0)).toBe(true);
  });
});

describe('computeTopAyat', () => {
  it('ranks students by total ayat, highest first', () => {
    const records: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_1',
        date: '2026-07-01',
        newLoh: [{ sura: 'البقرة', from: '1', to: '50' }],
      },
      {
        id: 'r2',
        studentId: 's_2',
        date: '2026-07-01',
        newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
      },
    ];
    const top = computeTopAyat(students, records);
    expect(top[0].name).toBe('زيد احمد');
    expect(top[0].ayat).toBe(50);
  });

  it('excludes students with no records', () => {
    const records: SessionRecord[] = [{ id: 'r1', studentId: 's_1', date: '2026-07-01' }];
    const top = computeTopAyat(students, records);
    expect(top.find((x) => x.name === 'محمد علي')).toBeUndefined();
  });

  it('respects the limit parameter', () => {
    const many: Student[] = Array.from({ length: 5 }, (_, i) => ({
      id: `s_${i}`,
      name: `طالب ${i}`,
    }));
    const records: SessionRecord[] = many.map((s, i) => ({
      id: `r${i}`,
      studentId: s.id,
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: String(i + 1) }],
    }));
    expect(computeTopAyat(many, records, 3)).toHaveLength(3);
  });
});

describe('computeTopPages', () => {
  it('ranks students by whole pages memorized, highest first', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الناس' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', newLoh: [{ sura: 'الفلق' }] },
      { id: 'r3', studentId: 's_1', date: '2026-07-15', newLoh: [{ sura: 'الإخلاص' }] },
      { id: 'r4', studentId: 's_1', date: '2026-07-22', newLoh: [{ sura: 'المسد' }] },
      { id: 'r5', studentId: 's_1', date: '2026-07-29', newLoh: [{ sura: 'النصر' }] },
      { id: 'r6', studentId: 's_2', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      // Closing sessions that grade the assignments above as recited.
      { id: 'g1', studentId: 's_1', date: '2026-08-05', loh: { score: 90 } },
      { id: 'g2', studentId: 's_2', date: '2026-08-05', loh: { score: 90 } },
    ];
    const top = computeTopPages(students, records);
    expect(top[0]).toMatchObject({ name: 'زيد احمد', pages: 1 });
    expect(top[1]).toMatchObject({ name: 'محمد علي', pages: 1 });
  });

  it('does not count a page that is only partly memorized', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الناس' }] },
    ];
    expect(computeTopPages(students, records)).toHaveLength(0);
  });

  it('ignores الماضي — revision is not new memorization', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newMadi: [{ sura: 'الفاتحة' }] },
    ];
    expect(computeTopPages(students, records)).toHaveLength(0);
  });

  it('ignores التجويد, which is recitation practice rather than new ground', () => {
    const records: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_1',
        date: '2026-07-01',
        tajweed: { sura: 'الفاتحة', from: '1', to: '7', score: 95, stars: 5 },
      },
    ];
    expect(computeTopPages(students, records)).toHaveLength(0);
  });

  it('keeps an assignment the NEXT session graded إعادة', () => {
    // Under the path model an إعادة is a quality signal, not a retreat: the
    // student still stands where the assignment put them, and the grade is
    // already reflected in التقييم. Voiding the page as well punished it twice
    // and left a hole no later session could fill.
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', loh: { score: 40, stars: 0 } },
    ];
    expect(computeTopPages(students, records)[0].pages).toBe(1);
  });

  it('keeps an assignment that passed, and one not graded yet', () => {
    const passed: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', loh: { score: 90, stars: 5 } },
    ];
    expect(computeTopPages(students, passed)[0].pages).toBe(1);

    // Not yet recited: the assignment stands, but it is homework, not memory.
    const ungraded: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
    ];
    expect(computeTopPages(students, ungraded)).toHaveLength(0);
  });

  it('counts a page once, however often it is re-assigned', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', newLoh: [{ sura: 'الفاتحة' }] },
      {
        id: 'r3',
        studentId: 's_1',
        date: '2026-07-15',
        newLoh: [{ sura: 'الفاتحة', from: '1', to: '7' }],
      },
      { id: 'r4', studentId: 's_1', date: '2026-07-22', loh: { score: 90 } },
    ];
    expect(computeTopPages(students, records)[0].pages).toBe(1);
  });

  it('measures a month by the ground covered inside it', () => {
    const records: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_1',
        date: '2026-06-24',
        newLoh: [{ sura: 'الفاتحة', from: '1', to: '4' }],
      },
      {
        id: 'r2',
        studentId: 's_1',
        date: '2026-07-01',
        newLoh: [{ sura: 'الفاتحة', from: '5', to: '7' }],
      },
      { id: 'r3', studentId: 's_1', date: '2026-07-08', loh: { score: 90 } },
    ];
    // June's sessions alone cover الفاتحة ١-٤ — not a whole page.
    expect(computeTopPages(students, records, 3, '2026-06')).toHaveLength(0);
    // July's alone cover ٥-٧, also not a whole page on their own.
    expect(computeTopPages(students, records, 3, '2026-07')).toHaveLength(0);
    // End to end, the page is complete.
    expect(computeTopPages(students, records, 3, 'all')[0].pages).toBe(1);
  });

  it('excludes students with no completed pages instead of listing zeros', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_2', date: '2026-07-01', newLoh: [{ sura: 'الناس' }] },
      { id: 'g1', studentId: 's_1', date: '2026-07-08', loh: { score: 90 } },
      { id: 'g2', studentId: 's_2', date: '2026-07-08', loh: { score: 90 } },
    ];
    const top = computeTopPages(students, records);
    expect(top).toHaveLength(1);
    expect(top[0].name).toBe('زيد احمد');
  });

  it('respects the limit parameter', () => {
    const many: Student[] = Array.from({ length: 5 }, (_, i) => ({
      id: `s_${i}`,
      name: `طالب ${i}`,
    }));
    const records: SessionRecord[] = many.flatMap((s, i) => [
      {
        id: `r${i}`,
        studentId: s.id,
        date: '2026-07-01',
        newLoh: [{ sura: 'البقرة', from: '1', to: String(30 + i * 20) }],
      },
      { id: `g${i}`, studentId: s.id, date: '2026-07-08', loh: { score: 90 } },
    ]);
    expect(computeTopPages(many, records, 3)).toHaveLength(3);
  });
});

describe('computeStudentStatsRows / sortStudentStatsRows', () => {
  const records: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 70 } },
    { id: 'r2', studentId: 's_1', date: '2026-07-02', loh: { score: 90 } },
    { id: 'r3', studentId: 's_2', date: '2026-07-01', loh: { score: 100 } },
  ];

  it('computes attendPct relative to totalHalaqaDays', () => {
    const rows = computeStudentStatsRows(students, records, 2);
    const zaid = rows.find((r) => r.name === 'زيد احمد')!;
    expect(zaid.attendPct).toBe(100); // attended both days
  });

  it('sorts by attendance descending by default key', () => {
    const rows = computeStudentStatsRows(students, records, 2);
    const sorted = sortStudentStatsRows(rows, 'attend');
    expect(sorted[0].attendPct).toBeGreaterThanOrEqual(sorted[1]?.attendPct ?? 0);
  });

  it('sorts by average score', () => {
    const rows = computeStudentStatsRows(students, records, 2);
    const sorted = sortStudentStatsRows(rows, 'avg');
    expect(sorted[0].name).toBe('محمد علي'); // avg 100 > zaid's avg 80
  });

  it('sorts by name using Arabic locale comparison', () => {
    const rows = computeStudentStatsRows(students, records, 2);
    const sorted = sortStudentStatsRows(rows, 'name');
    expect(sorted.map((r) => r.name)).toEqual(
      [...rows.map((r) => r.name)].sort((a, b) => a.localeCompare(b, 'ar')),
    );
  });
});

describe('computeSummaryStats — إعادة does not count as recited', () => {
  const recs: SessionRecord[] = [
    {
      id: 'r1',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
      newMadi: [{ sura: 'الفاتحة' }],
    },
    {
      id: 'r2',
      studentId: 's_1',
      date: '2026-07-03',
      loh: { score: 50 }, // fails البقرة ١–١٠
      madi: { score: 90 }, // passes الفاتحة
    },
  ];

  it('excludes the failed loh assignment but keeps the passed madi one', () => {
    const s = computeSummaryStats(recs);
    expect(s.lohAyat).toBe(0);
    expect(s.madiAyat).toBe(7);
    expect(s.totalAyat).toBe(7);
  });

  it('matches the parent page rather than disagreeing with it', () => {
    // Same records, same rule → the admin total equals what a parent is shown.
    expect(computeSummaryStats(recs).totalAyat).toBe(7);
  });

  it('still catches a failure that lands outside the filtered month', () => {
    const july = recs.filter((r) => r.date!.startsWith('2026-07'));
    const crossing: SessionRecord[] = [
      {
        id: 'j1',
        studentId: 's_1',
        date: '2026-07-31',
        newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
      },
      { id: 'a1', studentId: 's_1', date: '2026-08-02', loh: { score: 40 } },
    ];
    const julyOnly = crossing.filter((r) => r.date!.startsWith('2026-07'));
    // Without the unfiltered second argument the August grade is invisible…
    expect(computeSummaryStats(julyOnly).lohAyat).toBe(10);
    // …with it, the failure counts against July's number.
    expect(computeSummaryStats(julyOnly, crossing).lohAyat).toBe(0);
    expect(july.length).toBe(2);
  });

  it('drops tajweed graded إعادة', () => {
    const t: SessionRecord[] = [
      { id: 't1', studentId: 's_1', date: '2026-07-01', tajweed: { sura: 'الفاتحة', score: 30 } },
      { id: 't2', studentId: 's_1', date: '2026-07-03', tajweed: { sura: 'الفاتحة', score: 85 } },
    ];
    expect(computeSummaryStats(t).totalAyat).toBe(7);
  });
});

describe('leaderboard identity and limits', () => {
  const twoSameName: Student[] = [
    { id: 's_1', name: 'محمد علي' },
    { id: 's_2', name: 'محمد علي' },
  ];
  const recs: SessionRecord[] = [
    {
      id: 'r1',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: '60' }],
    },
    {
      id: 'r2',
      studentId: 's_2',
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: '20' }],
    },
    // Sessions confirming both assignments were recited.
    { id: 'g1', studentId: 's_1', date: '2026-07-08', loh: { score: 90 } },
    { id: 'g2', studentId: 's_2', date: '2026-07-08', loh: { score: 90 } },
  ];

  it('carries the stable student id on page leaderboard entries', () => {
    // Names collide, so the id is the only thing that can tell the rows apart.
    const top = computeTopPages(twoSameName, recs, Infinity);
    expect(top.map((x) => x.id)).toEqual(['s_1', 's_2']);
  });

  it('carries the stable student id on breakdown rows', () => {
    const rows = computeStudentStatsRows(twoSameName, recs, 1);
    expect(rows.map((x) => x.id)).toEqual(['s_1', 's_2']);
  });

  it('returns every qualifying student when no limit is given', () => {
    const many: Student[] = Array.from({ length: 7 }, (_, i) => ({
      id: `s_${i}`,
      name: `طالب ${i}`,
    }));
    const manyRecs: SessionRecord[] = many.flatMap((s, i) => [
      {
        id: `r_${i}`,
        studentId: s.id,
        date: '2026-07-01',
        newLoh: [{ sura: 'البقرة', from: '1', to: String(30 + i * 5) }],
      },
      { id: `g_${i}`, studentId: s.id, date: '2026-07-08', loh: { score: 90 } },
    ]);
    expect(computeTopPages(many, manyRecs, Infinity)).toHaveLength(7);
  });

  it('still honours an explicit limit', () => {
    expect(computeTopPages(twoSameName, recs, 1)).toHaveLength(1);
  });
});

describe('computeStudentStatsRows — students with nothing recorded', () => {
  const roster: Student[] = [
    { id: 's_1', name: 'زيد احمد' },
    { id: 's_2', name: 'محمد علي' }, // never recorded anything
  ];
  const recs: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } },
  ];

  it('keeps a student who has no records at all', () => {
    const rows = computeStudentStatsRows(roster, recs, 1);
    expect(rows.map((r) => r.id)).toEqual(['s_1', 's_2']);
  });

  it('reports zeros, not fabricated activity, for that student', () => {
    const row = computeStudentStatsRows(roster, recs, 1).find((r) => r.id === 's_2')!;
    expect(row.sessionsCount).toBe(0);
    expect(row.uniqueDays).toBe(0);
    expect(row.attendPct).toBe(0);
    expect(row.ayat).toBe(0);
  });

  it('leaves the average unset rather than reporting 0٪', () => {
    // A student with no evaluation has no average. Reporting 0 would read as
    // a failing grade for someone who was simply never assessed.
    const row = computeStudentStatsRows(roster, recs, 1).find((r) => r.id === 's_2')!;
    expect(row.avg).toBeNull();
  });

  it('leaves the average unset when records exist but none were scored', () => {
    const unscored: SessionRecord[] = [{ id: 'r9', studentId: 's_2', date: '2026-07-01' }];
    const row = computeStudentStatsRows(roster, [...recs, ...unscored], 1).find(
      (r) => r.id === 's_2',
    )!;
    expect(row.sessionsCount).toBe(1);
    expect(row.avg).toBeNull();
  });

  it('sorts unset averages last, never as if they were zero', () => {
    const rows = sortStudentStatsRows(computeStudentStatsRows(roster, recs, 1), 'avg');
    expect(rows.map((r) => r.id)).toEqual(['s_1', 's_2']);
  });
});

describe('computeFollowUpList', () => {
  const roster: Student[] = [
    { id: 's_1', name: 'زيد احمد' },
    { id: 's_2', name: 'محمد علي' },
    { id: 's_3', name: 'عمر حسن' },
  ];
  // Halaqa days: 07-01, 07-08, 07-15, 07-22
  const recs: SessionRecord[] = [
    { id: 'a1', studentId: 's_1', date: '2026-07-01' },
    { id: 'a2', studentId: 's_1', date: '2026-07-22' }, // present latest -> fine
    { id: 'b1', studentId: 's_2', date: '2026-07-08' }, // missed last two
    { id: 'c1', studentId: 's_3', date: '2026-07-15' }, // missed last one only
  ];

  it('lists only students who missed at least the alert streak', () => {
    const list = computeFollowUpList(roster, recs, 2);
    expect(list.map((x) => x.id)).toEqual(['s_2']);
  });

  it('reports the streak length and the last day attended', () => {
    const [entry] = computeFollowUpList(roster, recs, 2);
    expect(entry.absenceStreak).toBe(2);
    expect(entry.lastAttended).toBe('2026-07-08');
    expect(entry.neverAttended).toBe(false);
  });

  it('flags a student who never attended instead of implying a lapse', () => {
    const withNewcomer = [...roster, { id: 's_4', name: 'انس طارق' }];
    const entry = computeFollowUpList(withNewcomer, recs, 2).find((x) => x.id === 's_4')!;
    expect(entry.neverAttended).toBe(true);
    expect(entry.lastAttended).toBeNull();
  });

  it('sorts the longest absence first', () => {
    const withNewcomer = [...roster, { id: 's_4', name: 'انس طارق' }];
    expect(computeFollowUpList(withNewcomer, recs, 2).map((x) => x.id)).toEqual(['s_4', 's_2']);
  });

  it('returns an empty list when everyone attended the latest halaqa day', () => {
    const allPresent: SessionRecord[] = roster.map((s, i) => ({
      id: `p${i}`,
      studentId: s.id,
      date: '2026-07-22',
    }));
    expect(computeFollowUpList(roster, allPresent, 2)).toEqual([]);
  });
});

describe('computeLohSpan', () => {
  const yassin: Student = { id: 's_y', name: 'ياسين الشناوي' };
  /** A session that assigns new work AND grades the previous assignment —
   * the shape every real session has. */
  const s = (id: string, date: string, sura: string, from: string, to: string): SessionRecord => ({
    id,
    studentId: 's_y',
    date,
    newLoh: [{ sura, from, to }],
    loh: { score: 90 },
  });

  /** Adds the session that grades the closing assignment, so the fixture
   * describes work already recited rather than homework still pending. */
  const recited = (recs: SessionRecord[]): SessionRecord[] => [
    ...recs,
    { id: 'g_end', studentId: 's_y', date: '2026-12-01', loh: { score: 90 } },
  ];

  it('spans from the first session start to the last session end', () => {
    const recs = [
      s('r1', '2026-05-01', 'الحاقة', '38', '52'),
      s('r2', '2026-06-01', 'الملك', '1', '30'),
      s('r3', '2026-07-01', 'التحريم', '1', '12'),
    ];
    const span = computeLohSpan(yassin, recited(recs))!;
    expect(span.startLabel).toBe('الحاقة ٣٨');
    expect(span.endLabel).toBe('التحريم ١٢');
  });

  it('counts pages across a gap the records never mention', () => {
    // القلم is skipped entirely, yet it lies between the endpoints and the
    // student demonstrably passed through it.
    const recs = [
      s('r1', '2026-05-01', 'الحاقة', '38', '52'),
      s('r2', '2026-07-01', 'التحريم', '1', '12'),
    ];
    expect(computeLohSpan(yassin, recited(recs))!.pages).toBe(6);
  });

  it('matches the same journey recorded session by session', () => {
    const recs = [
      s('r1', '2026-05-01', 'الحاقة', '38', '52'),
      s('r2', '2026-05-08', 'القلم', '1', '52'),
      s('r3', '2026-06-01', 'الملك', '1', '30'),
      s('r4', '2026-07-01', 'التحريم', '1', '12'),
    ];
    expect(computeLohSpan(yassin, recited(recs))!.pages).toBe(6);
  });

  it('is unaffected by an إعادة grade on the closing session', () => {
    const recs = [
      s('r1', '2026-05-01', 'الحاقة', '38', '52'),
      s('r2', '2026-07-01', 'التحريم', '1', '12'),
      { id: 'r3', studentId: 's_y', date: '2026-07-08', loh: { score: 40 } },
    ];
    expect(computeLohSpan(yassin, recited(recs))!.pages).toBe(6);
  });

  it('ignores attendance-only records when locating the endpoints', () => {
    const recs: SessionRecord[] = [
      { id: 'att_1', studentId: 's_y', date: '2026-04-01', attendance_only: true },
      s('r1', '2026-05-01', 'الحاقة', '38', '52'),
      s('r2', '2026-07-01', 'التحريم', '1', '12'),
    ];
    expect(computeLohSpan(yassin, recited(recs))!.startLabel).toBe('الحاقة ٣٨');
  });

  it("reports zero pages when the closing session contradicts the student's own direction", () => {
    // Three steps confirm the halaqa's descending order, then the final
    // session lands on المعارج — earlier on that path than where he began.
    // The span is meaningless, and inventing a number would hide bad data.
    const recs = [
      s('r1', '2026-04-01', 'الحاقة', '38', '52'),
      s('r2', '2026-05-01', 'القلم', '1', '52'),
      s('r3', '2026-06-01', 'الملك', '1', '30'),
      s('r4', '2026-07-01', 'المعارج', '1', '10'),
    ];
    const span = computeLohSpan(yassin, recited(recs))!;
    expect(span.direction).toBe('descending');
    expect(span.reversed).toBe(true);
    expect(span.pages).toBe(0);
  });

  it('treats a forward move in mushaf order as progress, not a reversal', () => {
    const recs = [
      s('r1', '2026-05-01', 'التحريم', '1', '12'),
      s('r2', '2026-07-01', 'الحاقة', '38', '52'),
    ];
    const span = computeLohSpan(yassin, recited(recs))!;
    expect(span.direction).toBe('ascending');
    expect(span.reversed).toBe(false);
  });

  it('returns null for a student with no assignments at all', () => {
    expect(computeLohSpan(yassin, [])).toBeNull();
  });

  it('narrows to the sessions inside a month filter', () => {
    const recs = [
      s('r1', '2026-05-01', 'الحاقة', '38', '52'),
      s('r2', '2026-06-01', 'القلم', '1', '52'),
      s('r3', '2026-07-01', 'التحريم', '1', '12'),
    ];
    const span = computeLohSpan(yassin, recited(recs), '2026-06')!;
    expect(span.startLabel).toBe('القلم ١');
    expect(span.endLabel).toBe('القلم ٥٢');
  });
});

describe('computeTopPages — measured along the memorization path', () => {
  const roster: Student[] = [{ id: 's_y', name: 'ياسين الشناوي' }];

  it('does not lose pages to a gap in the records', () => {
    const recs: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_y',
        date: '2026-05-01',
        newLoh: [{ sura: 'الحاقة', from: '38', to: '52' }],
      },
      {
        id: 'r2',
        studentId: 's_y',
        date: '2026-07-01',
        newLoh: [{ sura: 'التحريم', from: '1', to: '12' }],
        loh: { score: 90 },
      },
      { id: 'g1', studentId: 's_y', date: '2026-08-01', loh: { score: 90 } },
    ];
    expect(computeTopPages(roster, recs, Infinity)[0].pages).toBe(6);
  });

  it('exposes the span endpoints alongside the count', () => {
    const recs: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_y',
        date: '2026-05-01',
        newLoh: [{ sura: 'الحاقة', from: '38', to: '52' }],
      },
      {
        id: 'r2',
        studentId: 's_y',
        date: '2026-07-01',
        newLoh: [{ sura: 'التحريم', from: '1', to: '12' }],
        loh: { score: 90 },
      },
      { id: 'g1', studentId: 's_y', date: '2026-08-01', loh: { score: 90 } },
    ];
    const entry = computeTopPages(roster, recs, Infinity)[0];
    expect(entry.startLabel).toBe('الحاقة ٣٨');
    expect(entry.endLabel).toBe('التحريم ١٢');
  });
});

describe('detectMemorizationDirection', () => {
  const r = (id: string, date: string, sura: string): SessionRecord => ({
    id,
    studentId: 's_1',
    date,
    newLoh: [{ sura, from: '1', to: '5' }],
  });

  it('reads moves to lower sura numbers as the halaqa default order', () => {
    expect(
      detectMemorizationDirection([r('a', '2026-05-01', 'الحاقة'), r('b', '2026-06-01', 'الملك')]),
    ).toBe('descending');
  });

  it('reads moves to higher sura numbers as mushaf order', () => {
    expect(
      detectMemorizationDirection([
        r('a', '2026-05-01', 'البقرة'),
        r('b', '2026-06-01', 'آل عمران'),
      ]),
    ).toBe('ascending');
  });

  it('follows the majority rather than a single stray session', () => {
    // Four forward steps in mushaf order, one session out of place.
    const recs = [
      r('a', '2026-01-01', 'البقرة'),
      r('b', '2026-02-01', 'آل عمران'),
      r('c', '2026-03-01', 'الناس'), // stray
      r('d', '2026-04-01', 'النساء'),
      r('e', '2026-05-01', 'المائدة'),
      r('f', '2026-06-01', 'الأنعام'),
    ];
    expect(detectMemorizationDirection(recs)).toBe('ascending');
  });

  it('defaults to the halaqa order while the student is still inside one sura', () => {
    expect(
      detectMemorizationDirection([r('a', '2026-05-01', 'البقرة'), r('b', '2026-06-01', 'البقرة')]),
    ).toBe('descending');
  });

  it('defaults to the halaqa order with no usable records', () => {
    expect(detectMemorizationDirection([])).toBe('descending');
  });
});

describe('computeLohSpan — mushaf-order students', () => {
  const walid: Student = { id: 's_w', name: 'وليد' };
  const r = (id: string, date: string, sura: string, f: string, t: string): SessionRecord => ({
    id,
    studentId: 's_w',
    date,
    newLoh: [{ sura, from: f, to: t }],
    loh: { score: 90 },
  });
  const recited = (recs: SessionRecord[]): SessionRecord[] => [
    ...recs,
    { id: 'g_w', studentId: 's_w', date: '2026-12-01', loh: { score: 90 } },
  ];

  it('does not read a move from البقرة to آل عمران as going backwards', () => {
    const recs = [
      r('a', '2026-05-01', 'البقرة', '1', '10'),
      r('b', '2026-06-01', 'آل عمران', '1', '20'),
    ];
    const span = computeLohSpan(walid, recited(recs))!;
    expect(span.reversed).toBe(false);
    expect(span.pages).toBeGreaterThan(45);
    expect(span.direction).toBe('ascending');
  });

  it('still measures a student who has not left البقرة yet', () => {
    const recs = [
      r('a', '2026-05-01', 'البقرة', '1', '10'),
      r('b', '2026-06-01', 'البقرة', '11', '60'),
    ];
    expect(computeLohSpan(walid, recited(recs))!.pages).toBe(7);
  });
});

describe('computeLohSpan — only what has actually been recited', () => {
  const st: Student = { id: 's_g', name: 'طالب' };
  /** A session that assigns `sura f-t` and grades the PREVIOUS assignment. */
  const sess = (
    id: string,
    date: string,
    assign: [string, string, string] | null,
    grade: number | null,
  ): SessionRecord => ({
    id,
    studentId: 's_g',
    date,
    ...(assign ? { newLoh: [{ sura: assign[0], from: assign[1], to: assign[2] }] } : {}),
    ...(grade === null ? {} : { loh: { score: grade } }),
  });

  it('ignores the closing assignment, which has not been recited yet', () => {
    const recs = [
      sess('r1', '2026-05-01', ['الحاقة', '38', '52'], null),
      sess('r2', '2026-05-08', ['القلم', '1', '52'], 90), // grades الحاقة
      sess('r3', '2026-05-15', ['الملك', '1', '30'], 85), // grades القلم
      // الملك is assigned but never graded — next week has not happened.
    ];
    const span = computeLohSpan(st, recs)!;
    expect(span.endLabel).toBe('القلم ٥٢');
  });

  it('extends the span once the pending assignment is graded', () => {
    const recs = [
      sess('r1', '2026-05-01', ['الحاقة', '38', '52'], null),
      sess('r2', '2026-05-08', ['القلم', '1', '52'], 90),
      sess('r3', '2026-05-15', ['الملك', '1', '30'], 85),
      sess('r4', '2026-05-22', null, 80), // grades الملك
    ];
    expect(computeLohSpan(st, recs)!.endLabel).toBe('الملك ٣٠');
  });

  it('accepts an إعادة as having been recited', () => {
    // The student stood and recited; the grade says how well, not whether.
    const recs = [
      sess('r1', '2026-05-01', ['الحاقة', '38', '52'], null),
      sess('r2', '2026-05-08', ['القلم', '1', '52'], 40),
    ];
    expect(computeLohSpan(st, recs)!.endLabel).toBe('الحاقة ٥٢');
  });

  it('returns null while nothing has been recited yet', () => {
    const recs = [sess('r1', '2026-05-01', ['الحاقة', '38', '52'], null)];
    expect(computeLohSpan(st, recs)).toBeNull();
  });

  it('looks past the month boundary for the grade', () => {
    // June's closing assignment is graded in July; that grade still confirms it.
    const recs = [
      sess('r1', '2026-06-01', ['الحاقة', '38', '52'], null),
      sess('r2', '2026-06-08', ['القلم', '1', '52'], 90),
      sess('r3', '2026-07-01', null, 85),
    ];
    expect(computeLohSpan(st, recs, '2026-06')!.endLabel).toBe('القلم ٥٢');
  });
});
