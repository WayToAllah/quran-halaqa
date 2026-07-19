import type { SuraAssignment } from '../types';

/** One sura's reference data: name, ayah count, and its Madinah-Mushaf page
 * range (pageStart..pageEnd, inclusive; equal when the sura fits on one page).
 * Page ranges ported verbatim from the live index.html SURAS constant, which
 * was itself built from the zonetecde/mushaf-layout dataset. */
export interface SuraInfo {
  readonly name: string;
  readonly count: number;
  readonly pageStart: number;
  readonly pageEnd: number;
}

/** The 114 suras in Quran order. */
export const SURAS: ReadonlyArray<SuraInfo> = [
  { name: 'الفاتحة', count: 7, pageStart: 1, pageEnd: 1 },
  { name: 'البقرة', count: 286, pageStart: 2, pageEnd: 49 },
  { name: 'آل عمران', count: 200, pageStart: 50, pageEnd: 76 },
  { name: 'النساء', count: 176, pageStart: 77, pageEnd: 105 },
  { name: 'المائدة', count: 120, pageStart: 106, pageEnd: 127 },
  { name: 'الأنعام', count: 165, pageStart: 128, pageEnd: 150 },
  { name: 'الأعراف', count: 206, pageStart: 151, pageEnd: 176 },
  { name: 'الأنفال', count: 75, pageStart: 177, pageEnd: 186 },
  { name: 'التوبة', count: 129, pageStart: 187, pageEnd: 207 },
  { name: 'يونس', count: 109, pageStart: 208, pageEnd: 220 },
  { name: 'هود', count: 123, pageStart: 221, pageEnd: 234 },
  { name: 'يوسف', count: 111, pageStart: 235, pageEnd: 248 },
  { name: 'الرعد', count: 43, pageStart: 249, pageEnd: 254 },
  { name: 'إبراهيم', count: 52, pageStart: 255, pageEnd: 261 },
  { name: 'الحجر', count: 99, pageStart: 262, pageEnd: 266 },
  { name: 'النحل', count: 128, pageStart: 267, pageEnd: 281 },
  { name: 'الإسراء', count: 111, pageStart: 282, pageEnd: 293 },
  { name: 'الكهف', count: 110, pageStart: 293, pageEnd: 304 },
  { name: 'مريم', count: 98, pageStart: 305, pageEnd: 311 },
  { name: 'طه', count: 135, pageStart: 312, pageEnd: 321 },
  { name: 'الأنبياء', count: 112, pageStart: 322, pageEnd: 331 },
  { name: 'الحج', count: 78, pageStart: 332, pageEnd: 341 },
  { name: 'المؤمنون', count: 118, pageStart: 342, pageEnd: 349 },
  { name: 'النور', count: 64, pageStart: 350, pageEnd: 359 },
  { name: 'الفرقان', count: 77, pageStart: 359, pageEnd: 366 },
  { name: 'الشعراء', count: 227, pageStart: 367, pageEnd: 376 },
  { name: 'النمل', count: 93, pageStart: 377, pageEnd: 385 },
  { name: 'القصص', count: 88, pageStart: 385, pageEnd: 396 },
  { name: 'العنكبوت', count: 69, pageStart: 396, pageEnd: 404 },
  { name: 'الروم', count: 60, pageStart: 404, pageEnd: 410 },
  { name: 'لقمان', count: 34, pageStart: 411, pageEnd: 414 },
  { name: 'السجدة', count: 30, pageStart: 415, pageEnd: 417 },
  { name: 'الأحزاب', count: 73, pageStart: 418, pageEnd: 427 },
  { name: 'سبأ', count: 54, pageStart: 428, pageEnd: 434 },
  { name: 'فاطر', count: 45, pageStart: 434, pageEnd: 440 },
  { name: 'يس', count: 83, pageStart: 440, pageEnd: 445 },
  { name: 'الصافات', count: 182, pageStart: 446, pageEnd: 452 },
  { name: 'ص', count: 88, pageStart: 453, pageEnd: 458 },
  { name: 'الزمر', count: 75, pageStart: 458, pageEnd: 467 },
  { name: 'غافر', count: 85, pageStart: 467, pageEnd: 476 },
  { name: 'فصلت', count: 54, pageStart: 477, pageEnd: 482 },
  { name: 'الشورى', count: 53, pageStart: 483, pageEnd: 488 },
  { name: 'الزخرف', count: 89, pageStart: 489, pageEnd: 495 },
  { name: 'الدخان', count: 59, pageStart: 496, pageEnd: 498 },
  { name: 'الجاثية', count: 37, pageStart: 499, pageEnd: 502 },
  { name: 'الأحقاف', count: 35, pageStart: 502, pageEnd: 507 },
  { name: 'محمد', count: 38, pageStart: 507, pageEnd: 510 },
  { name: 'الفتح', count: 29, pageStart: 511, pageEnd: 515 },
  { name: 'الحجرات', count: 18, pageStart: 515, pageEnd: 517 },
  { name: 'ق', count: 45, pageStart: 518, pageEnd: 520 },
  { name: 'الذاريات', count: 60, pageStart: 520, pageEnd: 523 },
  { name: 'الطور', count: 49, pageStart: 523, pageEnd: 526 },
  { name: 'النجم', count: 62, pageStart: 526, pageEnd: 528 },
  { name: 'القمر', count: 55, pageStart: 528, pageEnd: 531 },
  { name: 'الرحمن', count: 78, pageStart: 531, pageEnd: 534 },
  { name: 'الواقعة', count: 96, pageStart: 534, pageEnd: 537 },
  { name: 'الحديد', count: 29, pageStart: 537, pageEnd: 541 },
  { name: 'المجادلة', count: 22, pageStart: 542, pageEnd: 545 },
  { name: 'الحشر', count: 24, pageStart: 545, pageEnd: 549 },
  { name: 'الممتحنة', count: 13, pageStart: 549, pageEnd: 551 },
  { name: 'الصف', count: 14, pageStart: 551, pageEnd: 552 },
  { name: 'الجمعة', count: 11, pageStart: 553, pageEnd: 554 },
  { name: 'المنافقون', count: 11, pageStart: 554, pageEnd: 555 },
  { name: 'التغابن', count: 18, pageStart: 556, pageEnd: 557 },
  { name: 'الطلاق', count: 12, pageStart: 558, pageEnd: 559 },
  { name: 'التحريم', count: 12, pageStart: 560, pageEnd: 561 },
  { name: 'الملك', count: 30, pageStart: 562, pageEnd: 564 },
  { name: 'القلم', count: 52, pageStart: 564, pageEnd: 566 },
  { name: 'الحاقة', count: 52, pageStart: 566, pageEnd: 568 },
  { name: 'المعارج', count: 44, pageStart: 568, pageEnd: 570 },
  { name: 'نوح', count: 28, pageStart: 570, pageEnd: 571 },
  { name: 'الجن', count: 28, pageStart: 572, pageEnd: 573 },
  { name: 'المزمل', count: 20, pageStart: 574, pageEnd: 575 },
  { name: 'المدثر', count: 56, pageStart: 575, pageEnd: 577 },
  { name: 'القيامة', count: 40, pageStart: 577, pageEnd: 578 },
  { name: 'الإنسان', count: 31, pageStart: 578, pageEnd: 580 },
  { name: 'المرسلات', count: 50, pageStart: 580, pageEnd: 581 },
  { name: 'النبأ', count: 40, pageStart: 582, pageEnd: 583 },
  { name: 'النازعات', count: 46, pageStart: 583, pageEnd: 584 },
  { name: 'عبس', count: 42, pageStart: 585, pageEnd: 585 },
  { name: 'التكوير', count: 29, pageStart: 586, pageEnd: 586 },
  { name: 'الانفطار', count: 19, pageStart: 587, pageEnd: 587 },
  { name: 'المطففين', count: 36, pageStart: 587, pageEnd: 589 },
  { name: 'الانشقاق', count: 25, pageStart: 589, pageEnd: 590 },
  { name: 'البروج', count: 22, pageStart: 590, pageEnd: 591 },
  { name: 'الطارق', count: 17, pageStart: 591, pageEnd: 591 },
  { name: 'الأعلى', count: 19, pageStart: 591, pageEnd: 592 },
  { name: 'الغاشية', count: 26, pageStart: 592, pageEnd: 593 },
  { name: 'الفجر', count: 30, pageStart: 593, pageEnd: 594 },
  { name: 'البلد', count: 20, pageStart: 594, pageEnd: 595 },
  { name: 'الشمس', count: 15, pageStart: 595, pageEnd: 595 },
  { name: 'الليل', count: 21, pageStart: 595, pageEnd: 596 },
  { name: 'الضحى', count: 11, pageStart: 596, pageEnd: 596 },
  { name: 'الشرح', count: 8, pageStart: 596, pageEnd: 596 },
  { name: 'التين', count: 8, pageStart: 597, pageEnd: 597 },
  { name: 'العلق', count: 19, pageStart: 597, pageEnd: 597 },
  { name: 'القدر', count: 5, pageStart: 598, pageEnd: 598 },
  { name: 'البينة', count: 8, pageStart: 598, pageEnd: 598 },
  { name: 'الزلزلة', count: 8, pageStart: 599, pageEnd: 599 },
  { name: 'العاديات', count: 11, pageStart: 599, pageEnd: 599 },
  { name: 'القارعة', count: 11, pageStart: 600, pageEnd: 600 },
  { name: 'التكاثر', count: 8, pageStart: 600, pageEnd: 600 },
  { name: 'العصر', count: 3, pageStart: 601, pageEnd: 601 },
  { name: 'الهمزة', count: 9, pageStart: 601, pageEnd: 601 },
  { name: 'الفيل', count: 5, pageStart: 601, pageEnd: 601 },
  { name: 'قريش', count: 4, pageStart: 602, pageEnd: 602 },
  { name: 'الماعون', count: 7, pageStart: 602, pageEnd: 602 },
  { name: 'الكوثر', count: 3, pageStart: 602, pageEnd: 602 },
  { name: 'الكافرون', count: 6, pageStart: 603, pageEnd: 603 },
  { name: 'النصر', count: 3, pageStart: 603, pageEnd: 603 },
  { name: 'المسد', count: 5, pageStart: 603, pageEnd: 603 },
  { name: 'الإخلاص', count: 4, pageStart: 604, pageEnd: 604 },
  { name: 'الفلق', count: 5, pageStart: 604, pageEnd: 604 },
  { name: 'الناس', count: 6, pageStart: 604, pageEnd: 604 },
];

/** Fast name -> info lookup. */
const SURA_BY_NAME = new Map(SURAS.map((s) => [s.name, s]));

/** 1-based ordinal (position in the Mushaf) for a sura name, or 0 if unknown. */
export function suraNumber(name: string): number {
  const i = SURAS.findIndex((s) => s.name === name);
  return i < 0 ? 0 : i + 1;
}

/** Human page label: 'صفحة 2' or 'صفحات 2-49'. */
export function suraPageLabel(info: SuraInfo): string {
  return info.pageStart === info.pageEnd
    ? 'صفحة ' + info.pageStart
    : 'صفحات ' + info.pageStart + '-' + info.pageEnd;
}

/** Exact-match lookup by normalized sura name (whitespace-collapsed), used
 * when a parent/admin types a sura name instead of picking from a dropdown. */
export function findSuraByName(typed: string): SuraInfo | undefined {
  const normalized = typed.trim().replace(/\s+/g, ' ');
  const direct = SURA_BY_NAME.get(normalized);
  if (direct) return direct;
  return SURAS.find((s) => s.name.replace(/\s+/g, ' ') === normalized);
}

/** '(3–10)' / '(من 3)' / '' — ayah-range suffix for display. */
export function ayahRange(from?: string | number, to?: string | number): string {
  if (from && to) return ' (' + from + '–' + to + ')';
  if (from) return ' (من ' + from + ')';
  return '';
}

/** Display label for one assignment item. A whole-sura range renders as
 * "من X إلى Y" (matching production's compact form); an ordinary item renders
 * as its sura name plus any ayah range, e.g. "البقرة (1–10)". A range item
 * missing its `toSura` falls back to the plain sura name so a half-entered
 * range never shows a dangling "من … إلى". */
export function suraLabel(item: SuraAssignment): string {
  if (item.range && item.toSura) return 'من ' + item.sura + ' إلى ' + item.toSura;
  return item.sura + ayahRange(item.from, item.to);
}

/** Joins multiple sura entries Arabic-style: "الناس والفلق" / "الناس، الفلق، والإخلاص". */
export function joinSuraNames(list: SuraAssignment[]): string {
  const parts = list.map(suraLabel);
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join('، ') + ' و' + parts[parts.length - 1];
}

/** Number of ayat in a [from, to] range (inclusive). 0 for missing/invalid ranges. */
export function countAyat(from?: string | number, to?: string | number): number {
  const f = parseInt(String(from));
  const t = parseInt(String(to));
  if (!f || !t || t < f) return 0;
  return t - f + 1;
}
