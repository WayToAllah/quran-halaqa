import type { MistakeTally, PublicStats, SuraAssignment } from '../../types';
import { joinSuraNames } from '../../domain/suras';
import { gregorianStr, gregorianLong } from '../../domain/dates';
import { hijriShort } from '../../domain/hijri';
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
const CHART_TOP = 14;
const CHART_BOTTOM = 86;
/** How many trailing sessions the sparkline shows. */
export const CHART_WINDOW = 8;
/** Bottom of the value axis. Deliberately NOT zero: real scores cluster
 * between 69 and 100, and stretching that band over a 0–100 axis left it
 * flattened into a third of the plot while two thirds sat empty. Fixed (not
 * fitted per student) so two children's charts — and one child's chart across
 * months — stay comparable, and so a three-point dip can't be magnified into
 * a cliff by an auto-fitted axis. */
export const CHART_FLOOR = 50;
/** The إعادة cut-off from scoring.ts. Scores below it leave the line entirely
 * (see seriesPath) and are drawn as their own marker, so one zero can't drag
 * the whole trend into a spike and hide everything else. */
export const CHART_PASS_MARK = 60;
/** Drawn on the grade boundaries, so "above the جيد جداً line" is readable
 * without doing arithmetic. */
const CHART_GRID_VALUES = [100, 90, 80, 70, CHART_PASS_MARK];

function chartX(i: number, n: number): number {
  if (n <= 1) return CHART_PAD_X;
  const step = (CHART_W - CHART_PAD_X * 2) / (n - 1);
  return CHART_PAD_X + step * i;
}
function chartY(v: number): number {
  const clamped = Math.min(100, Math.max(CHART_FLOOR, v));
  return CHART_TOP + ((100 - clamped) / (100 - CHART_FLOOR)) * (CHART_BOTTOM - CHART_TOP);
}
/** Middle of the إعادة zone — the band between the pass line and the floor. */
const REPEAT_Y = chartY((CHART_PASS_MARK + CHART_FLOOR) / 2);

/** Build an SVG path over the passing points of one series, using the point's
 * index (so loh and madi stay time-aligned even when one has gaps). A null
 * (unscored) OR an إعادة breaks the line into a new subpath rather than
 * bending down to it. */
function seriesPath(values: Array<number | null>): string {
  const n = values.length;
  const segments: string[] = [];
  let open = false;
  values.forEach((v, i) => {
    if (v == null || v < CHART_PASS_MARK) {
      open = false;
      return;
    }
    const pt = chartX(i, n) + ' ' + chartY(v);
    if (open) segments.push('L ' + pt);
    else segments.push('M ' + pt);
    open = true;
  });
  return segments.join(' ');
}

/** The إعادة points of one series, placed in the zone under the pass line. */
function seriesRepeats(values: Array<number | null>): Array<{ x: number; y: number }> {
  const n = values.length;
  const out: Array<{ x: number; y: number }> = [];
  values.forEach((v, i) => {
    if (v != null && v < CHART_PASS_MARK) out.push({ x: chartX(i, n), y: REPEAT_Y });
  });
  return out;
}

export interface ChartGridLine {
  value: number;
  y: number;
  /** Arabic-Indic label, or '' for an unlabelled line (keeps the gutter from
   * turning into a wall of numbers on a phone). */
  label: string;
  /** The إعادة cut-off, drawn heavier than the rest. */
  strong: boolean;
}

export interface ChartView {
  lohPath: string;
  madiPath: string;
  /** إعادة sessions, drawn as ✕ marks instead of points on the line. */
  lohRepeats: Array<{ x: number; y: number }>;
  madiRepeats: Array<{ x: number; y: number }>;
  gridLines: ChartGridLine[];
  /** Plot band edges + the pass line, exported so the page can draw the
   * shaded إعادة zone without re-deriving the geometry. */
  plotTop: number;
  plotBottom: number;
  plotLeft: number;
  plotRight: number;
  passY: number;
  /** Last non-null point of each series, for the end dot + label (null if the
   * series has no data at all). `label` is the value already in Arabic-Indic
   * digits — printing `value` straight produced "92٪", a Latin number wearing
   * an Arabic percent sign, right above a stat grid that reads "٩٢٪" — or the
   * word إعادة when the session failed, since "٠٪" reads like a missing
   * number rather than a grade. */
  lohLast: { x: number; y: number; value: number; label: string; repeat: boolean } | null;
  madiLast: { x: number; y: number; value: number; label: string; repeat: boolean } | null;
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
      if (v == null) continue;
      const repeat = v < CHART_PASS_MARK;
      return {
        x: chartX(i, n),
        y: repeat ? REPEAT_Y : chartY(v),
        value: v,
        label: repeat ? 'إعادة' : toArabicDigits(v),
        repeat,
      };
    }
    return null;
  };

  return {
    lohPath: seriesPath(lohVals),
    madiPath: seriesPath(madiVals),
    lohRepeats: seriesRepeats(lohVals),
    madiRepeats: seriesRepeats(madiVals),
    gridLines: CHART_GRID_VALUES.map((value) => ({
      value,
      y: chartY(value),
      label: value % 20 === 0 ? toArabicDigits(value) : '',
      strong: value === CHART_PASS_MARK,
    })),
    plotTop: CHART_TOP,
    plotBottom: CHART_BOTTOM,
    plotLeft: CHART_PAD_X,
    plotRight: CHART_W - CHART_PAD_X,
    passY: chartY(CHART_PASS_MARK),
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
    // Deliberately the SAME number the percentage is built from. It used to be
    // sessionsCount, counted from a different set (recitation sessions only,
    // not deduplicated by day) — so a boy marked present on six group-attendance
    // days read as "١٠٠٪ حضور · ١٤ جلسة" over a 20-day window, which a parent
    // rightly reads as a contradiction. `uniqueDays` is the fallback for
    // documents published before attendedDays existed.
    {
      label: 'أيام الحضور',
      value: toArabicDigits(stats.attendedDays ?? stats.uniqueDays),
      color: 'ink',
    },
    {
      label: 'متوسط اللوح',
      value: stats.avgLoh != null ? toArabicDigits(stats.avgLoh) + '٪' : '—',
      color: 'ink',
    },
  ];
}

// ---- Dates ---------------------------------------------------------------

/**
 * Sura + ayah range for parent eyes: "البقرة (٢٨٠–٢٨٦)".
 *
 * The conversion happens HERE and not inside joinSuraNames, which the admin
 * log and the WhatsApp message also use — changing it there would rewrite
 * their numerals too. This page is the only place that has committed to
 * Arabic-Indic throughout.
 */
function suraLabelForParent(list: SuraAssignment[]): string {
  return toArabicDigits(joinSuraNames(list));
}

/**
 * A session date for the timeline, in both calendars.
 *
 * The stored value is a bare 'YYYY-MM-DD' and it used to be printed straight
 * to the parent — a Latin-digit ISO string in a page whose every other number
 * is Arabic-Indic. Hijri leads and Gregorian sits underneath, the same way the
 * admin log shows a session, and the weekday is spelled out because a halaqa
 * runs on fixed days and "الجمعة" tells a parent more than the day number.
 *
 * `hijri` is '' when the runtime has no islamic-umalqura calendar; callers
 * fall back to the Gregorian line alone, matching the live app.
 */
export function formatSessionDate(date: string): { hijri: string; gregorian: string } {
  if (!date) return { hijri: '', gregorian: '' };
  return {
    hijri: hijriShort(date),
    gregorian: gregorianStr(date, { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

/** One-line form for the "آخر جلسة" label: "٥ صفر — ٢٠ يوليو". Same shape the
 * record screen's date card uses. */
export function formatShortDate(date: string): string {
  if (!date) return '';
  return [hijriShort(date), gregorianLong(date)].filter(Boolean).join(' — ');
}

// ---- Current task + sessions ---------------------------------------------

export interface TaskView {
  loh: string | null;
  madi: string | null;
  date: string;
  /** Ready to print: Hijri — Gregorian, both in Arabic numerals. */
  dateLabel: string;
}

export function buildCurrentTask(stats: PublicStats): TaskView | null {
  const t = stats.currentTask;
  if (!t) return null;
  const loh = t.newLoh.length ? suraLabelForParent(t.newLoh) : null;
  const madi = t.newMadi.length ? suraLabelForParent(t.newMadi) : null;
  if (!loh && !madi) return null;
  return { loh, madi, date: t.date, dateLabel: formatShortDate(t.date) };
}

export interface SessionView {
  date: string;
  /** Hijri line (may be '' when the calendar is unavailable). */
  dateHijri: string;
  /** Gregorian line with the weekday spelled out, in Arabic numerals. */
  dateGregorian: string;
  loh: number | null;
  madi: number | null;
  lohLabel: string;
  madiLabel: string;
  lohPct: string;
  madiPct: string;
  /** What today's loh score actually grades: the sura(s) assigned in the
   * PREVIOUS session. null when this was the student's first session (nothing
   * had been assigned yet) or the predecessor is outside the published window. */
  recitedLoh: string | null;
  recitedMadi: string | null;
  /** '٢ خطأ · ١ خطأ تجويدي' — omitted entirely when the teacher recorded no
   * tally, which is different from recording a tally of zero. */
  lohMistakes: string | null;
  madiMistakes: string | null;
  /** Assigned THIS session, to be recited next time. */
  newLoh: string | null;
  newMadi: string | null;
  note: string;
}

/** How many recent sessions the timeline shows. */
export const SESSIONS_WINDOW = 5;

function mistakeLine(m: MistakeTally | undefined): string | null {
  if (!m) return null;
  const parts: string[] = [];
  if (m.full) parts.push(toArabicDigits(m.full) + ' خطأ');
  if (m.tajweed) parts.push(toArabicDigits(m.tajweed) + ' خطأ تجويدي');
  return parts.length ? parts.join(' · ') : 'بدون أخطاء';
}

export function buildSessions(stats: PublicStats): SessionView[] {
  const all = stats.recentSessions;
  return all.slice(0, SESSIONS_WINDOW).map((s, i) => {
    const when = formatSessionDate(s.date);
    // recentSessions is newest-first and excludes attendance-only days, so the
    // next element is the previous real session — exactly what the admin app
    // grades against (findPreviousSession). Indexing into the full array, not
    // the sliced one, so the oldest row on screen still finds its predecessor.
    const prev = all[i + 1];
    return {
      date: s.date,
      dateHijri: when.hijri,
      dateGregorian: when.gregorian,
      loh: s.loh ? s.loh.score : null,
      madi: s.madi ? s.madi.score : null,
      lohLabel: s.loh ? toArabicDigits(s.loh.score) : '—',
      madiLabel: s.madi ? toArabicDigits(s.madi.score) : '—',
      lohPct: (s.loh ? s.loh.score : 0) + '%',
      madiPct: (s.madi ? s.madi.score : 0) + '%',
      recitedLoh: prev && prev.newLoh.length ? suraLabelForParent(prev.newLoh) : null,
      recitedMadi: prev && prev.newMadi.length ? suraLabelForParent(prev.newMadi) : null,
      lohMistakes: s.loh ? mistakeLine(s.loh.mistakes) : null,
      madiMistakes: s.madi ? mistakeLine(s.madi.mistakes) : null,
      newLoh: s.newLoh.length ? suraLabelForParent(s.newLoh) : null,
      newMadi: s.newMadi.length ? suraLabelForParent(s.newMadi) : null,
      note: s.note,
    };
  });
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
