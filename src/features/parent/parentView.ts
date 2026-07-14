import type { PublicStats } from '../../types';
import { joinSuraNames } from '../../domain/suras';
import { toArabicDigits, formatArabicNumber } from '../../domain/text';

/**
 * Pure transforms for the parent (child) page. Kept DOM-free so the chart
 * geometry, trend logic, and Arabic-numeral formatting are unit-testable
 * without rendering. The Preact component (ParentPage.tsx) owns state,
 * data fetching, and theming; this module owns "given a PublicStats, what
 * exactly gets drawn".
 */

// Re-exported for existing importers of these helpers from parentView.
export { toArabicDigits, formatArabicNumber };

// ---- Arabic-Indic numeral formatting (shared via domain/text) ------------
// toArabicDigits / formatArabicNumber are imported and re-exported above.

// ---- Theme ---------------------------------------------------------------

export interface ParentTheme {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  inkDeep: string;
  inkTint: string;
  accent: string;
  accentTint: string;
  good: string;
  goodTint: string;
  warn: string;
  text: string;
  textMuted: string;
  textHint: string;
  border: string;
  borderStrong: string;
  shadowSm: string;
  headerBg: string;
}

/** Light/dark palettes ported verbatim from the approved redesign
 * (teal ink + copper accent) — deliberately NOT the admin app's emerald
 * Tailwind theme, since the parent page has its own visual identity. */
export function getParentTheme(dark: boolean): ParentTheme {
  if (!dark) {
    return {
      bg: 'oklch(97% 0.014 85)',
      surface: 'oklch(99% 0.006 85)',
      surface2: 'oklch(95% 0.018 85)',
      ink: 'oklch(37% 0.055 210)',
      inkDeep: 'oklch(26% 0.05 210)',
      inkTint: 'oklch(93% 0.018 210)',
      accent: 'oklch(58% 0.13 55)',
      accentTint: 'oklch(92% 0.045 60)',
      good: 'oklch(56% 0.09 150)',
      goodTint: 'oklch(93% 0.035 150)',
      warn: 'oklch(53% 0.13 30)',
      text: 'oklch(24% 0.015 85)',
      textMuted: 'oklch(47% 0.015 85)',
      textHint: 'oklch(63% 0.012 85)',
      border: 'oklch(24% 0.015 85 / 0.09)',
      borderStrong: 'oklch(24% 0.015 85 / 0.16)',
      shadowSm: '0 1px 2px oklch(24% 0.02 85 / 0.05), 0 4px 12px oklch(24% 0.02 85 / 0.05)',
      headerBg: 'linear-gradient(165deg, oklch(26% 0.05 210), oklch(37% 0.055 210) 75%)',
    };
  }
  return {
    bg: 'oklch(18% 0.02 220)',
    surface: 'oklch(23% 0.025 220)',
    surface2: 'oklch(28% 0.03 220)',
    ink: 'oklch(78% 0.06 210)',
    inkDeep: 'oklch(88% 0.04 210)',
    inkTint: 'oklch(30% 0.04 210)',
    accent: 'oklch(70% 0.12 55)',
    accentTint: 'oklch(30% 0.05 55)',
    good: 'oklch(70% 0.1 150)',
    goodTint: 'oklch(28% 0.05 150)',
    warn: 'oklch(68% 0.14 30)',
    text: 'oklch(92% 0.01 220)',
    textMuted: 'oklch(68% 0.015 220)',
    textHint: 'oklch(52% 0.012 220)',
    border: 'oklch(92% 0.01 220 / 0.08)',
    borderStrong: 'oklch(92% 0.01 220 / 0.15)',
    shadowSm: '0 1px 2px oklch(0% 0 0 / 0.3), 0 4px 14px oklch(0% 0 0 / 0.35)',
    headerBg: 'linear-gradient(165deg, oklch(10% 0.02 220), oklch(16% 0.025 220) 75%)',
  };
}

// ---- Chart ---------------------------------------------------------------

const CHART_W = 320;
const CHART_PAD_X = 18;
const CHART_TOP = 20;
const CHART_BOTTOM = 80;
/** How many trailing sessions the sparkline shows. */
export const CHART_WINDOW = 8;

function chartX(i: number, n: number): number {
  if (n <= 1) return CHART_PAD_X;
  const step = (CHART_W - CHART_PAD_X * 2) / (n - 1);
  return CHART_PAD_X + step * i;
}
function chartY(v: number): number {
  return CHART_TOP + ((100 - v) / 100) * (CHART_BOTTOM - CHART_TOP);
}

/** Build an SVG path string over the non-null points of one series, using the
 * point's index (so loh and madi stay time-aligned even when one has gaps). */
function seriesPath(values: Array<number | null>): string {
  const n = values.length;
  const pts: string[] = [];
  values.forEach((v, i) => {
    if (v != null) pts.push(chartX(i, n) + ' ' + chartY(v));
  });
  return pts.length ? 'M ' + pts.join(' L ') : '';
}

export interface ChartView {
  lohPath: string;
  madiPath: string;
  /** Last non-null point of each series, for the end dot + label (null if the
   * series has no data at all). */
  lohLast: { x: number; y: number; value: number } | null;
  madiLast: { x: number; y: number; value: number } | null;
  viewBox: string;
}

export function buildChart(history: PublicStats['scoreHistory']): ChartView {
  const window = history.slice(-CHART_WINDOW);
  const n = window.length;
  const lohVals = window.map((h) => h.loh);
  const madiVals = window.map((h) => h.madi);

  const lastNonNull = (vals: Array<number | null>) => {
    for (let i = vals.length - 1; i >= 0; i--) {
      const v = vals[i];
      if (v != null) return { x: chartX(i, n), y: chartY(v), value: v };
    }
    return null;
  };

  return {
    lohPath: seriesPath(lohVals),
    madiPath: seriesPath(madiVals),
    lohLast: lastNonNull(lohVals),
    madiLast: lastNonNull(madiVals),
    viewBox: `0 0 ${CHART_W} 100`,
  };
}

// ---- Trend ---------------------------------------------------------------

export type TrendTone = 'good' | 'muted' | 'warn';
export interface TrendView {
  text: string;
  tone: TrendTone;
}

/** Compare the recent half of the windowed loh scores against the older half.
 * Needs at least two scored points to say anything. */
export function buildTrend(history: PublicStats['scoreHistory']): TrendView {
  const loh = history
    .slice(-CHART_WINDOW)
    .map((h) => h.loh)
    .filter((v): v is number => v != null);
  if (loh.length < 2) return { text: '➡️ مستقر', tone: 'muted' };

  const mid = Math.floor(loh.length / 2);
  const older = loh.slice(0, mid);
  const recent = loh.slice(mid);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const diff = avg(recent) - avg(older);

  if (diff >= 5) return { text: '📈 في تحسّن مستمر', tone: 'good' };
  if (diff <= -5) return { text: '📉 محتاج تشجيع ومتابعة أكتر', tone: 'warn' };
  return { text: '➡️ مستقر', tone: 'muted' };
}

// ---- Stat grid (no comparative deltas, per product decision) --------------

export type ColorRole = 'ink' | 'accent';
export interface StatCell {
  label: string;
  value: string;
  color: ColorRole;
}

export function buildStats(stats: PublicStats): StatCell[] {
  return [
    { label: 'نسبة الحضور', value: toArabicDigits(stats.attendPct) + '٪', color: 'ink' },
    { label: 'آية مُسمّعة', value: formatArabicNumber(stats.totalAyat), color: 'accent' },
    { label: 'عدد الجلسات', value: toArabicDigits(stats.sessionsCount), color: 'ink' },
    {
      label: 'متوسط اللوح',
      value: stats.avgLoh != null ? toArabicDigits(stats.avgLoh) + '٪' : '—',
      color: 'ink',
    },
  ];
}

// ---- Current task + sessions ---------------------------------------------

export interface TaskView {
  loh: string | null;
  madi: string | null;
  date: string;
}

export function buildCurrentTask(stats: PublicStats): TaskView | null {
  const t = stats.currentTask;
  if (!t) return null;
  const loh = t.newLoh.length ? joinSuraNames(t.newLoh) : null;
  const madi = t.newMadi.length ? joinSuraNames(t.newMadi) : null;
  if (!loh && !madi) return null;
  return { loh, madi, date: t.date };
}

export interface SessionView {
  date: string;
  loh: number | null;
  madi: number | null;
  lohLabel: string;
  madiLabel: string;
  lohPct: string;
  madiPct: string;
  newLoh: string | null;
  newMadi: string | null;
  note: string;
}

/** How many recent sessions the timeline shows. */
export const SESSIONS_WINDOW = 5;

export function buildSessions(stats: PublicStats): SessionView[] {
  return stats.recentSessions.slice(0, SESSIONS_WINDOW).map((s) => ({
    date: s.date,
    loh: s.loh ? s.loh.score : null,
    madi: s.madi ? s.madi.score : null,
    lohLabel: s.loh ? toArabicDigits(s.loh.score) : '—',
    madiLabel: s.madi ? toArabicDigits(s.madi.score) : '—',
    lohPct: (s.loh ? s.loh.score : 0) + '%',
    madiPct: (s.madi ? s.madi.score : 0) + '%',
    newLoh: s.newLoh.length ? joinSuraNames(s.newLoh) : null,
    newMadi: s.newMadi.length ? joinSuraNames(s.newMadi) : null,
    note: s.note,
  }));
}

// ---- Header --------------------------------------------------------------

export function firstInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0] : '؟';
}

export function rankBadgeText(rank: number | null): string | null {
  if (rank == null) return null;
  return '🥇 المركز ' + toArabicDigits(rank) + ' في الحضور';
}
