import { describe, it, expect } from 'vitest';
import {
  computeSummaryStats,
  computeWeeklyBuckets,
  computeScoreDistribution,
  computeTopAyat,
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

  it('uses each student\'s MOST RECENT session, not their first', () => {
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
      { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'البقرة', from: '1', to: '50' }] },
      { id: 'r2', studentId: 's_2', date: '2026-07-01', newLoh: [{ sura: 'البقرة', from: '1', to: '10' }] },
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
    const many: Student[] = Array.from({ length: 5 }, (_, i) => ({ id: `s_${i}`, name: `طالب ${i}` }));
    const records: SessionRecord[] = many.map((s, i) => ({
      id: `r${i}`,
      studentId: s.id,
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: String(i + 1) }],
    }));
    expect(computeTopAyat(many, records, 3)).toHaveLength(3);
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
    expect(sorted.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].sort((a, b) => a.localeCompare(b, 'ar')));
  });
});
