import { describe, it, expect } from 'vitest';
import type { PublicStats } from '../../types';
import {
  toArabicDigits,
  formatArabicNumber,
  getParentTheme,
  buildChart,
  buildTrend,
  buildStats,
  buildCurrentTask,
  buildSessions,
  firstInitial,
  rankBadgeText,
  CHART_WINDOW,
  CHART_FLOOR,
  CHART_PASS_MARK,
  formatSessionDate,
  formatShortDate,
  SESSIONS_WINDOW,
  buildMonthOptions,
  ALL_MONTHS,
} from './parentView';
import { MOCK_PUBLIC_STATS } from './mockPublicStats';
import { scoreName } from '../../domain/scoring';

function baseStats(overrides: Partial<PublicStats> = {}): PublicStats {
  return {
    name: 'زيد أحمد',
    updatedAt: 1_700_000_000_000,
    totalHalaqaDays: 26,
    enrolledHalaqaDays: 26,
    uniqueDays: 23,
    attendPct: 88,
    rank: 2,
    sessionsCount: 23,
    attendedDays: 23,
    totalAyat: 1240,
    avgLoh: 86,
    avgMadi: 84,
    badges: [{ key: 'streak', icon: '🔥', label: 'استمرارية ٥ يوم' }],
    currentTask: {
      date: '2026-07-09',
      newLoh: [{ sura: 'آل عمران', from: '1', to: '15' }],
      newMadi: [{ sura: 'البقرة', from: '280', to: '286' }],
    },
    recentSessions: [
      {
        date: '2026-07-09',
        loh: { score: 92 },
        madi: { score: 90 },
        newLoh: [{ sura: 'آل عمران', from: '1', to: '15' }],
        newMadi: [{ sura: 'البقرة', from: '280', to: '286' }],
        note: 'أداء ممتاز',
      },
    ],
    scoreHistory: [
      { date: '2026-06-20', loh: 70, madi: 80 },
      { date: '2026-06-22', loh: 75, madi: 78 },
      { date: '2026-06-25', loh: 80, madi: 85 },
      { date: '2026-06-27', loh: 78, madi: 82 },
      { date: '2026-07-01', loh: 85, madi: 88 },
      { date: '2026-07-04', loh: 90, madi: 85 },
      { date: '2026-07-07', loh: 88, madi: 92 },
      { date: '2026-07-09', loh: 92, madi: 90 },
    ],
    monthlyStats: {},
    ...overrides,
  };
}

describe('toArabicDigits', () => {
  it('converts ascii digits and leaves other chars', () => {
    expect(toArabicDigits('88%')).toBe('٨٨%');
    expect(toArabicDigits(2)).toBe('٢');
  });
});

describe('formatArabicNumber', () => {
  it('groups thousands with the arabic separator and arabic digits', () => {
    expect(formatArabicNumber(1240)).toBe('١٬٢٤٠');
    expect(formatArabicNumber(90)).toBe('٩٠');
    expect(formatArabicNumber(0)).toBe('٠');
  });
});

describe('getParentTheme', () => {
  it('returns distinct light and dark palettes', () => {
    const light = getParentTheme(false);
    const dark = getParentTheme(true);
    expect(light.bg).not.toBe(dark.bg);
    expect(light.headerBg).toContain('gradient');
    expect(dark.headerBg).toContain('gradient');
  });
});

describe('buildChart', () => {
  it('produces both series paths and end points from the last window', () => {
    const c = buildChart(baseStats().scoreHistory);
    expect(c.lohPath.startsWith('M ')).toBe(true);
    expect(c.madiPath.startsWith('M ')).toBe(true);
    expect(c.lohLast?.value).toBe(92);
    expect(c.madiLast?.value).toBe(90);
    expect(c.viewBox).toBe('0 0 320 100');
  });

  it('skips null points but keeps the two series time-aligned', () => {
    const c = buildChart([
      { date: 'a', loh: 60, madi: null },
      { date: 'b', loh: null, madi: 70 },
      { date: 'c', loh: 80, madi: 90 },
    ]);
    // loh present at indices 0 and 2 → two points in the path
    expect((c.lohPath.match(/L|M/g) || []).length).toBe(2);
    expect(c.lohLast?.value).toBe(80);
    expect(c.madiLast?.value).toBe(90);
  });

  it('handles an empty history without throwing', () => {
    const c = buildChart([]);
    expect(c.lohPath).toBe('');
    expect(c.madiPath).toBe('');
    expect(c.lohLast).toBeNull();
    expect(c.madiLast).toBeNull();
  });

  it('only uses the trailing window', () => {
    const long = Array.from({ length: 20 }, (_, i) => ({ date: 'd' + i, loh: i, madi: i }));
    const c = buildChart(long);
    // last point value should be 19 (the newest), not something earlier
    expect(c.lohLast?.value).toBe(19);
    expect(CHART_WINDOW).toBe(8);
  });
});

/** Y coordinates only — the path reads "M x y L x y". */
function pathYs(path: string): number[] {
  return path
    .split(/[ML]/)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => Number(seg.split(/\s+/)[1]));
}

describe('buildChart scale', () => {
  // The old chart spread 0–100 over the plot band, so the 69–100 range every
  // real student lives in occupied about a third of the height and read as a
  // flat line. The band now starts at CHART_FLOOR.
  it('starts the axis at the floor, not at zero', () => {
    expect(CHART_FLOOR).toBe(50);
    const c = buildChart([
      { date: 'a', loh: CHART_PASS_MARK, madi: null },
      { date: 'b', loh: 100, madi: null },
    ]);
    const ys = pathYs(c.lohPath);
    expect(Math.min(...ys)).toBeCloseTo(c.plotTop, 5); // 100 at the top
    expect(Math.max(...ys)).toBeCloseTo(c.passY, 5); // 60 on the pass line
    // On the old 0-based axis the pass line sat 40% down the plot; on a
    // 50-based one it sits 80% down, which is the whole point.
    expect((c.passY - c.plotTop) / (c.plotBottom - c.plotTop)).toBeCloseTo(0.8, 2);
  });

  it('gives the real score range more than half the plot height', () => {
    const c = buildChart([
      { date: 'a', loh: 69, madi: null },
      { date: 'b', loh: 100, madi: null },
    ]);
    const ys = pathYs(c.lohPath);
    const used = (Math.max(...ys) - Math.min(...ys)) / (c.plotBottom - c.plotTop);
    expect(used).toBeGreaterThan(0.55); // was ~0.31 on the 0-based axis
  });

  it('pins the floor to the grading scale, below the إعادة cut-off', () => {
    // If the bands in scoring.ts ever move, this fails rather than silently
    // drawing a pass line in the wrong place.
    expect(scoreName(CHART_PASS_MARK)).not.toBe('إعادة');
    expect(scoreName(CHART_PASS_MARK - 1)).toBe('إعادة');
    expect(CHART_FLOOR).toBeLessThan(CHART_PASS_MARK);
  });

  it('lifts an إعادة out of the line and marks it instead', () => {
    const c = buildChart([
      { date: 'a', loh: 90, madi: null },
      { date: 'b', loh: 0, madi: null },
      { date: 'c', loh: 85, madi: null },
    ]);
    // The line breaks around the إعادة: two separate subpaths, no plunge.
    expect((c.lohPath.match(/M/g) || []).length).toBe(2);
    expect(c.lohRepeats).toHaveLength(1);
    // Marker sits inside the إعادة zone, never off the bottom of the viewBox.
    expect(c.lohRepeats[0].y).toBeGreaterThan(c.passY);
    expect(c.lohRepeats[0].y).toBeLessThanOrEqual(c.plotBottom);
  });

  it('never lets a zero drag the drawn line below the floor', () => {
    const c = buildChart([
      { date: 'a', loh: 0, madi: 0 },
      { date: 'b', loh: 95, madi: 95 },
    ]);
    const ys = pathYs(c.lohPath);
    expect(Math.max(...ys)).toBeLessThanOrEqual(c.plotBottom);
  });

  it('labels a trailing إعادة by name rather than as a percentage', () => {
    const c = buildChart([
      { date: 'a', loh: 88, madi: null },
      { date: 'b', loh: 40, madi: null },
    ]);
    expect(c.lohLast?.repeat).toBe(true);
    expect(c.lohLast?.label).toBe('إعادة');
    expect(c.lohLast?.value).toBe(40);
  });

  it('marks a normal trailing score as not a repeat', () => {
    const c = buildChart([{ date: 'a', loh: 88, madi: null }]);
    expect(c.lohLast?.repeat).toBe(false);
    expect(c.lohLast?.label).toBe('٨٨');
  });

  it('publishes gridlines on the grade boundaries, labelled every 20 points', () => {
    const c = buildChart(baseStats().scoreHistory);
    expect(c.gridLines.map((g) => g.value)).toEqual([100, 90, 80, 70, 60]);
    expect(c.gridLines.filter((g) => g.label !== '').map((g) => g.label)).toEqual([
      '١٠٠',
      '٨٠',
      '٦٠',
    ]);
    // The pass line is the one a parent reads against, so it is drawn stronger.
    expect(c.gridLines.find((g) => g.value === CHART_PASS_MARK)?.strong).toBe(true);
    expect(c.gridLines.find((g) => g.value === 90)?.strong).toBe(false);
  });
});

describe('buildTrend', () => {
  it('flags improvement when the recent half is clearly higher', () => {
    const t = buildTrend([
      { date: 'a', loh: 60, madi: null },
      { date: 'b', loh: 62, madi: null },
      { date: 'c', loh: 85, madi: null },
      { date: 'd', loh: 90, madi: null },
    ]);
    expect(t.tone).toBe('good');
  });

  it('flags decline when the recent half is clearly lower', () => {
    const t = buildTrend([
      { date: 'a', loh: 90, madi: null },
      { date: 'b', loh: 88, madi: null },
      { date: 'c', loh: 70, madi: null },
      { date: 'd', loh: 65, madi: null },
    ]);
    expect(t.tone).toBe('warn');
  });

  it('is neutral with too little data', () => {
    expect(buildTrend([]).tone).toBe('muted');
    expect(buildTrend([{ date: 'a', loh: 80, madi: null }]).tone).toBe('muted');
  });
});

describe('buildStats', () => {
  it('renders four cells with arabic numerals and no deltas', () => {
    const cells = buildStats(baseStats());
    expect(cells).toHaveLength(4);
    expect(cells.map((c) => c.label)).toEqual([
      'نسبة الحضور',
      'آية مُسمّعة',
      'متوسط اللوح',
      'متوسط الماضي',
    ]);
    expect(cells[0].value).toBe('٨٨٪');
    expect(cells[1].value).toBe('١٬٢٤٠');
    // no delta / comparison fields exist on the cell, and a cell with nothing
    // to say underneath carries no `sub` key at all rather than an empty one
    expect(Object.keys(cells[1])).toEqual(['label', 'value', 'color']);
  });

  // The day count used to be its own cell, which said exactly what the
  // percentage next to it already said (٢٣ ÷ ٢٦ = ٨٨٪). Folding it underneath
  // as the fraction it comes from frees the fourth slot for متوسط الماضي.
  it('carries the attended/enrolled fraction under the percentage', () => {
    expect(buildStats(baseStats())[0].sub).toBe('٢٣ من ٢٦ يوم');
  });

  it('pluralises the denominator the Arabic way', () => {
    expect(buildStats(baseStats({ attendedDays: 2, enrolledHalaqaDays: 2 }))[0].sub).toBe(
      '٢ من يومين',
    );
    expect(buildStats(baseStats({ attendedDays: 3, enrolledHalaqaDays: 5 }))[0].sub).toBe(
      '٣ من ٥ أيام',
    );
  });

  it('falls back to uniqueDays for documents published before attendedDays existed', () => {
    const stale = baseStats({ uniqueDays: 21 });
    delete (stale as Partial<PublicStats>).attendedDays;
    expect(buildStats(stale)[0].sub).toBe('٢١ من ٢٦ يوم');
  });

  // A document published before enrolledHalaqaDays existed has no denominator
  // to show; a fraction over zero would read as "٢٣ من صفر".
  it('omits the fraction when there is no enrolment window', () => {
    expect(buildStats(baseStats({ enrolledHalaqaDays: 0 }))[0].sub).toBeUndefined();
  });

  it('shows the madi average next to the loh average', () => {
    const cells = buildStats(baseStats({ avgLoh: 86, avgMadi: 84 }));
    expect(cells[2].value).toBe('٨٦٪');
    expect(cells[3].value).toBe('٨٤٪');
  });

  it('shows a dash for a missing average, on either card', () => {
    const cells = buildStats(baseStats({ avgLoh: null, avgMadi: null }));
    expect(cells[2].value).toBe('—');
    expect(cells[3].value).toBe('—');
  });

  // The band name tells a parent what the number means without making him
  // learn the scale — but only while it is encouraging. Under 70 the label
  // would read "إعادة" on a page his son can see over his shoulder.
  it('names the band above the pass mark and stays silent below it', () => {
    expect(buildStats(baseStats({ avgLoh: 92 }))[2].sub).toBe('ممتاز');
    expect(buildStats(baseStats({ avgMadi: 84 }))[3].sub).toBe('جيد جداً');
    expect(buildStats(baseStats({ avgLoh: 70 }))[2].sub).toBe('جيد');
    expect(buildStats(baseStats({ avgLoh: 69 }))[2].sub).toBeUndefined();
    expect(buildStats(baseStats({ avgMadi: 55 }))[3].sub).toBeUndefined();
    expect(buildStats(baseStats({ avgLoh: null }))[2].sub).toBeUndefined();
  });
});

describe('buildCurrentTask', () => {
  it('joins sura assignments for loh and madi', () => {
    const t = buildCurrentTask(baseStats());
    expect(t?.loh).toContain('آل عمران');
    expect(t?.madi).toContain('البقرة');
  });

  it('is null when there is no current task', () => {
    expect(buildCurrentTask(baseStats({ currentTask: null }))).toBeNull();
  });

  it('is null when both assignment lists are empty', () => {
    expect(
      buildCurrentTask(baseStats({ currentTask: { date: 'x', newLoh: [], newMadi: [] } })),
    ).toBeNull();
  });
});

describe('buildSessions', () => {
  it('maps scores, bar widths, and assignment text', () => {
    const s = buildSessions(baseStats())[0];
    expect(s.loh).toBe(92);
    expect(s.lohLabel).toBe('٩٢');
    expect(s.lohPct).toBe('92%');
    expect(s.newLoh).toContain('آل عمران');
  });

  it('renders a dash and zero-width bar for an unscored side', () => {
    const stats = baseStats({
      recentSessions: [
        {
          date: '2026-07-09',
          loh: null,
          madi: { score: 90 },
          newLoh: [],
          newMadi: [],
          note: '',
        },
      ],
    });
    const s = buildSessions(stats)[0];
    expect(s.lohLabel).toBe('—');
    expect(s.lohPct).toBe('0%');
    expect(s.madiLabel).toBe('٩٠');
  });
});

describe('header helpers', () => {
  it('firstInitial takes the first visible char', () => {
    expect(firstInitial('زيد أحمد')).toBe('ز');
    expect(firstInitial('')).toBe('؟');
  });

  it('rankBadgeText hides when rank is null', () => {
    expect(rankBadgeText(2)).toContain('المركز ٢');
    expect(rankBadgeText(null)).toBeNull();
  });
});

describe('evaluation ↔ assignment separation (parent page)', () => {
  // The parent page must keep "today's evaluation" (the score for what was
  // memorized before) distinct from "the new assignment" (what to memorize
  // next). These are different fields on the record: loh/madi carry the
  // evaluation, newLoh/newMadi carry the assignment. A session commonly
  // evaluates the *previous* homework while handing out *new* homework, so the
  // two must never be conflated. buildCurrentTask reads assignments only;
  // buildSessions surfaces both, but as separate properties.

  it('current task exposes the assignment and carries no score', () => {
    const task = buildCurrentTask(baseStats())!;
    // Assignment text is present…
    expect(task.loh).toContain('آل عمران');
    expect(task.madi).toContain('البقرة');
    // …and the task object has no score/evaluation field at all.
    expect(task).not.toHaveProperty('lohScore');
    expect(task).not.toHaveProperty('score');
    expect(Object.keys(task).sort()).toEqual(['date', 'dateLabel', 'loh', 'madi'].sort());
  });

  it('a session keeps its evaluation score separate from its assignment text', () => {
    // Build a session whose evaluation (the grade) and assignment (the suras)
    // are deliberately different values, then assert they land on different
    // properties — the score never leaks into the assignment string, and vice
    // versa.
    const stats = baseStats({
      recentSessions: [
        {
          date: '2026-07-09',
          loh: { score: 92 }, // evaluation of PREVIOUS homework
          madi: { score: 90 },
          newLoh: [{ sura: 'الكهف', from: '1', to: '10' }], // NEW homework
          newMadi: [{ sura: 'مريم', from: '1', to: '5' }],
          note: '',
        },
      ],
    });
    const s = buildSessions(stats)[0];
    // Evaluation lives on numeric score fields.
    expect(s.loh).toBe(92);
    expect(s.madi).toBe(90);
    // Assignment lives on separate text fields — and is the NEW suras, not the
    // thing that was graded.
    expect(s.newLoh).toContain('الكهف');
    expect(s.newMadi).toContain('مريم');
    // The score must not appear inside the assignment text, nor the assignment
    // sura inside the score.
    expect(s.newLoh).not.toContain('92');
    expect(s.newLoh).not.toContain('٩٢');
  });

  it('current task and a session can disagree — the new assignment is not the graded one', () => {
    // Realistic case: the latest session GRADED آل عمران (previous homework)
    // and ASSIGNED الكهف (new homework). The current task must reflect the new
    // assignment (الكهف), independent of what score any session shows.
    const stats = baseStats({
      currentTask: {
        date: '2026-07-09',
        newLoh: [{ sura: 'الكهف', from: '1', to: '20' }],
        newMadi: [],
      },
      recentSessions: [
        {
          date: '2026-07-09',
          loh: { score: 88 }, // grade for the PREVIOUS assignment (آل عمران)
          madi: null,
          newLoh: [{ sura: 'الكهف', from: '1', to: '20' }],
          newMadi: [],
          note: '',
        },
      ],
    });
    const task = buildCurrentTask(stats)!;
    expect(task.loh).toContain('الكهف'); // the NEW assignment
    expect(task.loh).not.toContain('آل عمران'); // not the thing that was graded
    // And the session still reports the grade separately.
    expect(buildSessions(stats)[0].loh).toBe(88);
  });
});

describe('parent-facing dates', () => {
  // The stored value is a bare ISO string and it used to be printed to the
  // parent verbatim — Latin digits in a page whose every other number is
  // Arabic-Indic.
  it('never hands the raw ISO string to the view', () => {
    const when = formatSessionDate('2026-07-20');
    expect(when.gregorian).not.toContain('2026-07-20');
    expect(when.gregorian).not.toMatch(/[0-9]/); // Arabic-Indic only
    expect(when.hijri).not.toMatch(/[0-9]/);
  });

  it('spells out the weekday, which is what a fixed-day halaqa reads by', () => {
    // 2026-07-20 is a Monday.
    expect(formatSessionDate('2026-07-20').gregorian).toContain('الاثنين');
  });

  it('gives the task label both calendars on one line', () => {
    const label = formatShortDate('2026-07-20');
    expect(label).toContain('—');
    expect(label).not.toMatch(/[0-9]/);
  });

  it('survives an empty date instead of printing "Invalid Date"', () => {
    expect(formatSessionDate('')).toEqual({ hijri: '', gregorian: '' });
    expect(formatShortDate('')).toBe('');
  });

  it('carries both calendars through to each session in the timeline', () => {
    const sessions = buildSessions({
      ...MOCK_PUBLIC_STATS,
      recentSessions: [
        {
          date: '2026-07-20',
          loh: { score: 90 },
          madi: null,
          newLoh: [],
          newMadi: [],
          note: '',
        },
      ],
    });
    expect(sessions[0].dateHijri).not.toBe('');
    expect(sessions[0].dateGregorian).toContain('يوليو');
  });
});

describe('Arabic-Indic numerals throughout the parent page', () => {
  const withAssignment = (list: { sura: string; from?: string; to?: string }[]) => ({
    ...MOCK_PUBLIC_STATS,
    currentTask: { date: '2026-07-20', newLoh: list, newMadi: [] },
  });

  it('renders ayah numbers in the task in Arabic-Indic digits', () => {
    const task = buildCurrentTask(withAssignment([{ sura: 'البقرة', from: '280', to: '286' }]));
    expect(task!.loh).toBe('البقرة (٢٨٠–٢٨٦)');
    expect(task!.loh).not.toMatch(/[0-9]/);
  });

  it('renders ayah numbers in the session timeline in Arabic-Indic digits', () => {
    const sessions = buildSessions({
      ...MOCK_PUBLIC_STATS,
      recentSessions: [
        {
          date: '2026-07-20',
          loh: { score: 90 },
          madi: null,
          newLoh: [{ sura: 'آل عمران', from: '1', to: '15' }],
          newMadi: [],
          note: '',
        },
      ],
    });
    expect(sessions[0].newLoh).toBe('آل عمران (١–١٥)');
  });

  it('labels the chart end points in Arabic-Indic digits', () => {
    const chart = buildChart([
      { date: '2026-07-18', loh: 88, madi: 80 },
      { date: '2026-07-20', loh: 92, madi: 90 },
    ]);
    expect(chart.lohLast!.label).toBe('٩٢');
    expect(chart.madiLast!.label).toBe('٩٠');
    // The numeric value stays a number — geometry still needs it.
    expect(chart.lohLast!.value).toBe(92);
  });

  it('leaves joinSuraNames itself alone — the admin log and WhatsApp share it', async () => {
    const { joinSuraNames } = await import('../../domain/suras');
    expect(joinSuraNames([{ sura: 'البقرة', from: '280', to: '286' }])).toBe('البقرة (280–286)');
  });
});

describe('buildSessions — evaluation vs new homework', () => {
  /** Two consecutive sessions. The BQ assignment is given on the 7th and
   * graded on the 9th; the آل عمران assignment is given on the 9th and has
   * not been recited yet. */
  function twoSessions(): PublicStats {
    return baseStats({
      recentSessions: [
        {
          date: '2026-07-09',
          loh: { score: 92, mistakes: { full: 2, tajweed: 1 } },
          madi: { score: 90 },
          newLoh: [{ sura: 'آل عمران', from: '1', to: '15' }],
          newMadi: [{ sura: 'البقرة', from: '280', to: '286' }],
          note: '',
        },
        {
          date: '2026-07-07',
          loh: { score: 80 },
          madi: { score: 85 },
          newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
          newMadi: [{ sura: 'الفاتحة', from: '1', to: '7' }],
          note: '',
        },
      ],
    });
  }

  it("credits today's score to the sura assigned LAST session, not this one", () => {
    const s = buildSessions(twoSessions())[0];
    // The 92 grades البقرة (assigned on the 7th)...
    expect(s.recitedLoh).toContain('البقرة');
    expect(s.recitedLoh).not.toContain('آل عمران');
    // ...while آل عمران is homework he hasn't recited yet.
    expect(s.newLoh).toContain('آل عمران');
    expect(s.newLoh).not.toContain('البقرة');
  });

  it('does the same for the madi side', () => {
    const s = buildSessions(twoSessions())[0];
    expect(s.recitedMadi).toContain('الفاتحة');
    expect(s.newMadi).toContain('البقرة');
  });

  it('has nothing recited for the first session a student ever had', () => {
    // Oldest row: no earlier session exists, so nothing had been assigned yet.
    const s = buildSessions(twoSessions())[1];
    expect(s.recitedLoh).toBeNull();
    expect(s.recitedMadi).toBeNull();
    expect(s.newLoh).toContain('البقرة');
  });

  it('finds a predecessor for the oldest row on screen, beyond the window', () => {
    // One more session than the window shows: the last visible row must still
    // resolve its predecessor out of the unshown tail, so the assertion is
    // written against SESSIONS_WINDOW rather than a literal count.
    const total = SESSIONS_WINDOW + 1;
    const recentSessions = Array.from({ length: total }, (_, i) => ({
      date: '2026-07-' + String(total - i).padStart(2, '0'),
      loh: { score: 90 },
      madi: null,
      // No digits in the name: the label is rendered in Arabic-Indic numerals,
      // so 'سورة1' would come back as 'سورة١' and never match.
      newLoh: [{ sura: i === total - 1 ? 'الأقدم' : 'سورة', from: '1', to: '5' }],
      newMadi: [],
      note: '',
    }));
    const rows = buildSessions(baseStats({ recentSessions }));
    expect(rows).toHaveLength(SESSIONS_WINDOW);
    // The oldest visible row was assigned by the one session it can't show.
    expect(rows[SESSIONS_WINDOW - 1].recitedLoh).toContain('الأقدم');
  });

  it('formats a mistake tally, and distinguishes none-recorded from zero', () => {
    const rows = buildSessions(twoSessions());
    expect(rows[0].lohMistakes).toBe('٢ خطأ، ١ خطأ تجويدي');
    // madi on the same session carries no tally at all
    expect(rows[0].madiMistakes).toBeNull();
  });

  it('says "بدون أخطاء" for an explicitly zero tally', () => {
    const stats = baseStats({
      recentSessions: [
        {
          date: '2026-07-09',
          loh: { score: 100, mistakes: { full: 0, tajweed: 0 } },
          madi: null,
          newLoh: [],
          newMadi: [],
          note: '',
        },
      ],
    });
    expect(buildSessions(stats)[0].lohMistakes).toBe('بدون أخطاء');
    expect(buildSessions(stats)[0].madiMistakes).toBeNull();
  });
});

// ── The grade word next to the number ────────────────────────────────────
// A parent reading "٩٢" has no way to know the halaqa's bands. The word is
// the same one the admin log and the WhatsApp message print (scoreName), so
// all three describe a session identically.
describe('buildSessions — grade word', () => {
  function scored(loh: number | null, madi: number | null): PublicStats {
    return baseStats({
      recentSessions: [
        {
          date: '2026-07-09',
          loh: loh == null ? null : { score: loh },
          madi: madi == null ? null : { score: madi },
          newLoh: [],
          newMadi: [],
          note: '',
        },
      ],
    });
  }

  it('labels each score with the band name from scoreName', () => {
    const s = buildSessions(scored(92, 74))[0];
    expect(s.lohGrade).toBe('ممتاز');
    expect(s.madiGrade).toBe('جيد');
  });

  it('says إعادة for a real zero rather than leaving it blank', () => {
    const s = buildSessions(scored(0, null))[0];
    expect(s.lohGrade).toBe('إعادة');
    expect(s.lohTone).toBe('warn');
  });

  it('has no grade for an unscored half of the session', () => {
    const s = buildSessions(scored(88, null))[0];
    expect(s.madiGrade).toBeNull();
    expect(s.lohGrade).toBe('جيد جداً');
  });

  it('tones ممتاز as good and the middle bands as muted', () => {
    expect(buildSessions(scored(90, 60))[0].lohTone).toBe('good');
    expect(buildSessions(scored(90, 60))[0].madiTone).toBe('muted');
  });

  it('agrees with scoreName across every band', () => {
    [100, 90, 85, 80, 75, 70, 65, 60, 59, 0].forEach((v) => {
      expect(buildSessions(scored(v, null))[0].lohGrade).toBe(scoreName(v));
    });
  });
});

// ── Session window ───────────────────────────────────────────────────────
describe('SESSIONS_WINDOW', () => {
  it('shows ten sessions — the full set stats.ts publishes', () => {
    expect(SESSIONS_WINDOW).toBe(10);
  });

  it('renders every published session when there are ten', () => {
    const recentSessions = Array.from({ length: 10 }, (_, i) => ({
      date: '2026-07-' + String(20 - i).padStart(2, '0'),
      loh: { score: 80 },
      madi: null,
      newLoh: [],
      newMadi: [],
      note: '',
    }));
    expect(buildSessions(baseStats({ recentSessions }))).toHaveLength(10);
  });
});

// ── Month filter ─────────────────────────────────────────────────────────
describe('buildMonthOptions', () => {
  const monthly = {
    '2026-06': { attendPct: 70, attendedDays: 7, totalAyat: 300, avgLoh: 78 },
    '2026-07': { attendPct: 92, attendedDays: 12, totalAyat: 540, avgLoh: 90 },
  };

  it('lists الكل first, then months newest-first', () => {
    const opts = buildMonthOptions(baseStats({ monthlyStats: monthly }));
    expect(opts[0].key).toBe(ALL_MONTHS);
    expect(opts.map((o) => o.key)).toEqual([ALL_MONTHS, '2026-07', '2026-06']);
  });

  it('names the month in Arabic rather than showing the raw key', () => {
    const opts = buildMonthOptions(baseStats({ monthlyStats: monthly }));
    expect(opts[1].label).toContain('يوليو');
    expect(opts[1].label).not.toContain('2026-07');
  });

  // A filter offering one choice is a control that does nothing.
  it('offers nothing when there is only one month, or none at all', () => {
    expect(
      buildMonthOptions(baseStats({ monthlyStats: { '2026-07': monthly['2026-07'] } })),
    ).toEqual([]);
    expect(buildMonthOptions(baseStats({ monthlyStats: {} }))).toEqual([]);
  });
});

describe('buildStats — filtered by month', () => {
  const stats = baseStats({
    attendPct: 88,
    attendedDays: 23,
    totalAyat: 1240,
    avgLoh: 86,
    monthlyStats: {
      '2026-06': {
        attendPct: 70,
        attendedDays: 7,
        halaqaDays: 10,
        totalAyat: 300,
        avgLoh: 78,
        avgMadi: 74,
      },
      '2026-07': {
        attendPct: 92,
        attendedDays: 12,
        halaqaDays: 13,
        totalAyat: 540,
        avgLoh: null,
        avgMadi: null,
      },
    },
  });

  it('reads the four cells out of monthlyStats for the chosen month', () => {
    const cells = buildStats(stats, '2026-06');
    expect(cells[0].value).toBe('٧٠٪');
    expect(cells[0].sub).toBe('٧ من ١٠ أيام');
    expect(cells[1].value).toBe('٣٠٠');
    expect(cells[2].value).toBe('٧٨٪');
    expect(cells[3].value).toBe('٧٤٪');
  });

  it('still dashes an unscored month instead of printing zero', () => {
    expect(buildStats(stats, '2026-07')[2].value).toBe('—');
    expect(buildStats(stats, '2026-07')[3].value).toBe('—');
  });

  // Documents published before these two fields existed keep working: the
  // month cell falls back to a dash and drops the fraction rather than
  // inventing a denominator out of the all-time figure.
  it('degrades gracefully for months published before halaqaDays and avgMadi', () => {
    const legacy = baseStats({
      monthlyStats: {
        '2026-05': { attendPct: 60, attendedDays: 6, totalAyat: 200, avgLoh: 80 },
        '2026-06': { attendPct: 70, attendedDays: 7, totalAyat: 300, avgLoh: 78 },
      },
    });
    const cells = buildStats(legacy, '2026-05');
    expect(cells[0].sub).toBeUndefined();
    expect(cells[3].value).toBe('—');
  });

  it('falls back to the all-time figures for الكل or an unknown month', () => {
    expect(buildStats(stats, ALL_MONTHS)[0].value).toBe('٨٨٪');
    expect(buildStats(stats, '1999-01')[0].value).toBe('٨٨٪');
    expect(buildStats(stats)[0].value).toBe('٨٨٪');
  });

  // The filter moves four numbers and nothing else; the labels must not drift
  // or the two states stop being comparable at a glance.
  it('keeps the same labels in both states', () => {
    expect(buildStats(stats, '2026-06').map((c) => c.label)).toEqual(
      buildStats(stats).map((c) => c.label),
    );
  });
});
