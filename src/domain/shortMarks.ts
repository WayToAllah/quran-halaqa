// Short links for the mushaf's red-marked words. The full link carries every
// marked word in its query string (e=…&p=…&x=…), so it grows with the number
// of mistakes; the short one is a fixed-length code that the tiny `m/` page
// looks up in Firestore (`marks/{code}`) and turns back into the full link.
// Pure — no DOM, no Firebase.

/** Same alphabet as parent tokens: no 0/O or 1/l/I, so a code read off a
 *  screenshot can't be mistyped. 57^7 ≈ 2·10^12 — far past guessing, and the
 *  collection can't be listed anyway (`list: if false`). */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const MARKS_CODE_LENGTH = 7;

export function genMarksCode(random: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < MARKS_CODE_LENGTH; i++) {
    c += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
  }
  return c;
}

/** Only what the viewer's own short format can contain: digits, the
 *  separators . _ - and the three keys e/p/x. Mirrors the `q` check in
 *  firestore.rules, so anything that passes here is also accepted there. */
const QUERY_RE = /^[0-9a-z._&=-]+$/;
export const MAX_MARKS_QUERY = 1500;

/** The marks part of a full viewer link (`e=…&p=…&x=…`), or null when the
 *  link isn't one the short page could rebuild. */
export function marksQueryOf(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const q = url.search.replace(/^\?/, '');
  if (!q || q.length > MAX_MARKS_QUERY || !QUERY_RE.test(q)) return null;
  if (!new URLSearchParams(q).get('e')) return null;
  return q;
}

/** `https://host/quran-halaqa/m/?CODE` built next to the viewer's own folder,
 *  so it follows wherever the full link points. */
export function shortMarksUrl(link: string, code: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const m = /^(.*\/)mushaf\/(index\.html)?$/.exec(url.pathname);
  if (!m) return null;
  return `${url.origin}${m[1]}m/?${code}`;
}
