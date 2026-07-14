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
} from './parentView';

function baseStats(overrides: Partial<PublicStats> = {}): PublicStats {
  return {
    name: 'زيد أحمد',
    updatedAt: 1_700_000_000_000,
    totalHalaqaDays: 26,
    uniqueDays: 23,
    attendPct: 88,
    rank: 2,
    sessionsCount: 23,
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
        tajweed: null,
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
    expect(cells[0]).toEqual({ label: 'نسبة الحضور', value: '٨٨٪', color: 'ink' });
    expect(cells[1].value).toBe('١٬٢٤٠');
    // no delta / comparison fields exist on the cell
    expect(Object.keys(cells[0])).toEqual(['label', 'value', 'color']);
  });

  it('shows a dash for a missing loh average', () => {
    const cells = buildStats(baseStats({ avgLoh: null }));
    expect(cells[3].value).toBe('—');
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
          tajweed: null,
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
