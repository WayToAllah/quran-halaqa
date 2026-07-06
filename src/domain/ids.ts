// Ported verbatim from the live index.html (fbKey / genId / recTime).
// Pure — no DOM, no Firebase.

/** Firebase RTDB keys can't contain . # $ [ ] / — sanitize before using as a key. */
export function fbKey(id: string | number): string {
  return String(id).replace(/[.#$[\]/]/g, '_');
}

export function genId(prefix: string): string {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/** Sortable creation time embedded in the record id
 * (r_<ms>_.. for real sessions, r_YYYYMMDD_.. for attendance-only entries). */
export function recTime(r: { id?: string } | null | undefined): number {
  const m = String(r?.id).match(/^r_(\d+)/);
  return m ? Number(m[1]) : 0;
}
