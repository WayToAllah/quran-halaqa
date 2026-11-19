import type { SessionRecord, Student } from '../types';
import { byNewest } from './dates';
import { recordsForStudent } from './students';

/**
 * The student's own mushaf: every word ever marked wrong, kept across sessions.
 *
 * Nothing new is stored for it. Each evaluation already keeps the words marked
 * red that day (`mushaf.rk`) and, now, the earlier red words the teacher marked
 * as fixed that day (`mushaf.ok`). Replaying the student's sessions oldest
 * first gives the book: a red word stays red until a later session marks it
 * fixed (green), and a green word that is missed again goes back to red.
 *
 * Word ids are the viewer's `sura:ayah:word`; on the wire they use the viewer's
 * short format, `sura.ayah.word.word…` groups joined by `_`.
 */
export interface MushafBook {
  red: string;
  green: string;
}

const GROUP = /^\d+(\.\d+){2,}$/;
const SHORT = /^\d+(\.\d+){2,}(_\d+(\.\d+){2,})*$/;

export function decodeShortMarks(str: string | undefined | null): string[] {
  const out: string[] = [];
  (str || '').split('_').forEach((part) => {
    if (!GROUP.test(part)) return;
    const n = part.split('.').map(Number);
    n.slice(2).forEach((w) => out.push(`${n[0]}:${n[1]}:${w}`));
  });
  return out.sort(cmpId);
}

function cmpId(a: string, b: string): number {
  const x = a.split(':').map(Number);
  const y = b.split(':').map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export function encodeShortMarks(ids: Iterable<string>): string {
  const groups = new Map<string, number[]>();
  [...new Set(ids)].sort(cmpId).forEach((id) => {
    const [s, a, w] = id.split(':');
    const k = `${s}.${a}`;
    const g = groups.get(k);
    if (g) g.push(+w);
    else groups.set(k, [+w]);
  });
  return [...groups].map(([k, ws]) => `${k}.${ws.join('.')}`).join('_');
}

/**
 * `excludeRecordId`: the session being edited. Only sessions before it count,
 * so reopening an old session shows the book as it stood that day and the
 * session never feeds its own marks back in as "earlier" ones.
 */
export function buildMushafBook(
  student: Student,
  allRecords: SessionRecord[],
  excludeRecordId?: string,
): MushafBook {
  let recs = recordsForStudent(student, allRecords).filter((r) => !r.attendance_only);
  if (excludeRecordId) {
    const editing = allRecords.find((r) => r.id === excludeRecordId);
    recs = recs.filter((r) => r.id !== excludeRecordId && (!editing || byNewest(r, editing) > 0));
  }
  const state = new Map<string, 'r' | 'g'>();
  [...recs]
    .sort((a, b) => byNewest(b, a))
    .forEach((r) => {
      [r.loh?.mushaf, r.madi?.mushaf].forEach((m) => {
        if (!m) return;
        decodeShortMarks(m.ok).forEach((id) => {
          if (state.get(id) === 'r') state.set(id, 'g');
        });
        decodeShortMarks(m.rk).forEach((id) => state.set(id, 'r'));
      });
    });
  const red: string[] = [];
  const green: string[] = [];
  state.forEach((v, id) => (v === 'r' ? red : green).push(id));
  return { red: encodeShortMarks(red), green: encodeShortMarks(green) };
}

const TOKEN = /^[A-Za-z0-9_-]{8,200}$/;

/** Read-only link to the book, beside the app (`../mushaf/`), or null when there
 *  is nothing to show. With the parent token the link is short and permanent:
 *  the viewer reads the book from publicStats itself, so it always shows the
 *  latest state. Without one (preview) the words ride in the link. The published
 *  values are data: anything not in the short format is refused. */
export function mushafBookLink(
  book: MushafBook | undefined | null,
  name: string,
  pageHref: string,
  token?: string,
): string | null {
  if (!book) return null;
  const red = book.red || '';
  const green = book.green || '';
  if (!red && !green) return null;
  if ((red && !SHORT.test(red)) || (green && !SHORT.test(green))) return null;
  let base: URL;
  try {
    base = new URL('../mushaf/', pageHref);
  } catch {
    return null;
  }
  if (token && TOKEN.test(token)) return `${base.href}?b=1&t=${token}`;
  const q = ['b=1'];
  if (red) q.push(`e=${red}`);
  if (green) q.push(`g=${green}`);
  if (name) q.push(`n=${encodeURIComponent(name)}`);
  return `${base.href}?${q.join('&')}`;
}
