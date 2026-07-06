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
