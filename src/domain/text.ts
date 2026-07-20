/**
 * Escape any value before injecting it into innerHTML/HTML output — closes
 * the stored-XSS hole where student names/notes could otherwise run as
 * HTML/JS. Safe for both text nodes and quoted HTML attributes.
 *
 * Note: with the Preact rewrite this becomes far less load-bearing, since
 * JSX escapes text content by default — but it's kept here for any raw HTML
 * string building (e.g. WhatsApp message text) that still needs it.
 */
export function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );
}

/**
 * Arabic search normalization: unify hamza forms, ya/alef-maqsura, ta-marbuta,
 * and strip diacritics — so typing "احمد" matches a stored "أحمد", etc.
 */
export function normAr(s: unknown): string {
  return String(s ?? '')
    .replace(/[\u064B-\u0652\u0670]/g, '') // تشكيل
    .replace(/[\u0623\u0625\u0622]/g, '\u0627') // أ إ آ -> ا
    .replace(/\u0649/g, '\u064A') // ى -> ي
    .replace(/\u0629/g, '\u0647') // ة -> ه
    .replace(/\s+/g, ' ')
    .trim();
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Convert every ASCII digit in a value to its Arabic-Indic form. */
export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

/** Group thousands with the Arabic separator and render Arabic-Indic digits. */
export function formatArabicNumber(n: number): string {
  const grouped = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return toArabicDigits(grouped);
}

// Standalone ordinals 1–10, e.g. "الأول", "الخامس".
const AR_ORDINAL_UNITS = [
  '',
  'الأول',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
  'التاسع',
  'العاشر',
];
// Compound form of 1–9 used inside "الحادي عشر" / "الحادي والعشرون" — note
// 1 becomes "الحادي" here instead of "الأول".
const AR_ORDINAL_COMPOUND_UNITS = [
  '',
  'الحادي',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
  'التاسع',
];
const AR_ORDINAL_TENS = [
  '',
  '',
  'العشرون',
  'الثلاثون',
  'الأربعون',
  'الخمسون',
  'الستون',
  'السبعون',
  'الثمانون',
  'التسعون',
];

/**
 * Convert a rank (1-based) to its Arabic ordinal word — "الأول", "الثاني",
 * "الحادي عشر", "الثاني والعشرون", etc. Covers 1–99 (comfortably more than
 * any realistic student-ranking list); falls back to Arabic-Indic digits
 * for 0, negatives, or 100+ rather than guessing at an unsupported form.
 */
export function toArabicOrdinal(rank: number): string {
  if (!Number.isInteger(rank) || rank <= 0 || rank >= 100) return toArabicDigits(rank);
  if (rank <= 10) return AR_ORDINAL_UNITS[rank];
  if (rank < 20) return `${AR_ORDINAL_COMPOUND_UNITS[rank - 10]} عشر`;
  if (rank % 10 === 0) return AR_ORDINAL_TENS[Math.floor(rank / 10)];
  const tens = Math.floor(rank / 10);
  const units = rank % 10;
  return `${AR_ORDINAL_COMPOUND_UNITS[units]} و${AR_ORDINAL_TENS[tens]}`;
}
