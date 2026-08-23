import { describe, it, expect } from 'vitest';
import {
  computeSummaryStats,
  computeWeeklyBuckets,
  computeScoreDistribution,
  computeTopAyat,
  computeTopPages,
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

  it('drops an assignment the NEXT session graded إعادة', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', loh: { score: 40, stars: 0 } },
    ];
    expect(computeTopPages(students, records)).toHaveLength(0);
  });

  it('keeps an assignment that passed, and one not graded yet', () => {
    const passed: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_1', date: '2026-07-08', loh: { score: 90, stars: 5 } },
    ];
    expect(computeTopPages(students, passed)[0].pages).toBe(1);

    const ungraded: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
    ];
    expect(computeTopPages(students, ungraded)[0].pages).toBe(1);
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
    ];
    expect(computeTopPages(students, records)[0].pages).toBe(1);
  });

  it('credits a page to the month it was FINISHED in', () => {
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
    ];
    expect(computeTopPages(students, records, 3, '2026-06')).toHaveLength(0);
    expect(computeTopPages(students, records, 3, '2026-07')[0].pages).toBe(1);
    expect(computeTopPages(students, records, 3, 'all')[0].pages).toBe(1);
  });

  it('excludes students with no completed pages instead of listing zeros', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      { id: 'r2', studentId: 's_2', date: '2026-07-01', newLoh: [{ sura: 'الناس' }] },
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
    const records: SessionRecord[] = many.map((s, i) => ({
      id: `r${i}`,
      studentId: s.id,
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: String(30 + i * 20) }],
    }));
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
    const manyRecs: SessionRecord[] = many.map((s, i) => ({
      id: `r_${i}`,
      studentId: s.id,
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: String(30 + i * 5) }],
    }));
    expect(computeTopPages(many, manyRecs, Infinity)).toHaveLength(7);
  });

  it('still honours an explicit limit', () => {
    expect(computeTopPages(twoSameName, recs, 1)).toHaveLength(1);
  });
});
