/**
 * Seasons (مواسم): named stretches of the calendar the teacher opens by hand —
 * «صيف 2026», «دراسة 2027» — so the stats screen and the parent page can start
 * every figure from zero at the start of a new season while the history stays
 * untouched.
 *
 * A season is only a START DATE. It ends where the next one begins, so there
 * are never gaps or overlaps, and no record carries a season tag: which season
 * a session belongs to is read off its date. Moving a start date therefore
 * re-files every record around it with no data migration.
 *
 * The first season is open at the start: anything recorded before its date
 * still belongs to it, so no record can ever fall outside every season.
 *
 * Periods: every filter the stats code accepts ('all', a 'YYYY-MM' month, or
 * a season's range) is normalised to a DateRange with an inclusive `from` and
 * an exclusive `to`. Dates are 'YYYY-MM-DD' strings, which compare correctly
 * as plain strings.
 */

export interface Season {
  /** Stable id: survives renames and start-date edits (parent pages key on it). */
  id: string;
  name: string;
  /** 'YYYY-MM-DD', inclusive. */
  from: string;
}

export interface DateRange {
  /** Inclusive; absent = from the beginning. */
  from?: string;
  /** Exclusive; absent = open-ended. */
  to?: string;
}

/** 'all', a 'YYYY-MM' month, or an explicit range. */
export type PeriodFilter = string | DateRange;

export const ALL_SEASONS = 'all';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function sortSeasons(seasons: Season[]): Season[] {
  return [...seasons].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** Reads the raw Firestore field defensively: anything malformed is dropped
 * rather than breaking the stats screen. */
export function normalizeSeasons(raw: unknown): Season[] {
  if (!Array.isArray(raw)) return [];
  const out: Season[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const { id, name, from } = x as Record<string, unknown>;
    if (typeof id !== 'string' || !id) continue;
    if (typeof name !== 'string' || !name.trim()) continue;
    if (typeof from !== 'string' || !DATE_RE.test(from)) continue;
    out.push({ id, name: name.trim(), from });
  }
  return sortSeasons(out);
}

/** The date window of a season. 'all' or an unknown id → the whole history. */
export function seasonRange(seasons: Season[], id: string): DateRange {
  const sorted = sortSeasons(seasons);
  const i = sorted.findIndex((s) => s.id === id);
  if (i < 0) return {};
  const range: DateRange = {};
  if (i > 0) range.from = sorted[i].from;
  if (i < sorted.length - 1) range.to = sorted[i + 1].from;
  return range;
}

/** The season `today` falls in — the default view. 'all' when there are no
 * seasons yet, so the app behaves exactly as before until one is created. */
export function currentSeasonId(seasons: Season[], today: string): string {
  const sorted = sortSeasons(seasons);
  if (!sorted.length) return ALL_SEASONS;
  const started = sorted.filter((s) => s.from <= today);
  return (started.length ? started[started.length - 1] : sorted[0]).id;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function toRange(filter: PeriodFilter): DateRange {
  if (typeof filter !== 'string') return filter;
  if (MONTH_RE.test(filter)) return { from: `${filter}-01`, to: `${nextMonth(filter)}-01` };
  return {};
}

export function inPeriod(date: string | undefined, filter: PeriodFilter): boolean {
  if (!date) return false;
  const { from, to } = toRange(filter);
  if (from && date < from) return false;
  if (to && date >= to) return false;
  return true;
}

export function intersectRanges(a: DateRange, b: DateRange): DateRange {
  const out: DateRange = {};
  const from = [a.from, b.from].filter(Boolean).sort().pop();
  const to = [a.to, b.to].filter(Boolean).sort()[0];
  if (from) out.from = from;
  if (to) out.to = to;
  return out;
}

export function isWholeHistory(filter: PeriodFilter): boolean {
  const { from, to } = toRange(filter);
  return !from && !to;
}

/** A primitive for useMemo deps (ranges are rebuilt objects each render). */
export function rangeKey(range: DateRange): string {
  return `${range.from ?? ''}..${range.to ?? ''}`;
}

export function filterByPeriod<T extends { date?: string }>(
  records: T[],
  filter: PeriodFilter,
): T[] {
  if (isWholeHistory(filter)) return records;
  return records.filter((r) => inPeriod(r.date, filter));
}

function newSeasonId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * The first time the teacher opens the seasons editor: the history so far
 * becomes one named season, and a new one starts today. Both are only a
 * suggestion — nothing is saved until the teacher confirms.
 */
export function suggestInitialSeasons(recordDates: string[], today: string): Season[] {
  const first = recordDates.filter((d) => DATE_RE.test(d)).sort()[0];
  const out: Season[] = [];
  if (first && first < today) {
    out.push({ id: newSeasonId(), name: `صيف ${first.slice(0, 4)}`, from: first });
  }
  out.push({ id: newSeasonId() + 'n', name: 'موسم جديد', from: today });
  return out;
}

export function makeSeason(name: string, from: string): Season {
  return { id: newSeasonId(), name, from };
}

/** Error message in Arabic for the editor, or null when the list can be saved. */
export function validateSeasons(seasons: Season[]): string | null {
  for (const s of seasons) {
    if (!s.name.trim()) return 'كل موسم لازم يكون له اسم';
    if (!DATE_RE.test(s.from)) return 'تاريخ بداية الموسم غير صحيح';
  }
  const starts = seasons.map((s) => s.from);
  if (new Set(starts).size !== starts.length) return 'موسمين مايبدأوش في نفس اليوم';
  return null;
}
