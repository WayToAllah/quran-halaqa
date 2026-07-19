/**
 * Sanitize an id into a Realtime Database key, byte-for-byte identical to the
 * production admin app (index.html):
 *
 *   function fbKey(id) { return String(id).replace(/[.#$[\]\/]/g, '_'); }
 *
 * RTDB keys may not contain '.', '#', '$', '[', ']' or '/', so each is
 * replaced with '_'. This MUST stay in exact lockstep with the old app, or a
 * reverse-restore would write records under keys the old app can't read.
 */
export function fbKey(id: string): string {
  return String(id).replace(/[.#$[\]/]/g, '_');
}
