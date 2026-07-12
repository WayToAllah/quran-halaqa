import type { Student, SessionRecord } from '../types';
import { getAttendanceRanking, ATTENDANCE_BADGE_THRESHOLD } from './attendance';
import { esc, toArabicDigits } from './text';

/**
 * Pure builder for the shareable "نجوم الحضور" card. This is a *faithful*
 * port of the approved poster mockup (Attendance_Stars_Poster) — same
 * canvas size (1080×1350, matches the mockup's own preview dimensions 1:1,
 * so every pixel value below is copied straight from its CSS, not
 * re-guessed), same crown SVG path for 1st place, same gold/silver medal
 * emoji for 2nd/3rd (the mockup used plain emoji glyphs here, not a custom
 * icon — kept as-is), same badge sizing/shadow/border treatment. Two
 * deliberate deviations from the mockup, both agreed on explicitly:
 *   1. A 4th-place bronze tier was added (mockup only had 1st/2nd/3rd).
 *   2. Percentages/ranks use Arabic-Indic digits (٠-٩), matching the rest
 *      of the app's number formatting — the mockup's own numeric fallback
 *      for rank>3 never actually appeared in its 4-student sample data.
 *
 * The mockup's oklch(...) badge colors were converted to exact hex via the
 * standard OKLab/OKLCH→sRGB transform (not eyeballed), so the badge tints
 * match what the original design intended pixel-for-pixel, while staying
 * safe for SVG→canvas→PNG rasterization (oklch() has inconsistent canvas
 * support; hex does not).
 *
 * Rendered as a self-contained SVG rather than the mockup's own template
 * format (which only runs inside its own design-preview renderer) — this
 * makes the exact same visual embeddable in the stats screen and turnable
 * into a PNG via canvas, which the design tool's output cannot do directly.
 */

const CARD = {
  w: 1080,
  h: 1350,
  teal: '#1B4D5C',
  tealDeep: '#123842',
  cream: '#FAF6ED',
  copper: '#B8722E',
  ink: '#1B4D5C',
};

type RankKind = 'crown' | 'gold' | 'silver' | 'bronze' | 'number';

interface RankStyle {
  kind: RankKind;
  bg: string;
  border: string;
  color: string;
  medalEmoji?: string;
}

/** Colors converted from the mockup's oklch(...) values via the exact
 * OKLab/OKLCH→sRGB transform — see module doc. Bronze (rank 4) has no
 * mockup source (added per product decision); its tones follow the same
 * "pale tint of the accent color" pattern the other three use. */
const RANK_STYLES: Record<number, RankStyle> = {
  1: { kind: 'crown', bg: '#fae6bb', border: '#d5b36a', color: '#B8860B' },
  2: { kind: 'gold', bg: '#f0dcb1', border: '#d3aa64', color: '#C9971F', medalEmoji: '🥇' },
  3: { kind: 'silver', bg: '#dadee3', border: '#b2b8bf', color: '#9AA0A6', medalEmoji: '🥈' },
  4: { kind: 'bronze', bg: '#e8d0bb', border: '#c08a55', color: '#A8672E', medalEmoji: '🥉' },
};
const FALLBACK_STYLE: RankStyle = { kind: 'number', bg: '#f2e5db', border: '#d7b79e', color: '#B8722E' };

function rankStyle(rank: number): RankStyle {
  return RANK_STYLES[rank] ?? FALLBACK_STYLE;
}

function starsForPct(pct: number): number {
  return Math.max(0, Math.min(5, Math.round(pct / 20)));
}

function gregorianArabicDate(d: Date): string {
  return toArabicDigits(`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`);
}

export interface AttendanceCardStar {
  rank: number;
  name: string;
  attendPct: number;
  uniqueDays: number;
  filledStars: number;
  style: RankStyle;
}

export interface AttendanceCardData {
  mosqueName: string;
  title: string;
  totalHalaqaDays: number;
  dateLabel: string;
  count: number;
  stars: AttendanceCardStar[];
}

export interface CardOptions {
  mosqueName?: string;
  minPct?: number;
  limit?: number;
  now?: Date;
}

export function buildAttendanceCardData(
  students: Student[],
  records: SessionRecord[],
  opts: CardOptions = {},
): AttendanceCardData {
  const minPct = opts.minPct ?? ATTENDANCE_BADGE_THRESHOLD;
  const limit = opts.limit ?? 8;
  const { totalHalaqaDays, list } = getAttendanceRanking(students, records, minPct);
  const stars: AttendanceCardStar[] = list.slice(0, limit).map((e) => ({
    rank: e.rank,
    name: e.name,
    attendPct: e.attendPct,
    uniqueDays: e.uniqueDays,
    filledStars: starsForPct(e.attendPct),
    style: rankStyle(e.rank),
  }));
  return {
    mosqueName: opts.mosqueName ?? 'مسجد التيسير',
    title: 'نجوم الحضور',
    totalHalaqaDays,
    dateLabel: gregorianArabicDate(opts.now ?? new Date()),
    count: stars.length,
    stars,
  };
}

// ---- SVG rendering ---------------------------------------------------
// Layout constants copied 1:1 from the mockup's CSS (its own preview
// canvas is 1080×1350, same as CARD.w/h, so no scaling is needed).

const PANEL_X = 70; // left: 70px; right: 70px
const PANEL_TOP = 290; // top: 290px
const PANEL_BOTTOM_GAP = 120; // bottom: 120px
const ROW_PAD_Y = 26; // padding: 26px 0 per row
const BADGE_D = 60; // 60px badge circle
const BADGE_R = BADGE_D / 2;
const ROW_GAP = 22; // gap: 22px between badge / name+stars / percentage

/** Exact crown path from the mockup (viewBox 0 0 24 24), scaled to its
 * mockup width/height of 30px and centered in the 60px badge circle. */
function crownIcon(cx: number, cy: number, color: string): string {
  const scale = 30 / 24;
  const tx = cx - 12 * scale;
  const ty = cy - 12 * scale;
  return `<g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="M3 8l4 3 5-6 5 6 4-3-1.6 10H4.6L3 8z" fill="${color}"/>
    <rect x="4.6" y="18.6" width="14.8" height="2.4" rx="1.2" fill="${color}"/>
  </g>`;
}

function starGlyph(cx: number, cy: number, r: number, filled: boolean): string {
  const color = filled ? '#E8B84B' : '#E3DDCC';
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerAngle = outerAngle + Math.PI / 5;
    pts.push(`${cx + r * Math.cos(outerAngle)},${cy + r * Math.sin(outerAngle)}`);
    pts.push(`${cx + r * 0.42 * Math.cos(innerAngle)},${cy + r * 0.42 * Math.sin(innerAngle)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
}

function rankBadge(cx: number, cy: number, entry: AttendanceCardStar): string {
  const { style, rank } = entry;
  // box-shadow 0 2px 6px rgba(0,0,0,.12) from the mockup, approximated as a
  // soft offset circle beneath the badge (SVG has no CSS box-shadow).
  const shadow = `<circle cx="${cx}" cy="${cy + 2}" r="${BADGE_R}" fill="black" opacity="0.10"/>`;
  const circle = `<circle cx="${cx}" cy="${cy}" r="${BADGE_R}" fill="${style.bg}" stroke="${style.border}" stroke-width="2"/>`;
  if (style.kind === 'crown') return shadow + circle + crownIcon(cx, cy, style.color);
  if (style.medalEmoji) {
    return (
      shadow +
      circle +
      `<text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="26">${style.medalEmoji}</text>`
    );
  }
  return (
    shadow +
    circle +
    `<text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="22" font-weight="900" fill="${style.color}">${toArabicDigits(rank)}</text>`
  );
}

/** Render the card as a standalone SVG string (1080×1350 portrait). */
export function buildAttendanceCardSvg(data: AttendanceCardData): string {
  const { w, h } = CARD;
  const panelW = w - PANEL_X * 2;
  const rowH = 32 * 2 + ROW_PAD_Y * 2 + 8; // name line + stars line + top/bottom padding, ~+8 for line-height slack
  const badgeCx = w - PANEL_X - 22 - BADGE_R; // 44px horizontal padding inside the panel + row gap
  const firstRowCy = PANEL_TOP + 8 + ROW_PAD_Y + BADGE_R;

  const rows = data.stars
    .map((s, i) => {
      const cy = firstRowCy + i * rowH;
      const nameRightX = badgeCx - BADGE_R - ROW_GAP;
      const starsY = cy + 26;
      const starSpacing = 26;
      const stars = Array.from({ length: 5 }, (_, k) =>
        starGlyph(nameRightX - k * starSpacing, starsY, 10, k < s.filledStars),
      ).join('');
      return `
    <g>
      ${rankBadge(badgeCx, cy, s)}
      <text x="${nameRightX}" y="${cy - 4}" text-anchor="end" font-size="32" font-weight="700" fill="${CARD.ink}">${esc(s.name)}</text>
      ${stars}
      <text x="${PANEL_X + 44}" y="${cy + 14}" text-anchor="start" font-size="40" font-weight="900" fill="${CARD.copper}">${toArabicDigits(s.attendPct)}٪</text>
    </g>`;
    })
    .join('');

  const rowDividers = data.stars
    .slice(0, -1)
    .map((_, i) => {
      const y = firstRowCy + i * rowH + rowH / 2;
      return `<line x1="${PANEL_X + 30}" y1="${y}" x2="${w - PANEL_X - 30}" y2="${y}" stroke="#3B352D" stroke-opacity="0.1" stroke-width="1"/>`;
    })
    .join('');

  const panelH = h - PANEL_TOP - PANEL_BOTTOM_GAP;
  const daysText = toArabicDigits(data.totalHalaqaDays);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Tajawal, 'Segoe UI', Tahoma, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${CARD.teal}"/>
      <stop offset="0.8" stop-color="${CARD.tealDeep}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="28" y="28" width="${w - 56}" height="${h - 56}" rx="28" fill="none" stroke="${CARD.copper}" stroke-width="2" opacity="0.5"/>

  <text x="${w / 2}" y="100" text-anchor="middle" font-size="26" fill="${CARD.copper}" font-weight="700">${esc(data.mosqueName)}</text>
  <text x="${w / 2}" y="170" text-anchor="middle" font-size="56" fill="${CARD.cream}" font-weight="900" letter-spacing="-0.01em">🌟 ${esc(data.title)} 🌟</text>
  <text x="${w / 2}" y="212" text-anchor="middle" font-size="24" fill="${CARD.cream}" opacity="0.78" font-weight="500">من إجمالي ${esc(daysText)} أيام حلقة</text>

  <rect x="${PANEL_X}" y="${PANEL_TOP}" width="${panelW}" height="${panelH}" rx="26" fill="${CARD.cream}"/>
  ${rowDividers}
  ${rows}

  <text x="${w / 2}" y="${h - 96}" text-anchor="middle" font-size="30" fill="${CARD.cream}" opacity="0.85">متابعة حفظ القرآن</text>
  <text x="${w / 2}" y="${h - 56}" text-anchor="middle" font-size="26" fill="${CARD.copper}">${esc(data.dateLabel)}</text>
</svg>`;
}
