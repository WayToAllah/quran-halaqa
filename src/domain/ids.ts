// Ported verbatim from the live index.html (fbKey / genId / recTime).
// Pure — no DOM, no Firebase.

/** Firebase RTDB keys can't contain . # $ [ ] / — sanitize before using as a key. */
export function fbKey(id: string | number): string {
  return String(id).replace(/[.#$[\]/]/g, '_');
}

export function genId(prefix: string): string {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/**
 * High-entropy token used in child.html?t={parentToken} links. Character set
 * deliberately excludes visually ambiguous characters (0/O, 1/l/I) so a
 * token read aloud or hand-copied from a screenshot doesn't get mistyped.
 */
export function genParentToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 20; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

/** Sortable creation time embedded in the record id
 * (r_<ms>_.. for real sessions, r_YYYYMMDD_.. for attendance-only entries). */
export function recTime(r: { id?: string } | null | undefined): number {
  const m = String(r?.id).match(/^r_(\d+)/);
  return m ? Number(m[1]) : 0;
}
