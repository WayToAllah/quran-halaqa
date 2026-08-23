import { SURAS } from './suras';
import type { SuraAssignment } from '../types';
import { arabicPlural } from './text';

/**
 * Madinah-Mushaf page table: the FIRST ayah of each of the 604 pages, encoded
 * as "suraNumber:ayah,ayah,...;suraNumber:..." in page order.
 *
 * Ported verbatim from the mushaf viewer (`/mushaf/index.html`), where it was
 * built from the zonetecde/mushaf-layout dataset and verified against all
 * 6,236 ayat. No page in this mushaf splits an ayah across two pages, so the
 * first ayah of each page is enough to reconstruct every page boundary.
 */
const PAGE_STARTS_ENC =
  '1:1;2:1,6,17,25,30,38,49,58,62,70,77,84,89,94,102,106,113,120,127,135,142,146,154,164,170,177,182,187,191,197,203,211,216,220,225,231,234,238,246,249,253,257,260,265,270,275,282,283;3:1,10,16,23,30,38,46,53,62,71,78,84,92,101,109,116,122,133,141,149,154,158,166,174,181,187,195;4:1,7,12,15,20,24,27,34,38,45,52,60,66,75,80,87,92,95,102,106,114,122,128,135,141,148,155,163,171,176;5:3,6,10,14,18,24,32,37,42,46,51,58,65,71,77,83,90,96,104,109,114;6:1,9,19,28,36,45,53,60,69,74,82,91,95,102,111,119,125,132,138,143,147,152,158;7:1,12,23,31,38,44,52,58,68,74,82,88,96,105,121,131,138,144,150,156,160,164,171,179,188,196;8:1,9,17,26,34,41,46,53,62,70;9:1,7,14,21,27,32,37,41,48,55,62,69,73,80,87,94,100,107,112,118,123;10:1,7,15,21,26,34,43,54,62,71,79,89,98,107;11:6,13,20,29,38,46,54,63,72,82,89,98,109,118;12:5,15,23,31,38,44,53,64,70,79,87,96,104;13:1,6,14,19,29,35,43;14:6,11,19,25,34,43;15:1,16,32,52,71,91;16:7,15,27,35,43,55,65,73,80,88,94,103,111,119;17:1,8,18,28,39,50,59,67,76,87,97,105;18:5,16,21,28,35,46,54,62,75,84,98;19:1,12,26,39,52,65,77,96;20:13,38,52,65,77,88,99,114,126;21:1,11,25,36,45,58,73,82,91,102;22:1,6,16,24,31,39,47,56,65,73;23:1,18,28,43,60,75,90,105;24:1,11,21,28,32,37,44,54,59,62;25:3,12,21,33,44,56,68;26:1,20,40,61,84,112,137,160,184,207;27:1,14,23,36,45,56,64,77,89;28:6,14,22,29,36,44,51,60,71,78,85;29:7,15,24,31,39,46,53,64;30:6,16,25,33,42,51;31:1,12,20,29;32:1,12,21;33:1,7,16,23,31,36,44,51,55,63;34:1,8,15,23,32,40,49;35:4,12,19,31,39,45;36:13,28,41,55,71;37:1,25,52,77,103,127,154;38:1,17,27,43,62,84;39:6,11,22,32,41,48,57,68,75;40:8,17,26,34,41,50,59,67,78;41:1,12,21,30,39,47;42:1,11,16,23,32,45,52;43:11,23,34,48,61,74;44:1,19,40;45:1,14,23,33;46:6,15,21,29;47:1,12,20,30;48:1,10,16,24,29;49:5,12;50:1,16,36;51:7,31,52;52:15,32;53:1,27,45;54:7,28,50;55:17,41,68;56:17,51,77;57:4,12,19,25;58:1,7,12,22;59:4,10,17;60:1,6,12;61:6;62:1,9;63:5;64:1,10;65:1,6;66:1,8;67:1,13,27;68:16,43;69:9,35;70:11,40;71:11;72:1,14;73:1,20;74:18,48;75:20;76:6,26;77:20;78:1,31;79:16;80:1;81:1;82:1;83:7,35;85:1;86:1;87:16;89:1,24;91:1;92:15;95:1;97:1;98:8;100:10;103:1;106:1;109:1;112:1';

export const TOTAL_PAGES = 604;

/** Running ayah offset before each sura: OFFSET[n] = ayat in suras 1..n-1.
 * Lets any (sura, ayah) collapse to a single 1..6236 ordinal, which makes
 * "does this page's whole ayah span sit inside what the student memorized?"
 * a plain integer range check instead of cross-sura bookkeeping. */
const SURA_OFFSET: number[] = (() => {
  const out = [0];
  let sum = 0;
  for (const s of SURAS) {
    sum += s.count;
    out.push(sum);
  }
  return out;
})();

/** Total ayat in the Quran (6236) — the last offset entry. */
export const TOTAL_AYAT = SURA_OFFSET[SURAS.length];

/** 1-based global ordinal for an ayah, or 0 when the sura number is out of
 * range. Ayah numbers are clamped into the sura so a typo'd "to" (e.g. البقرة
 * 1–400) can never leak past the sura's real end. */
export function globalAyahIndex(sura: number, ayah: number): number {
  if (!Number.isInteger(sura) || sura < 1 || sura > SURAS.length) return 0;
  const max = SURAS[sura - 1].count;
  const a = Math.min(Math.max(ayah || 1, 1), max);
  return SURA_OFFSET[sura - 1] + a;
}

/** Global ordinal of the first ayah on each page, ascending; index 0 = page 1. */
export const PAGE_FIRST_AYAH: ReadonlyArray<number> = (() => {
  const out: number[] = [];
  for (const seg of PAGE_STARTS_ENC.split(';')) {
    const [s, list] = seg.split(':');
    const sura = Number(s);
    for (const a of list.split(',')) out.push(globalAyahIndex(sura, Number(a)));
  }
  return out;
})();

/** Global ordinal of the LAST ayah on each page (the ayah before the next
 * page starts; the final page runs to the end of the Quran). */
export const PAGE_LAST_AYAH: ReadonlyArray<number> = PAGE_FIRST_AYAH.map((_, i) =>
  i + 1 < PAGE_FIRST_AYAH.length ? PAGE_FIRST_AYAH[i + 1] - 1 : TOTAL_AYAT,
);

/** 1-based page number holding a global ayah ordinal. */
export function pageOfGlobalAyah(g: number): number {
  let lo = 0;
  let hi = PAGE_FIRST_AYAH.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (PAGE_FIRST_AYAH[mid] <= g) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans + 1;
}

/** 1-based page number for (sura number, ayah). 0 for an unknown sura. */
export function pageOfAyah(sura: number, ayah: number): number {
  const g = globalAyahIndex(sura, ayah);
  return g ? pageOfGlobalAyah(g) : 0;
}

/**
 * The inclusive global-ayah span an assignment covers, mirroring `itemAyat`'s
 * reading of the same shapes so a page count and an ayah count can never
 * disagree about what was assigned:
 *  - whole-sura range ({sura, toSura, range:true}) → first ayah of the earlier
 *    sura through the last ayah of the later one (order-agnostic);
 *  - a valid from/to → that inclusive range, clamped to the sura;
 *  - anything else (bare sura, half-entered range) → the whole sura.
 * Returns null when the sura is missing or unknown.
 */
export function assignmentAyahSpan(
  item: SuraAssignment | undefined | null,
): [number, number] | null {
  if (!item?.sura) return null;
  const suraIdx = SURAS.findIndex((s) => s.name === item.sura);
  if (suraIdx < 0) return null;
  const sura = suraIdx + 1;

  if (item.range && item.toSura) {
    const otherIdx = SURAS.findIndex((s) => s.name === item.toSura);
    if (otherIdx < 0) return null;
    const [lo, hi] = suraIdx <= otherIdx ? [suraIdx, otherIdx] : [otherIdx, suraIdx];
    return [globalAyahIndex(lo + 1, 1), globalAyahIndex(hi + 1, SURAS[hi].count)];
  }

  const f = parseInt(String(item.from ?? ''), 10);
  const t = parseInt(String(item.to ?? ''), 10);
  if (f > 0 && t > 0 && t >= f) return [globalAyahIndex(sura, f), globalAyahIndex(sura, t)];
  return [globalAyahIndex(sura, 1), globalAyahIndex(sura, SURAS[suraIdx].count)];
}

/** One assignment tied to the session it was given in. */
export interface DatedAssignment {
  item: SuraAssignment;
  /** ISO date of the session that assigned it. */
  date: string;
}

export interface CompletedPage {
  /** 1-based Madinah-Mushaf page number. */
  page: number;
  /** ISO date of the session that FINISHED the page (the latest of the
   * first-coverage dates of its ayat). */
  date: string;
}

/**
 * Pages the student has fully memorized, each with the date it was completed.
 *
 * A page only counts once it is finished end-to-end — a third of a page is
 * worth nothing here, which is the whole point: the number answers "how much
 * of the mushaf does he actually hold?" rather than "how much work did he get
 * handed?". Pages are inherently distinct: overlapping or repeated
 * assignments cover the same ayat again and cannot inflate the total.
 *
 * The completion date is the LATEST of the per-ayah first-coverage dates, so a
 * page started in one month and finished in the next belongs to the month it
 * was finished in — the only reading under which the monthly totals sum to the
 * all-time total without double counting.
 */
export function completedPages(assignments: DatedAssignment[]): CompletedPage[] {
  // Earliest date each ayah was covered. First coverage is what matters: a
  // later re-assignment of the same ayat is revision, not new ground.
  const firstSeen = new Map<number, string>();
  const touchedPages = new Set<number>();

  for (const { item, date } of assignments) {
    const span = assignmentAyahSpan(item);
    if (!span || !date) continue;
    const [from, to] = span;
    for (let g = from; g <= to; g++) {
      const prev = firstSeen.get(g);
      if (prev === undefined || date < prev) firstSeen.set(g, date);
    }
    touchedPages.add(pageOfGlobalAyah(from));
    touchedPages.add(pageOfGlobalAyah(to));
    // A long span crosses pages between its ends; walking page starts is
    // cheaper than a per-ayah page lookup across a whole sura.
    for (let p = pageOfGlobalAyah(from) + 1; p < pageOfGlobalAyah(to); p++) touchedPages.add(p);
  }

  const out: CompletedPage[] = [];
  for (const page of touchedPages) {
    const start = PAGE_FIRST_AYAH[page - 1];
    const end = PAGE_LAST_AYAH[page - 1];
    let completedOn = '';
    let whole = true;
    for (let g = start; g <= end; g++) {
      const d = firstSeen.get(g);
      if (d === undefined) {
        whole = false;
        break;
      }
      if (d > completedOn) completedOn = d;
    }
    if (whole) out.push({ page, date: completedOn });
  }
  return out.sort((a, b) => a.page - b.page);
}

/** "صفحة واحدة" / "صفحتين" / "٥ صفحات" / "١٢ صفحة". */
export function pagesLabel(n: number): string {
  return arabicPlural(n, {
    one: 'صفحة واحدة',
    two: 'صفحتين',
    few: 'صفحات',
    many: 'صفحة',
  });
}

/**
 * Suras in the order this halaqa memorizes them: الفاتحة first, then
 * descending from الناس (114) down to البقرة (2). Mirrors LOH_ORDER in
 * nextTask.ts — the order the teacher actually assigns in.
 */
const LOH_SURA_ORDER: ReadonlyArray<number> = [
  1,
  ...Array.from({ length: 113 }, (_, i) => 114 - i),
];

/** Global ayah ordinal at each 1-based position along the memorization path. */
const LOH_PATH: ReadonlyArray<number> = (() => {
  const out: number[] = [];
  for (const sura of LOH_SURA_ORDER) {
    for (let a = 1; a <= SURAS[sura - 1].count; a++) out.push(globalAyahIndex(sura, a));
  }
  return out;
})();

/** Reverse of LOH_PATH: global ayah ordinal → 1-based path position. */
const LOH_POSITION_BY_GLOBAL: ReadonlyArray<number> = (() => {
  const out = new Array<number>(TOTAL_AYAT + 1).fill(0);
  LOH_PATH.forEach((g, i) => {
    out[g] = i + 1;
  });
  return out;
})();

/**
 * Which way a student walks the mushaf.
 *
 * 'descending' is this halaqa's default — الفاتحة, then الناس (114) down to
 * البقرة, memorizing the short suras first. 'ascending' is plain mushaf order,
 * used by the students who start at البقرة and work forwards. Both are real
 * and a page count that assumes one silently reports zero for the other.
 */
export type MemorizationDirection = 'descending' | 'ascending';

/** Position along the chosen path, 1..6236. For 'ascending' this is simply the
 * global mushaf ordinal; for 'descending' it is the loh-order ordinal. */
export function pathPositionOf(
  sura: number,
  ayah: number,
  direction: MemorizationDirection,
): number {
  return direction === 'ascending' ? globalAyahIndex(sura, ayah) : lohPositionOf(sura, ayah);
}

/** Path position for a global ayah ordinal, in the given direction. */
export function pathPositionOfGlobal(g: number, direction: MemorizationDirection): number {
  if (g < 1 || g > TOTAL_AYAT) return 0;
  return direction === 'ascending' ? g : LOH_POSITION_BY_GLOBAL[g];
}

/** The global ayah ordinal at a path position, in the given direction. */
function globalAtPathPosition(pos: number, direction: MemorizationDirection): number {
  if (pos < 1 || pos > TOTAL_AYAT) return 0;
  return direction === 'ascending' ? pos : LOH_PATH[pos - 1];
}

/** Pages lying entirely within a span of the chosen path. See pagesInLohSpan
 * for why endpoints, not individual assignments, define the span. */
export function pagesInPathSpan(
  startPos: number,
  endPos: number,
  direction: MemorizationDirection,
): number[] {
  if (!startPos || !endPos || endPos < startPos) return [];
  const covered = new Set<number>();
  for (let p = startPos; p <= endPos; p++) covered.add(globalAtPathPosition(p, direction));

  const touched = new Set<number>();
  for (const g of covered) touched.add(pageOfGlobalAyah(g));

  const out: number[] = [];
  for (const page of touched) {
    let whole = true;
    for (let g = PAGE_FIRST_AYAH[page - 1]; g <= PAGE_LAST_AYAH[page - 1]; g++) {
      if (!covered.has(g)) {
        whole = false;
        break;
      }
    }
    if (whole) out.push(page);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Where an ayah sits along the memorization path, 1..6236.
 *
 * This is the coordinate the halaqa actually progresses along. Global mushaf
 * ordinals run the other way for everything after الفاتحة, so a student moving
 * "forward" is moving *down* in sura number — comparing raw global ordinals
 * would read that as going backwards.
 */
export function lohPositionOf(sura: number, ayah: number): number {
  const g = globalAyahIndex(sura, ayah);
  return g ? LOH_POSITION_BY_GLOBAL[g] : 0;
}

/** Path position for a global ayah ordinal, or 0 if out of range. */
export function lohPositionOfGlobal(g: number): number {
  return g >= 1 && g <= TOTAL_AYAT ? LOH_POSITION_BY_GLOBAL[g] : 0;
}

/** Split a global ayah ordinal back into (sura number, ayah). */
export function globalAyahToSuraAyah(g: number): { sura: number; ayah: number } | null {
  if (g < 1 || g > TOTAL_AYAT) return null;
  for (let s = SURAS.length; s >= 1; s--) {
    const start = globalAyahIndex(s, 1);
    if (g >= start) return { sura: s, ayah: g - start + 1 };
  }
  return null;
}

/** The (sura number, ayah) at a path position — inverse of lohPositionOf. */
export function ayahAtLohPosition(pos: number): { sura: number; ayah: number } | null {
  if (pos < 1 || pos > LOH_PATH.length) return null;
  const g = LOH_PATH[pos - 1];
  for (let s = SURAS.length; s >= 1; s--) {
    const start = globalAyahIndex(s, 1);
    if (g >= start) return { sura: s, ayah: g - start + 1 };
  }
  return null;
}

/**
 * Pages lying entirely within a span of the memorization path.
 *
 * Unlike completedPages(), this asks "how far along the path has the student
 * travelled?" rather than "which ayat were individually written down?". A week
 * whose session went unrecorded, an assignment marked إعادة, or a mistyped
 * sura name cannot punch a hole in the middle of a journey the student
 * actually made — the endpoints are what is known reliably.
 *
 * Returns an empty list when the end point precedes the start point, which
 * means the recorded endpoints disagree with the memorization order.
 */
export function pagesInLohSpan(startPos: number, endPos: number): number[] {
  return pagesInPathSpan(startPos, endPos, 'descending');
}
