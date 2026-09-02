import { esc, toArabicDigits } from './text';

/**
 * The shareable stars card, ported from the live single-file app's
 * `.stars-card-visual` block (index.html) rather than from the v2 poster
 * mockup — this is the design already in use with parents, so it is the one
 * both the attendance and the pages cards are built from.
 *
 * The live card is a CSS block that grows with its content and is rasterized
 * with html2canvas. Here it is redrawn as an SVG at 3× the live pixel values
 * (360px wide → 1080px), which keeps the exported PNG sharp, keeps the
 * preview and the export byte-identical, and avoids pulling html2canvas into
 * v2 for one screen. Every constant below is the live CSS value times three.
 */

const S = 3; // 360px live width → 1080px export

export const CARD_W = 360 * S;

const PAD_X = 20 * S;
const PAD_Y = 26 * S;
const RADIUS = 18 * S;

const TITLE_SIZE = 20 * S;
const TITLE_GAP = 4 * S; // .stars-card-title margin-bottom
const SUB_SIZE = 13 * S;
const SUB_GAP = 18 * S; // .stars-card-sub margin-bottom

const ROW_H = 44 * S; // 10px padding × 2 + the badge's own line box
const ROW_GAP = 10 * S; // .stars-list gap
const ROW_RADIUS = 12 * S;
const ROW_PAD_X = 14 * S;

const BADGE_SIZE = 20 * S;
const BADGE_W = 28 * S; // .stars-rank fixed width
const NAME_SIZE = 14 * S;
const VALUE_SIZE = 14 * S;
const VALUE_PAD_X = 10 * S;
const VALUE_PAD_Y = 3 * S;

const FOOTER_SIZE = 12 * S;
const FOOTER_GAP = 18 * S; // .stars-card-footer margin-top

const COLORS = {
  greenDeep: '#0f4a2c',
  green: '#15613a',
  goldSoft: '#d4a82c',
  text: '#ffffff',
};

export interface StarsCardRow {
  rank: number;
  name: string;
  /** Already-formatted headline value, e.g. '٩٥٪' or '٤٣ صفحة'. */
  value: string;
}

export interface StarsCardModel {
  title: string;
  subtitle: string;
  footer: string;
  rows: StarsCardRow[];
}

/** 👑 / 🥈 / 🥉 for the top three, the rank itself after that — the live
 * `rankBadgeHTML`, with Arabic-Indic digits to match the rest of v2. */
export function starsRankBadge(rank: number): string {
  if (rank === 1) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return toArabicDigits(rank);
}

/** Where the row list starts — everything above it has a fixed height. */
function listTop(): number {
  return PAD_Y + TITLE_SIZE * 1.25 + TITLE_GAP + SUB_SIZE * 1.25 + SUB_GAP;
}

/** Canvas size for a card with `rowCount` rows. The live block has no fixed
 * height; it grows with the list, and so does this. */
export function starsCardSize(rowCount: number): { width: number; height: number } {
  const rows = Math.max(0, rowCount);
  const listH = rows === 0 ? 0 : rows * ROW_H + (rows - 1) * ROW_GAP;
  const height = listTop() + listH + FOOTER_GAP + FOOTER_SIZE * 1.25 + PAD_Y;
  return { width: CARD_W, height: Math.round(height) };
}

/** A decorative translucent circle, matching .stars-card-visual::before/after. */
function blob(cx: number, cy: number, r: number, opacity: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="${opacity}"/>`;
}

/**
 * A drawn medal carrying the rank, for fourth place onward. The top three keep
 * the emoji medals of the live card; below them a bare digit looked like a
 * stray number rather than a placing, so the same medal shape is drawn with
 * the rank on its disc. Latin digits here on purpose — Arabic-Indic numerals
 * are wider and lose legibility once they have to fit on a disc this size.
 */
function rankMedal(cx: number, cy: number, rank: number): string {
  const B = BADGE_SIZE;
  const r = B * 0.4;
  const discCy = cy + B * 0.16;
  const top = cy - B * 0.46;
  const digits = String(rank);
  const fontSize = r * (digits.length > 1 ? 0.78 : 0.98);
  // Two crossing ribbons meeting behind the disc, the way the emoji medals
  // read at a glance — a pair of separate tabs looked like horns.
  const left = `M${cx - B * 0.34} ${top} L${cx - B * 0.14} ${top} L${cx + B * 0.04} ${discCy} L${cx - B * 0.14} ${discCy} Z`;
  const right = `M${cx + B * 0.34} ${top} L${cx + B * 0.14} ${top} L${cx - B * 0.04} ${discCy} L${cx + B * 0.14} ${discCy} Z`;
  return `<g class="rank-medal">
        <path d="${left}" fill="#4E7FD1"/>
        <path d="${right}" fill="#3A63A8"/>
        <circle cx="${cx}" cy="${discCy}" r="${r}" fill="#C9CED4" stroke="#9AA1A9" stroke-width="${r * 0.1}"/>
        <circle cx="${cx}" cy="${discCy}" r="${r * 0.76}" fill="#E4E8EC"/>
        <text x="${cx}" y="${discCy + fontSize * 0.36}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#4A5058">${digits}</text>
      </g>`;
}

function row(r: StarsCardRow, top: number): string {
  const x = PAD_X;
  const w = CARD_W - PAD_X * 2;
  const cy = top + ROW_H / 2;

  // The live row is an RTL flex line: badge, then the name filling the middle,
  // then the value pill pushed to the far (left) end.
  const badgeCx = x + w - ROW_PAD_X - BADGE_W / 2;
  const nameRightX = badgeCx - BADGE_W / 2 - ROW_GAP;

  const valueW = Math.max(
    VALUE_SIZE * 2.2,
    [...r.value].length * VALUE_SIZE * 0.58 + VALUE_PAD_X * 2,
  );
  const valueH = VALUE_SIZE * 1.25 + VALUE_PAD_Y * 2;
  const valueX = x + ROW_PAD_X;

  return `
    <g>
      <rect x="${x}" y="${top}" width="${w}" height="${ROW_H}" rx="${ROW_RADIUS}" fill="#ffffff" opacity="0.14"/>
      ${
        r.rank <= 3
          ? `<text x="${badgeCx}" y="${cy + BADGE_SIZE * 0.36}" text-anchor="middle" font-size="${BADGE_SIZE}">${starsRankBadge(r.rank)}</text>`
          : rankMedal(badgeCx, cy, r.rank)
      }
      <text x="${nameRightX}" y="${cy + NAME_SIZE * 0.36}" text-anchor="end" font-size="${NAME_SIZE}" font-weight="600" fill="${COLORS.text}">${esc(r.name)}</text>
      <rect x="${valueX}" y="${cy - valueH / 2}" width="${valueW}" height="${valueH}" rx="${valueH / 2}" fill="#ffffff" opacity="0.2"/>
      <text x="${valueX + valueW / 2}" y="${cy + VALUE_SIZE * 0.36}" text-anchor="middle" font-size="${VALUE_SIZE}" font-weight="800" fill="${COLORS.text}">${esc(r.value)}</text>
    </g>`;
}

export function buildStarsCardSvg(model: StarsCardModel): string {
  const { width: w, height: h } = starsCardSize(model.rows.length);
  const cx = w / 2;

  const top = listTop();
  const rows = model.rows.map((r, i) => row(r, top + i * (ROW_H + ROW_GAP))).join('');

  const titleY = PAD_Y + TITLE_SIZE;
  const subY = PAD_Y + TITLE_SIZE * 1.25 + TITLE_GAP + SUB_SIZE;
  const listH =
    model.rows.length === 0 ? 0 : model.rows.length * ROW_H + (model.rows.length - 1) * ROW_GAP;
  const footerY = top + listH + FOOTER_GAP + FOOTER_SIZE;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" direction="ltr" font-family="Tajawal, 'Segoe UI', Tahoma, sans-serif">
  <defs>
    <linearGradient id="starsBg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${COLORS.greenDeep}"/>
      <stop offset="0.6" stop-color="${COLORS.green}"/>
      <stop offset="1" stop-color="${COLORS.goldSoft}"/>
    </linearGradient>
    <clipPath id="starsClip">
      <rect width="${w}" height="${h}" rx="${RADIUS}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#starsClip)">
    <rect width="${w}" height="${h}" fill="url(#starsBg)"/>
    ${blob(w + 40 * S - 70 * S, -40 * S + 70 * S, 70 * S, 0.08)}
    ${blob(-30 * S + 80 * S, h + 50 * S - 80 * S, 80 * S, 0.06)}
    <text x="${cx}" y="${titleY}" text-anchor="middle" direction="rtl" font-size="${TITLE_SIZE}" font-weight="800" fill="${COLORS.text}">${esc(model.title)}</text>
    <text x="${cx}" y="${subY}" text-anchor="middle" direction="rtl" font-size="${SUB_SIZE}" fill="${COLORS.text}" opacity="0.88">${esc(model.subtitle)}</text>
    ${rows}
    <text x="${cx}" y="${footerY}" text-anchor="middle" direction="rtl" font-size="${FOOTER_SIZE}" fill="${COLORS.text}" opacity="0.88">${esc(model.footer)}</text>
  </g>
</svg>`;
}
