import type { SuraAssignment } from '../types';
import { SURAS } from './suras';

/**
 * Predicts the NEXT assignment from a student's most recent one, mirroring the
 * live index.html's computeNextLoh/computeNextMadi. Pure logic — the record
 * screen calls this to pre-fill editable suggestions when a student is picked.
 *
 * Memorization orders:
 *  - loh: الفاتحة first, then backwards from الناس (114) down to البقرة (2).
 *  - madi: normal ascending mushaf order (1 → 114).
 *
 * The suggestion always leaves "to" (إلى) blank for the teacher to fill.
 */

const NAMES = SURAS.map((s) => s.name);
const COUNT = new Map(SURAS.map((s) => [s.name, s.count]));

/** loh order: [الفاتحة, الناس, الفلق, ..., البقرة]. */
const LOH_ORDER = [NAMES[0], ...NAMES.slice(1).reverse()];
const LOH_INDEX = new Map(LOH_ORDER.map((n, i) => [n, i]));

/** Mushaf index of a sura by name (−1 if unknown). */
function suraIdx(name: string): number {
  return NAMES.indexOf(name);
}

/** The sura an item ends on: a whole-sura range ends at `toSura`, otherwise the
 * item's own `sura`. */
function itemEndSura(it: SuraAssignment): string | null {
  if (it.range && it.toSura) return it.toSura;
  return it.sura || null;
}

/** An ordinary (non-range) item whose "إلى" stops before the sura's last ayah —
 * i.e. the student still has more of that same sura left to memorize. */
function itemIsPartial(it: SuraAssignment): boolean {
  if (!it || it.range || !it.sura) return false;
  const c = COUNT.get(it.sura);
  const t = parseInt(String(it.to));
  return !!(it.to && c && t < c);
}

/** Items that name a real sura (or are a valid whole-sura range). */
function validItems(items: SuraAssignment[] | undefined): SuraAssignment[] {
  return (items ?? []).filter((x) => x?.sura && (COUNT.has(x.sura) || x.range));
}

/**
 * Next loh assignment following the loh memorization order.
 * - if the frontier item is partial → continue the SAME sura from the next ayah;
 * - else → the next sura in loh order, from ayah 1.
 * Returns null when there's nothing sensible to suggest.
 */
export function computeNextLoh(items: SuraAssignment[] | undefined): SuraAssignment | null {
  const valid = validItems(items);
  if (!valid.length) return null;

  // frontier = the item furthest along the loh order.
  let frontier = valid[0];
  valid.forEach((it) => {
    const a = LOH_INDEX.get(itemEndSura(it) ?? '');
    const b = LOH_INDEX.get(itemEndSura(frontier) ?? '');
    if (a != null && (b == null || a > b)) frontier = it;
  });

  if (itemIsPartial(frontier)) {
    return { sura: frontier.sura, from: String(parseInt(String(frontier.to)) + 1), to: '' };
  }
  const oi = LOH_INDEX.get(itemEndSura(frontier) ?? '');
  const next = oi != null && oi + 1 < LOH_ORDER.length ? LOH_ORDER[oi + 1] : null;
  return next ? { sura: next, from: '1', to: '' } : null;
}

/**
 * Next madi assignment.
 * - a whole-sura range sets the direction (as entered) and continues past it;
 * - a partial item → continue the SAME sura from the next ayah;
 * - else → the next sura in ascending mushaf order, from ayah 1.
 */
export function computeNextMadi(items: SuraAssignment[] | undefined): SuraAssignment | null {
  const valid = validItems(items);
  if (!valid.length) return null;

  // A range dictates direction: continue one sura past its end, in its direction.
  const rangeItem = [...valid].reverse().find((x) => x.range && x.toSura);
  if (rangeItem && rangeItem.toSura) {
    const si = suraIdx(rangeItem.sura);
    const ei = suraIdx(rangeItem.toSura);
    const dir = ei >= si ? 1 : -1;
    const ni = ei + dir;
    const next = ni >= 0 && ni < NAMES.length ? NAMES[ni] : null;
    return next ? { sura: next, from: '1', to: '' } : null;
  }

  // frontier = furthest-along item in ascending mushaf order.
  let frontier = valid[0];
  valid.forEach((it) => {
    if (suraIdx(it.sura) > suraIdx(frontier.sura)) frontier = it;
  });
  if (itemIsPartial(frontier)) {
    return { sura: frontier.sura, from: String(parseInt(String(frontier.to)) + 1), to: '' };
  }
  const idx = suraIdx(frontier.sura);
  const next = idx + 1 < NAMES.length ? NAMES[idx + 1] : null;
  return next ? { sura: next, from: '1', to: '' } : null;
}
