import type { SuraAssignment } from '../types';

/**
 * The 114 suras in Quran order, [name, ayahCount]. Ported verbatim from the
 * live index.html's `SURAS` constant — same names, same order, same counts.
 */
export const SURAS: ReadonlyArray<readonly [string, number]> = [
  ['الفاتحة', 7],
  ['البقرة', 286],
  ['آل عمران', 200],
  ['النساء', 176],
  ['المائدة', 120],
  ['الأنعام', 165],
  ['الأعراف', 206],
  ['الأنفال', 75],
  ['التوبة', 129],
  ['يونس', 109],
  ['هود', 123],
  ['يوسف', 111],
  ['الرعد', 43],
  ['إبراهيم', 52],
  ['الحجر', 99],
  ['النحل', 128],
  ['الإسراء', 111],
  ['الكهف', 110],
  ['مريم', 98],
  ['طه', 135],
  ['الأنبياء', 112],
  ['الحج', 78],
  ['المؤمنون', 118],
  ['النور', 64],
  ['الفرقان', 77],
  ['الشعراء', 227],
  ['النمل', 93],
  ['القصص', 88],
  ['العنكبوت', 69],
  ['الروم', 60],
  ['لقمان', 34],
  ['السجدة', 30],
  ['الأحزاب', 73],
  ['سبأ', 54],
  ['فاطر', 45],
  ['يس', 83],
  ['الصافات', 182],
  ['ص', 88],
  ['الزمر', 75],
  ['غافر', 85],
  ['فصلت', 54],
  ['الشورى', 53],
  ['الزخرف', 89],
  ['الدخان', 59],
  ['الجاثية', 37],
  ['الأحقاف', 35],
  ['محمد', 38],
  ['الفتح', 29],
  ['الحجرات', 18],
  ['ق', 45],
  ['الذاريات', 60],
  ['الطور', 49],
  ['النجم', 62],
  ['القمر', 55],
  ['الرحمن', 78],
  ['الواقعة', 96],
  ['الحديد', 29],
  ['المجادلة', 22],
  ['الحشر', 24],
  ['الممتحنة', 13],
  ['الصف', 14],
  ['الجمعة', 11],
  ['المنافقون', 11],
  ['التغابن', 18],
  ['الطلاق', 12],
  ['التحريم', 12],
  ['الملك', 30],
  ['القلم', 52],
  ['الحاقة', 52],
  ['المعارج', 44],
  ['نوح', 28],
  ['الجن', 28],
  ['المزمل', 20],
  ['المدثر', 56],
  ['القيامة', 40],
  ['الإنسان', 31],
  ['المرسلات', 50],
  ['النبأ', 40],
  ['النازعات', 46],
  ['عبس', 42],
  ['التكوير', 29],
  ['الانفطار', 19],
  ['المطففين', 36],
  ['الانشقاق', 25],
  ['البروج', 22],
  ['الطارق', 17],
  ['الأعلى', 19],
  ['الغاشية', 26],
  ['الفجر', 30],
  ['البلد', 20],
  ['الشمس', 15],
  ['الليل', 21],
  ['الضحى', 11],
  ['الشرح', 8],
  ['التين', 8],
  ['العلق', 19],
  ['القدر', 5],
  ['البينة', 8],
  ['الزلزلة', 8],
  ['العاديات', 11],
  ['القارعة', 11],
  ['التكاثر', 8],
  ['العصر', 3],
  ['الهمزة', 9],
  ['الفيل', 5],
  ['قريش', 4],
  ['الماعون', 7],
  ['الكوثر', 3],
  ['الكافرون', 6],
  ['النصر', 3],
  ['المسد', 5],
  ['الإخلاص', 4],
  ['الفلق', 5],
  ['الناس', 6]
];

/** Exact-match lookup by normalized sura name (whitespace-collapsed), used
 * when a parent/admin types a sura name instead of picking from a dropdown. */
export function findSuraByName(typed: string): readonly [string, number] | undefined {
  const normalized = typed.trim().replace(/\s+/g, ' ');
  return SURAS.find(([n]) => n.replace(/\s+/g, ' ') === normalized);
}

/** '(3–10)' / '(من 3)' / '' — ayah-range suffix for display. */
export function ayahRange(from?: string | number, to?: string | number): string {
  if (from && to) return ' (' + from + '–' + to + ')';
  if (from) return ' (من ' + from + ')';
  return '';
}

/** Joins multiple sura entries Arabic-style: "الناس والفلق" / "الناس، الفلق، والإخلاص". */
export function joinSuraNames(list: SuraAssignment[]): string {
  const parts = list.map((m) => m.sura + ayahRange(m.from, m.to));
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
