import { describe, it, expect } from 'vitest';
import { scoreName } from './scoring';
import {
  ATTENDANCE_STREAK_THRESHOLD,
  AYAT_MILESTONES,
  EXCELLENCE_SCORE_THRESHOLD,
  buildStudentBadges,
  buildStudentPublicStats,
  computeIsImproving,
} from './stats';
import { HIDDEN_BADGE_KEYS } from './badges';
import type { SessionRecord, Student } from '../types';

const zaid: Student = { id: 's_1', name: 'زيد احمد' };

describe('EXCELLENCE_SCORE_THRESHOLD', () => {
  it('sits at the top grade band so the badge always means ممتاز', () => {
    // Pinned by value on purpose: the other tests reference the constant
    // symbolically, so they would follow it silently wherever it moved.
    expect(EXCELLENCE_SCORE_THRESHOLD).toBe(90);
    expect(scoreName(EXCELLENCE_SCORE_THRESHOLD)).toBe('ممتاز');
    expect(scoreName(EXCELLENCE_SCORE_THRESHOLD - 1)).not.toBe('ممتاز');
  });
});

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
    const halaqaDatesDesc = Array.from(
      { length: ATTENDANCE_STREAK_THRESHOLD },
      (_, i) => `2026-07-${(i + 1).toString().padStart(2, '0')}`,
    ).reverse();
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
    const badges500 = buildStudentBadges({
      attendPct: 0,
      allRecs: [],
      realRecsNewestFirst: [],
      totalAyat: 500,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc: [],
    });
    expect(badges500.map((b) => b.key)).toContain('ayat500');

    const badges499 = buildStudentBadges({
      attendPct: 0,
      allRecs: [],
      realRecsNewestFirst: [],
      totalAyat: 499,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc: [],
    });
    expect(badges499.map((b) => b.key)).not.toContain('ayat500');
  });

  it('withholds every currently hidden badge key even when its threshold is met', () => {
    const badges = buildStudentBadges({
      attendPct: 0,
      allRecs: [],
      realRecsNewestFirst: [],
      totalAyat: 100000,
      avgLoh: null,
      avgMadi: null,
      halaqaDatesDesc: [],
    });
    for (const key of HIDDEN_BADGE_KEYS) {
      expect(badges.map((b) => b.key)).not.toContain(key);
    }
  });

  it('still defines the hidden milestones so their thresholds can be tuned', () => {
    // Hiding is a display decision; the award rules stay in the codebase.
    for (const key of HIDDEN_BADGE_KEYS) {
      expect(AYAT_MILESTONES.map((m) => m.key)).toContain(key);
    }
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
      attendPct: 100, // 2 attended days / 2 halaqa days
      attendedDays: 2,
      // The denominator of that percentage, published so the parent page can
      // print the fraction instead of asking the reader to reconstruct it.
      halaqaDays: 2,
      totalAyat: 20,
      avgLoh: 45,
      avgMadi: 80,
    });
  });

  // Same rule the all-time avgMadi follows: a month with no scored madi is
  // null, never 0 — a real 0 is إعادة and means something else entirely.
  it('nulls a month average that has nothing scored in it', () => {
    const noMadi: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 80 } },
    ];
    const result = buildStudentPublicStats(zaid, noMadi, 1, null, ['2026-07-01']);
    expect(result.monthlyStats['2026-07'].avgMadi).toBeNull();
    expect(result.monthlyStats['2026-07'].avgLoh).toBe(80);
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

describe('buildStudentPublicStats attendance window (parent-facing)', () => {
  // Halaqa ran 5 days; this student only joined on the 3rd of them.
  const halaqaDatesDesc = ['2026-07-05', '2026-07-04', '2026-07-03', '2026-07-02', '2026-07-01'];
  const lateJoiner: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-03', loh: { score: 90 } },
    { id: 'r2', studentId: 's_1', date: '2026-07-04', loh: { score: 90 } },
    { id: 'r3', studentId: 's_1', date: '2026-07-05', loh: { score: 90 } },
  ];

  it('measures attendance against days since the student joined, not the whole halaqa', () => {
    const result = buildStudentPublicStats(zaid, lateJoiner, 5, null, halaqaDatesDesc);
    // 3 of the 3 days he was enrolled for — NOT 3/5 = 60%.
    expect(result.enrolledHalaqaDays).toBe(3);
    expect(result.uniqueDays).toBe(3);
    expect(result.attendPct).toBe(100);
  });

  it('still publishes the halaqa-wide day count, which rank is based on', () => {
    const result = buildStudentPublicStats(zaid, lateJoiner, 5, 4, halaqaDatesDesc);
    expect(result.totalHalaqaDays).toBe(5);
    expect(result.rank).toBe(4);
  });

  it('still counts absences that fall inside the enrollment window', () => {
    const withGap: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-02', loh: { score: 90 } },
      { id: 'r2', studentId: 's_1', date: '2026-07-05', loh: { score: 90 } },
    ];
    const result = buildStudentPublicStats(zaid, withGap, 5, null, halaqaDatesDesc);
    // Enrolled from 07-02 → 4 halaqa days; attended 2 → 50%.
    expect(result.enrolledHalaqaDays).toBe(4);
    expect(result.attendPct).toBe(50);
  });

  it('is unchanged for a student present since the very first halaqa day', () => {
    const fromDayOne: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } },
      { id: 'r2', studentId: 's_1', date: '2026-07-02', loh: { score: 90 } },
    ];
    const result = buildStudentPublicStats(zaid, fromDayOne, 5, null, halaqaDatesDesc);
    expect(result.enrolledHalaqaDays).toBe(5);
    expect(result.attendPct).toBe(40); // 2/5, exactly as before
  });

  it('reports 0% for a student with no records at all', () => {
    const result = buildStudentPublicStats(zaid, [], 5, null, halaqaDatesDesc);
    expect(result.enrolledHalaqaDays).toBe(0);
    expect(result.attendPct).toBe(0);
  });

  it('omits months that ended before the student joined', () => {
    const juneAndJuly = ['2026-07-02', '2026-07-01', '2026-06-20', '2026-06-13'];
    const result = buildStudentPublicStats(
      zaid,
      [{ id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } }],
      4,
      null,
      juneAndJuly,
    );
    expect(Object.keys(result.monthlyStats)).toEqual(['2026-07']);
    expect(result.monthlyStats['2026-07'].attendPct).toBe(50); // 1 of 2 July days
  });
});

describe('buildStudentPublicStats attendance numerator (parent-facing)', () => {
  // Callers pass sortedHalaqaDatesDesc(), which has ALREADY dropped
  // EXCLUDED_HALAQA_DATES — so 2026-06-04 below is a bonus/makeup day that is
  // deliberately absent from the denominator. The numerator has to agree:
  // a day that isn't a halaqa day can't be a day of attendance either.
  const halaqaDatesDesc = ['2026-06-06', '2026-06-05', '2026-06-03', '2026-06-02'];

  it('does not let a bonus (excluded) day inflate the percentage', () => {
    const recs: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-06-02', loh: { score: 90 } },
      { id: 'r2', studentId: 's_1', date: '2026-06-04', loh: { score: 90 } }, // bonus day
      { id: 'r3', studentId: 's_1', date: '2026-06-05', loh: { score: 90 } },
    ];
    const result = buildStudentPublicStats(zaid, recs, 4, null, halaqaDatesDesc);
    expect(result.enrolledHalaqaDays).toBe(4);
    expect(result.attendedDays).toBe(2); // 06-02 and 06-05 only
    expect(result.attendPct).toBe(50); // was 75% while the bonus day leaked in
  });

  it('ignores a record carrying no date at all', () => {
    const recs: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-06-02', loh: { score: 90 } },
      { id: 'r2', studentId: 's_1' } as SessionRecord, // legacy/broken row
    ];
    const result = buildStudentPublicStats(zaid, recs, 4, null, halaqaDatesDesc);
    expect(result.attendedDays).toBe(1);
    expect(result.attendPct).toBe(25); // an undated row used to count as a day
  });

  it('counts a day once when both an attendance mark and a session exist', () => {
    const recs: SessionRecord[] = [
      { id: 'att_1', studentId: 's_1', date: '2026-06-02', attendance_only: true },
      { id: 'r1', studentId: 's_1', date: '2026-06-02', loh: { score: 90 } },
    ];
    const result = buildStudentPublicStats(zaid, recs, 4, null, halaqaDatesDesc);
    expect(result.attendedDays).toBe(1);
    expect(result.attendPct).toBe(25);
  });

  it('counts an attendance-only day as attendance, same as a full session', () => {
    const recs: SessionRecord[] = [
      { id: 'att_1', studentId: 's_1', date: '2026-06-02', attendance_only: true },
      { id: 'att_2', studentId: 's_1', date: '2026-06-03', attendance_only: true },
      { id: 'r1', studentId: 's_1', date: '2026-06-05', loh: { score: 90 } },
    ];
    const result = buildStudentPublicStats(zaid, recs, 4, null, halaqaDatesDesc);
    expect(result.attendedDays).toBe(3);
    expect(result.attendPct).toBe(75);
  });

  it('can never report more attended days than enrolled days', () => {
    const recs: SessionRecord[] = [
      ...halaqaDatesDesc.map(
        (date, i) => ({ id: `r${i}`, studentId: 's_1', date, loh: { score: 90 } }) as SessionRecord,
      ),
      { id: 'bonus', studentId: 's_1', date: '2026-06-04', loh: { score: 90 } },
    ];
    const result = buildStudentPublicStats(zaid, recs, 4, null, halaqaDatesDesc);
    expect(result.attendedDays).toBe(result.enrolledHalaqaDays);
    expect(result.attendPct).toBe(100); // reached honestly, not by a Math.min cap
  });

  it('applies the same numerator inside monthlyStats', () => {
    const recs: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-06-02', loh: { score: 90 } },
      { id: 'r2', studentId: 's_1', date: '2026-06-04', loh: { score: 90 } }, // bonus day
      { id: 'r3', studentId: 's_1', date: '2026-06-05', loh: { score: 90 } },
    ];
    const result = buildStudentPublicStats(zaid, recs, 4, null, halaqaDatesDesc);
    expect(result.monthlyStats['2026-06'].attendedDays).toBe(2);
    expect(result.monthlyStats['2026-06'].attendPct).toBe(50);
  });
});

describe('buildStudentPublicStats — إعادة does not count as recited', () => {
  const halaqaDates = ['2026-07-05', '2026-07-03', '2026-07-01'];

  // البقرة ١–١٠ is assigned on the 1st, FAILED on the 3rd, re-assigned the
  // same day, then passed on the 5th, which also hands out آل عمران ١–١٠.
  const recs: SessionRecord[] = [
    {
      id: 'r1',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
    },
    {
      id: 'r2',
      studentId: 's_1',
      date: '2026-07-03',
      loh: { score: 50 },
      newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
    },
    {
      id: 'r3',
      studentId: 's_1',
      date: '2026-07-05',
      loh: { score: 90 },
      newLoh: [{ sura: 'آل عمران', from: '1', to: '10' }],
    },
  ];

  it('drops the ten ayat that were graded إعادة, keeping the re-recited pass', () => {
    const result = buildStudentPublicStats(zaid, recs, 3, null, halaqaDates);
    // r1 failed → 0. r2 passed → 10. r3 not graded yet → 10.
    expect(result.totalAyat).toBe(20);
  });

  it('counts a مراجعة re-recitation again — repeats are not de-duplicated', () => {
    // Same sura assigned twice, both passed. "مُسمّعة" counts each recitation.
    const passed: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
      {
        id: 'b',
        studentId: 's_1',
        date: '2026-07-03',
        loh: { score: 95 },
        newLoh: [{ sura: 'الفاتحة' }],
      },
      { id: 'c', studentId: 's_1', date: '2026-07-05', loh: { score: 95 } },
    ];
    expect(buildStudentPublicStats(zaid, passed, 3, null, halaqaDates).totalAyat).toBe(14);
  });

  it('drops tajweed graded إعادة, which carries its own score on the record', () => {
    const withTajweed: SessionRecord[] = [
      {
        id: 't1',
        studentId: 's_1',
        date: '2026-07-01',
        tajweed: { sura: 'الفاتحة', score: 30 },
      },
      {
        id: 't2',
        studentId: 's_1',
        date: '2026-07-03',
        tajweed: { sura: 'الفاتحة', score: 85 },
      },
    ];
    expect(buildStudentPublicStats(zaid, withTajweed, 3, null, halaqaDates).totalAyat).toBe(7);
  });

  // The parent page has never rendered the tajweed assignment, and the
  // projection dropped its score/stars/note anyway — so the published object
  // could only ever say "التجويد: الفاتحة (١-٧)" with no verdict attached.
  // Publishing half a fact nobody reads is worse than publishing nothing.
  describe('tajweed assignment is not published to parents', () => {
    const withTajweed: SessionRecord[] = [
      {
        id: 't1',
        studentId: 's_1',
        date: '2026-07-01',
        loh: { score: 90 },
        tajweed: { sura: 'الفاتحة', from: '1', to: '7', score: 85, note: 'إخفاء' },
      },
    ];

    it('omits the key from every published session', () => {
      const out = buildStudentPublicStats(zaid, withTajweed, 3, null, halaqaDates);
      expect(out.recentSessions[0]).not.toHaveProperty('tajweed');
    });

    it('leaks no part of the tajweed evaluation anywhere in the document', () => {
      const out = buildStudentPublicStats(zaid, withTajweed, 3, null, halaqaDates);
      expect(JSON.stringify(out)).not.toContain('إخفاء');
    });

    // Disabling the display must not silently restate the boy's work: the
    // tajweed range is real recitation and still counts toward آية مُسمّعة.
    it('still counts tajweed ayat toward totalAyat', () => {
      expect(buildStudentPublicStats(zaid, withTajweed, 3, null, halaqaDates).totalAyat).toBe(7);
    });

    // A different field that merely shares the name — the mistake counter's
    // tajweed tally is rendered ('١ خطأ تجويدي') and must survive.
    it('keeps the tajweed mistake tally on the score', () => {
      const withMistakes: SessionRecord[] = [
        {
          id: 'm1',
          studentId: 's_1',
          date: '2026-07-01',
          loh: { score: 90, mistakes: { full: 2, tajweed: 1 } },
        },
      ];
      const out = buildStudentPublicStats(zaid, withMistakes, 3, null, halaqaDates);
      expect(out.recentSessions[0].loh).toEqual({
        score: 90,
        mistakes: { full: 2, tajweed: 1 },
      });
    });
  });

  it('applies the same rule to the monthly figures, across a month boundary', () => {
    // Assigned 31 July, failed 2 August — the July number must still drop it.
    const crossing: SessionRecord[] = [
      {
        id: 'j1',
        studentId: 's_1',
        date: '2026-07-31',
        newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
      },
      { id: 'a1', studentId: 's_1', date: '2026-08-02', loh: { score: 40 } },
    ];
    const result = buildStudentPublicStats(zaid, crossing, 2, null, ['2026-08-02', '2026-07-31']);
    expect(result.monthlyStats['2026-07'].totalAyat).toBe(0);
    expect(result.totalAyat).toBe(0);
  });
});
