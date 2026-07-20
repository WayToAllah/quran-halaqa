import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_STREAK_THRESHOLD,
  EXCELLENCE_SCORE_THRESHOLD,
  buildStudentBadges,
  buildStudentPublicStats,
  computeIsImproving,
} from './stats';
import type { SessionRecord, Student } from '../types';

const zaid: Student = { id: 's_1', name: 'زيد احمد' };

describe('buildStudentBadges', () => {
  it('awards perfectAttendance at exactly 100%', () => {
    const badges = buildStudentBadges({
      attendPct: 100,
      allRecs: [],
      realRecsNewestFirst: [],
      totalAyat: 0,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc: [],
    });
    expect(badges.some((b) => b.key === 'perfectAttendance')).toBe(true);
  });

  it('does not award perfectAttendance below 100%', () => {
    const badges = buildStudentBadges({
      attendPct: 99,
      allRecs: [],
      realRecsNewestFirst: [],
      totalAyat: 0,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc: [],
    });
    expect(badges.some((b) => b.key === 'perfectAttendance')).toBe(false);
  });

  it('awards the streak badge at the threshold, not one below', () => {
    const halaqaDatesDesc = Array.from({ length: ATTENDANCE_STREAK_THRESHOLD }, (_, i) => `2026-07-${(i + 1).toString().padStart(2, '0')}`).reverse();
    const allRecsFull = halaqaDatesDesc.map((date, i) => ({ id: `r${i}`, date }) as SessionRecord);
    const fullBadges = buildStudentBadges({
      attendPct: 50,
      allRecs: allRecsFull,
      realRecsNewestFirst: [],
      totalAyat: 0,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc,
    });
    expect(fullBadges.some((b) => b.key === 'streak')).toBe(true);

    const oneShort = allRecsFull.slice(1); // missing the most recent day -> streak breaks immediately
    const shortBadges = buildStudentBadges({
      attendPct: 50,
      allRecs: oneShort,
      realRecsNewestFirst: [],
      totalAyat: 0,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc,
    });
    expect(shortBadges.some((b) => b.key === 'streak')).toBe(false);
  });

  it('awards ayat milestone badges only once thresholds are met', () => {
    const badges100 = buildStudentBadges({
      attendPct: 0,
      allRecs: [],
      realRecsNewestFirst: [],
      totalAyat: 100,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc: [],
    });
    expect(badges100.map((b) => b.key)).toContain('ayat100');
    expect(badges100.map((b) => b.key)).not.toContain('ayat200');
  });

  it('awards excellence at the score threshold using the combined avg', () => {
    const badges = buildStudentBadges({
      attendPct: 0,
      allRecs: [],
      realRecsNewestFirst: [],
      totalAyat: 0,
      avgLoh: EXCELLENCE_SCORE_THRESHOLD,
      avgMadi: EXCELLENCE_SCORE_THRESHOLD,
      halaqaDatesDesc: [],
    });
    expect(badges.some((b) => b.key === 'excellence')).toBe(true);
  });
});

describe('computeIsImproving', () => {
  it('requires at least 6 scored sessions', () => {
    const fiveSessions = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      date: '2026-07-01',
      loh: { score: 90 },
    })) as SessionRecord[];
    expect(computeIsImproving(fiveSessions)).toBe(false);
  });

  it('detects improvement: recent 3 average higher than prior 3', () => {
    // newest-first: [90,90,90, 60,60,60] -> recent avg 90 > prior avg 60
    const recs = [90, 90, 90, 60, 60, 60].map(
      (score, i) => ({ id: `r${i}`, date: '2026-07-01', loh: { score } }) as SessionRecord,
    );
    expect(computeIsImproving(recs)).toBe(true);
  });

  it('detects no improvement when recent average is lower', () => {
    const recs = [60, 60, 60, 90, 90, 90].map(
      (score, i) => ({ id: `r${i}`, date: '2026-07-01', loh: { score } }) as SessionRecord,
    );
    expect(computeIsImproving(recs)).toBe(false);
  });
});

describe('buildStudentPublicStats', () => {
  const records: SessionRecord[] = [
    {
      id: 'r1',
      studentId: 's_1',
      date: '2026-07-01',
      loh: { score: 0 }, // genuine zero — must count as scored, not be skipped
      newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
    },
    {
      id: 'r2',
      studentId: 's_1',
      date: '2026-07-03',
      loh: { score: 90 },
      madi: { score: 80 },
      newLoh: [{ sura: 'البقرة', from: '11', to: '20' }],
    },
  ];

  it('includes a genuine zero score in the average (not skipped as unset)', () => {
    const result = buildStudentPublicStats(zaid, records, 2, 1, ['2026-07-03', '2026-07-01']);
    // avgLoh should be round((0 + 90) / 2) = 45, proving the 0 was counted
    expect(result.avgLoh).toBe(45);
  });

  it('never publishes phone numbers on the public payload', () => {
    const result = buildStudentPublicStats(zaid, records, 2, 1, ['2026-07-03', '2026-07-01']);
    expect(result).not.toHaveProperty('phonePrimary');
    expect(result).not.toHaveProperty('phoneSecondary');
  });

  it('sums total ayat memorized across all real sessions', () => {
    const result = buildStudentPublicStats(zaid, records, 2, 1, ['2026-07-03', '2026-07-01']);
    expect(result.totalAyat).toBe(10 + 10); // (1-10) + (11-20)
  });

  it('sets currentTask from the most recent real session', () => {
    const result = buildStudentPublicStats(zaid, records, 2, 1, ['2026-07-03', '2026-07-01']);
    expect(result.currentTask?.date).toBe('2026-07-03');
  });

  it('returns null averages when nothing has been scored yet', () => {
    const unscored: SessionRecord[] = [{ id: 'r1', studentId: 's_1', date: '2026-07-01' }];
    const result = buildStudentPublicStats(zaid, unscored, 1, null, ['2026-07-01']);
    expect(result.avgLoh).toBeNull();
    expect(result.avgMadi).toBeNull();
  });

  it('builds scoreHistory oldest-first, only for scored sessions', () => {
    const result = buildStudentPublicStats(zaid, records, 2, 1, ['2026-07-03', '2026-07-01']);
    expect(result.scoreHistory).toEqual([
      { date: '2026-07-01', loh: 0, madi: null },
      { date: '2026-07-03', loh: 90, madi: 80 },
    ]);
  });

  it('aggregates monthlyStats keyed by YYYY-MM', () => {
    const result = buildStudentPublicStats(zaid, records, 2, 1, ['2026-07-03', '2026-07-01']);
    expect(result.monthlyStats['2026-07']).toEqual({
      attendPct: 100, // 2 unique days / 2 halaqa days
      sessionsCount: 2,
      totalAyat: 20,
      avgLoh: 45,
    });
  });

  it('carries a whole-sura range assignment through to currentTask and recentSessions', () => {
    const withRange: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_1',
        date: '2026-07-01',
        loh: { score: 88 },
        newLoh: [{ sura: 'الملك', toSura: 'الناس', range: true }],
      },
    ];
    const result = buildStudentPublicStats(zaid, withRange, 1, 1, ['2026-07-01']);
    // The range fields must reach publicStats unmodified so the parent page
    // can render "من الملك إلى الناس".
    expect(result.currentTask?.newLoh).toEqual([{ sura: 'الملك', toSura: 'الناس', range: true }]);
    expect(result.recentSessions[0].newLoh).toEqual([
      { sura: 'الملك', toSura: 'الناس', range: true },
    ]);
    // A whole-sura range counts the sum of every sura's ayat across the span
    // (الملك→الناس = 48 suras = 995 ayat), matching production's itemAyat.
    expect(result.totalAyat).toBe(995);
  });

  it('carries the mistake tally into recentSessions when present', () => {
    const withMistakes: SessionRecord[] = [
      {
        id: 'r1',
        studentId: 's_1',
        date: '2026-07-01',
        loh: { score: 97, mistakes: { full: 2, tajweed: 2 } },
        newLoh: [{ sura: 'البقرة', from: '1', to: '5' }],
      },
    ];
    const result = buildStudentPublicStats(zaid, withMistakes, 1, 1, ['2026-07-01']);
    expect(result.recentSessions[0].loh).toEqual({ score: 97, mistakes: { full: 2, tajweed: 2 } });
  });
});
