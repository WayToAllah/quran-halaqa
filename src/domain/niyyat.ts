/**
 * Niyyat (نوايا) — the admin-editable intentions that rotate in the app header.
 *
 * Pure logic only (no Firebase, no Preact): normalization + the default-verse
 * fallback. The rotation timing lives in the NiyyahBar component; storage lives
 * in niyyat.repo.ts. Keeping this layer pure is what lets it be unit-tested
 * without mounting anything.
 */

/** Shown when the teacher hasn't added any niyyat yet. A Qur'anic verse
 * (Yunus 10:58) — public domain, safe to embed. */
export const DEFAULT_NIYYAH = 'قُلْ بِفَضْلِ اللَّهِ وَبِرَحْمَتِهِ فَبِذَٰلِكَ فَلْيَفْرَحُوا';

/** Trims, drops blanks, and de-duplicates a raw niyyat list (e.g. straight from
 * a textarea or Firestore) while preserving the author's order. */
export function cleanNiyyat(list: readonly string[] | undefined | null): string[] {
  if (!list) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = (raw ?? '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** The list actually shown in the header: the cleaned niyyat, or a single
 * default verse when the teacher hasn't added any. Never returns an empty
 * array, so the bar always has something to display. */
export function displayNiyyat(list: readonly string[] | undefined | null): string[] {
  const cleaned = cleanNiyyat(list);
  return cleaned.length ? cleaned : [DEFAULT_NIYYAH];
}

/** Parses a textarea value (one niyyah per line) into a clean list. */
export function parseNiyyatText(text: string): string[] {
  return cleanNiyyat(text.split('\n'));
}

/** Serializes a niyyat list back to textarea text (one per line). */
export function niyyatToText(list: readonly string[]): string {
  return list.join('\n');
}
