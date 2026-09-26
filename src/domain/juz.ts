import { globalAyahIndex, TOTAL_AYAT } from './pages';
import { arabicPlural } from './text';

/**
 * The thirty ajzaa of the mushaf, as the global 1..6236 ayah ordinal each one
 * opens on.
 *
 * **Source and verification.** The boundaries are the Hafs ones, taken from
 * `quran-meta` (npm, `HafsLists.JuzList`) and checked against the classical
 * (sura, ayah) table independently — all thirty agree. As a third check the
 * same package's 604-page table was compared against this repo's own
 * `PAGE_FIRST_AYAH`: zero differences across all 604 pages, which means the
 * ordinal space both tables are expressed in is the same one.
 *
 * Deliberately NOT derived from the page table. Twenty-six ajzaa do start on a
 * page boundary (juz ١ runs 21 pages, the rest 20 each), but four — ٤, ٧, ١١
 * and ٢٦ — open mid-page, so page arithmetic would misplace anyone sitting on
 * those few ayat.
 */
export const JUZ_FIRST_AYAH: ReadonlyArray<number> = [
  1, 149, 260, 386, 517, 641, 751, 900, 1042, 1201, 1328, 1479, 1649, 1803, 2030, 2215, 2484, 2674,
  2876, 3215, 3386, 3564, 3733, 4090, 4265, 4511, 4706, 5105, 5242, 5673,
];

export const TOTAL_JUZ = 30;

/**
 * The name each juz is called by, which is how the halaqa actually speaks:
 * "جزء عمّ", "تبارك", not "الجزء الثلاثون".
 *
 * These are the traditional opening-word names. A handful of them (٤، ٧، ١١،
 * ٢٠، ٢١، ٢٣) come from an older division and name an ayah a little before the
 * Hafs boundary above, so a name is a label for the juz, never a way to
 * recompute where it starts.
 */
export const JUZ_NAMES: ReadonlyArray<string> = [
  'الم',
  'سيقول السفهاء',
  'تلك الرسل',
  'لن تنالوا',
  'والمحصنات',
  'لا يحب الله',
  'وإذا سمعوا',
  'ولو أننا',
  'قال الملأ',
  'واعلموا',
  'يعتذرون',
  'وما من دابة',
  'وما أبرئ',
  'ربما',
  'سبحان الذي',
  'قال ألم',
  'اقترب للناس',
  'قد أفلح',
  'وقال الذين',
  'أمّن خلق',
  'اتل ما أوحي',
  'ومن يقنت',
  'وما لي',
  'فمن أظلم',
  'إليه يرد',
  'حم',
  'قال فما خطبكم',
  'قد سمع الله',
  'تبارك',
  'عمّ',
];

/** The familiar name of a juz, or '' when the number is out of range. */
export function juzName(juz: number): string {
  return juz >= 1 && juz <= TOTAL_JUZ ? JUZ_NAMES[juz - 1] : '';
}

/** 1..30 for a global ayah ordinal, or 0 when it falls outside the mushaf. */
export function juzOfGlobalAyah(g: number): number {
  if (!Number.isFinite(g) || g < 1 || g > TOTAL_AYAT) return 0;
  // Thirty entries — a linear walk from the back is quicker to read than a
  // binary search and costs nothing at this size.
  for (let i = TOTAL_JUZ - 1; i >= 0; i--) {
    if (g >= JUZ_FIRST_AYAH[i]) return i + 1;
  }
  return 0;
}

/** 1..30 for a (sura, ayah) pair, or 0 when the sura is out of range. */
export function juzOfAyah(sura: number, ayah: number): number {
  return juzOfGlobalAyah(globalAyahIndex(sura, ayah));
}

/** جزء واحد / جزءين / ٣ أجزاء / ١٢ جزءاً */
export function juzLabel(n: number): string {
  return arabicPlural(n, { one: 'جزء واحد', two: 'جزءين', few: 'أجزاء', many: 'جزءاً' });
}
