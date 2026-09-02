import type { Student, SessionRecord } from '../types';
import { getAttendanceRanking, ATTENDANCE_BADGE_THRESHOLD } from './attendance';
import { toArabicDigits } from './text';
import { buildStarsCardSvg, starsCardSize, starsRankBadge, type StarsCardModel } from './starsCard';

/**
 * "نجوم الحضور" — the shareable attendance card, drawn with the live
 * single-file app's design (see starsCard.ts). One deliberate difference from
 * the live version: it follows the period the stats screen is filtered to
 * rather than always reporting last month, because the screen already has a
 * period selector and two different answers on one screen would be confusing.
 */

export interface AttendanceCardStar {
  rank: number;
  name: string;
  attendPct: number;
  uniqueDays: number;
}

export interface AttendanceCardData {
  title: string;
  periodLabel: string;
  totalHalaqaDays: number;
  count: number;
  stars: AttendanceCardStar[];
}

export interface CardOptions {
  /** Minimum attendance to appear. Defaults to the نجم الحضور threshold. */
  minPct?: number;
  /** Rows on the card. */
  limit?: number;
  /** Label for the period shown, e.g. 'يوليو ٢٠٢٦' or 'كل الفترة'. */
  periodLabel?: string;
}

export const CARD_FOOTER = 'جزاكم الله خيراً 🤲';

export function buildAttendanceCardData(
  students: Student[],
  records: SessionRecord[],
  opts: CardOptions = {},
): AttendanceCardData {
  const minPct = opts.minPct ?? ATTENDANCE_BADGE_THRESHOLD;
  const limit = opts.limit ?? 10;
  const { totalHalaqaDays, list } = getAttendanceRanking(students, records, minPct);
  const stars: AttendanceCardStar[] = list.slice(0, limit).map((e) => ({
    rank: e.rank,
    name: e.name,
    attendPct: e.attendPct,
    uniqueDays: e.uniqueDays,
  }));
  return {
    title: '🌟 نجوم الحضور',
    periodLabel: opts.periodLabel ?? 'كل الفترة',
    totalHalaqaDays,
    count: stars.length,
    stars,
  };
}

export function attendanceCardModel(data: AttendanceCardData): StarsCardModel {
  return {
    title: data.title,
    subtitle: `${data.periodLabel} · من إجمالي ${toArabicDigits(data.totalHalaqaDays)} يوم`,
    footer: CARD_FOOTER,
    rows: data.stars.map((s) => ({
      rank: s.rank,
      name: s.name,
      value: `${toArabicDigits(s.attendPct)}٪`,
    })),
  };
}

export function buildAttendanceCardSvg(data: AttendanceCardData): string {
  return buildStarsCardSvg(attendanceCardModel(data));
}

/** Canvas size of the rendered card — needed to rasterize it to PNG. */
export function attendanceCardSize(data: AttendanceCardData) {
  return starsCardSize(data.stars.length);
}

/** Plain-text ranking for a WhatsApp message, matching the live share text. */
export function attendanceCardText(data: AttendanceCardData): string {
  const lines = data.stars.map(
    (s) => `${starsRankBadge(s.rank)} ${s.name} — ${toArabicDigits(s.attendPct)}٪`,
  );
  return [
    'السلام عليكم ورحمة الله وبركاته 🌿',
    `🌟 *نجوم الحضور* — ${data.periodLabel}`,
    '─'.repeat(18),
    '',
    ...lines,
    '',
    CARD_FOOTER,
  ].join('\n');
}
