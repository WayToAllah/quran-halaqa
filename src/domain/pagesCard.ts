import type { Student, SessionRecord } from '../types';
import { computeTopPages } from './statsScreen';
import { pagesLabel } from './pages';
import { CARD_FOOTER } from './attendanceCard';
import { buildStarsCardSvg, starsCardSize, starsRankBadge, type StarsCardModel } from './starsCard';

/**
 * "نجوم الحفظ" — the pages-memorized twin of the attendance card, drawn from
 * the same live design (starsCard.ts) so the two read as one pair in the
 * parents' group. Ranking uses the same page-counting model the stats screen
 * shows: whole mushaf pages of new اللوح memorization, إعادة and الماضي
 * excluded, dense-ranked so ties share a place.
 */

export interface PagesCardEntry {
  rank: number;
  name: string;
  pages: number;
}

export interface PagesCardData {
  title: string;
  periodLabel: string;
  /** Pages summed across the rows shown. */
  totalPages: number;
  count: number;
  entries: PagesCardEntry[];
}

export interface PagesCardOptions {
  /** Rows on the card. Ten by default — five or fewer reads as a thin list
   * rather than a ranking. */
  limit?: number;
  /** 'all', or the 'YYYY-MM' the stats screen is filtered to. */
  monthFilter?: string;
  periodLabel?: string;
}

export const DEFAULT_ROWS = 10;

export function buildPagesCardData(
  students: Student[],
  records: SessionRecord[],
  opts: PagesCardOptions = {},
): PagesCardData {
  const limit = opts.limit ?? DEFAULT_ROWS;
  const top = computeTopPages(students, records, limit, opts.monthFilter ?? 'all');
  const entries: PagesCardEntry[] = top.map((e) => ({
    rank: e.rank,
    name: e.name,
    pages: e.pages,
  }));
  return {
    title: '🌟 نجوم الحفظ',
    periodLabel: opts.periodLabel ?? 'كل الفترة',
    totalPages: entries.reduce((n, e) => n + e.pages, 0),
    count: entries.length,
    entries,
  };
}

export function pagesCardModel(data: PagesCardData): StarsCardModel {
  return {
    title: data.title,
    subtitle: `${data.periodLabel} · ${pagesLabel(data.totalPages)}`,
    footer: CARD_FOOTER,
    rows: data.entries.map((e) => ({
      rank: e.rank,
      name: e.name,
      value: pagesLabel(e.pages),
    })),
  };
}

export function buildPagesCardSvg(data: PagesCardData): string {
  return buildStarsCardSvg(pagesCardModel(data));
}

export function pagesCardSize(data: PagesCardData) {
  return starsCardSize(data.entries.length);
}

/** Plain-text ranking for a WhatsApp message. */
export function pagesCardText(data: PagesCardData): string {
  const lines = data.entries.map(
    (e) => `${starsRankBadge(e.rank)} ${e.name} — ${pagesLabel(e.pages)}`,
  );
  return [
    'السلام عليكم ورحمة الله وبركاته 🌿',
    `🌟 *نجوم الحفظ* — ${data.periodLabel}`,
    '─'.repeat(18),
    '',
    ...lines,
    '',
    CARD_FOOTER,
  ].join('\n');
}
