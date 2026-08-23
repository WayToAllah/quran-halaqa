import { describe, it, expect } from 'vitest';
import { SURAS } from './suras';
import {
  TOTAL_PAGES,
  TOTAL_AYAT,
  lohPositionOf,
  pagesInLohSpan,
  pathPositionOf,
  pagesInPathSpan,
  PAGE_FIRST_AYAH,
  PAGE_LAST_AYAH,
  globalAyahIndex,
  pageOfAyah,
  pageOfGlobalAyah,
  assignmentAyahSpan,
  completedPages,
  pagesLabel,
} from './pages';

describe('page table integrity', () => {
  it('has exactly 604 pages', () => {
    expect(PAGE_FIRST_AYAH).toHaveLength(TOTAL_PAGES);
  });

  it('covers all 6236 ayat with no gaps or overlaps', () => {
    expect(TOTAL_AYAT).toBe(6236);
    expect(PAGE_FIRST_AYAH[0]).toBe(1);
    expect(PAGE_LAST_AYAH[TOTAL_PAGES - 1]).toBe(TOTAL_AYAT);
    for (let i = 1; i < TOTAL_PAGES; i++) {
      expect(PAGE_FIRST_AYAH[i]).toBe(PAGE_LAST_AYAH[i - 1] + 1);
    }
  });

  it('page starts are strictly ascending', () => {
    for (let i = 1; i < TOTAL_PAGES; i++) {
      expect(PAGE_FIRST_AYAH[i]).toBeGreaterThan(PAGE_FIRST_AYAH[i - 1]);
    }
  });

  it('every ayah of the Quran maps back to the page that contains it', () => {
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      expect(pageOfGlobalAyah(PAGE_FIRST_AYAH[p - 1])).toBe(p);
      expect(pageOfGlobalAyah(PAGE_LAST_AYAH[p - 1])).toBe(p);
    }
  });
});

describe('globalAyahIndex', () => {
  it('numbers ayat continuously across suras', () => {
    expect(globalAyahIndex(1, 1)).toBe(1);
    expect(globalAyahIndex(1, 7)).toBe(7);
    expect(globalAyahIndex(2, 1)).toBe(8);
    expect(globalAyahIndex(114, 6)).toBe(TOTAL_AYAT);
  });

  it('clamps an out-of-range ayah into its sura', () => {
    // البقرة has 286 ayat; a typo'd "to" must not leak into آل عمران.
    expect(globalAyahIndex(2, 400)).toBe(globalAyahIndex(2, 286));
    expect(globalAyahIndex(2, 0)).toBe(globalAyahIndex(2, 1));
  });

  it('returns 0 for an unknown sura number', () => {
    expect(globalAyahIndex(0, 1)).toBe(0);
    expect(globalAyahIndex(115, 1)).toBe(0);
  });
});

describe('pageOfAyah', () => {
  it('matches known mushaf landmarks', () => {
    expect(pageOfAyah(1, 1)).toBe(1); // الفاتحة
    expect(pageOfAyah(2, 1)).toBe(2); // بداية البقرة
    expect(pageOfAyah(2, 255)).toBe(42); // آية الكرسي
    expect(pageOfAyah(18, 1)).toBe(293); // بداية الكهف
    expect(pageOfAyah(36, 1)).toBe(440); // بداية يس
    expect(pageOfAyah(67, 1)).toBe(562); // بداية الملك
    expect(pageOfAyah(114, 6)).toBe(604); // آخر آية في المصحف
  });
});

describe('agreement with the SURAS table', () => {
  it("every sura's first ayah lands on its recorded pageStart", () => {
    // Two independently-sourced tables (SURAS' per-sura page ranges vs the
    // ported per-page ayah starts). All 114 sura starts agreeing is the check
    // that the port isn't shifted by a page anywhere.
    SURAS.forEach((s, i) => {
      expect([s.name, pageOfAyah(i + 1, 1)]).toEqual([s.name, s.pageStart]);
    });
  });

  it("SURAS' pageEnd disagrees on exactly the 16 known suras, and nowhere else", () => {
    // SURAS.pageEnd is display-only ("صفحات 2-49") and is off by one page for
    // 16 suras — it rounds to the page a sura visually ends near, while this
    // table says which page its LAST AYAH actually sits on (e.g. النساء 176 is
    // the first line of page 106, not the end of 105). The page table is the
    // one verified ayah-by-ayah, so it wins here; this test pins the known
    // divergence so a future fix to either table is a deliberate decision and
    // not a silent drift.
    const disagreeing = SURAS.filter((s, i) => pageOfAyah(i + 1, s.count) !== s.pageEnd).map(
      (s) => s.name,
    );
    expect(disagreeing).toEqual([
      'النساء',
      'يونس',
      'هود',
      'الرعد',
      'الحجر',
      'مريم',
      'الشورى',
      'الأحقاف',
      'الطور',
      'الحشر',
      'الانشقاق',
      'البروج',
      'الغاشية',
      'البلد',
      'البينة',
      'العاديات',
    ]);
  });
});

describe('assignmentAyahSpan', () => {
  it('reads a plain ayah range', () => {
    expect(assignmentAyahSpan({ sura: 'الفاتحة', from: '2', to: '4' })).toEqual([2, 4]);
  });

  it('treats a bare sura as the whole sura', () => {
    expect(assignmentAyahSpan({ sura: 'الفاتحة' })).toEqual([1, 7]);
  });

  it('treats a half-entered range as the whole sura, like itemAyat', () => {
    expect(assignmentAyahSpan({ sura: 'الفاتحة', from: '3' })).toEqual([1, 7]);
    expect(assignmentAyahSpan({ sura: 'الفاتحة', from: '5', to: '2' })).toEqual([1, 7]);
  });

  it('spans whole-sura ranges in either direction', () => {
    const forward = assignmentAyahSpan({ sura: 'الفلق', toSura: 'الناس', range: true });
    const backward = assignmentAyahSpan({ sura: 'الناس', toSura: 'الفلق', range: true });
    expect(forward).toEqual(backward);
    expect(forward).toEqual([globalAyahIndex(113, 1), TOTAL_AYAT]);
  });

  it('returns null for a missing or unknown sura', () => {
    expect(assignmentAyahSpan(undefined)).toBeNull();
    expect(assignmentAyahSpan({ sura: '' })).toBeNull();
    expect(assignmentAyahSpan({ sura: 'سورة مش موجودة' })).toBeNull();
  });
});

describe('completedPages', () => {
  it('counts nothing for a partly memorized page', () => {
    // النبأ 1–20 is only part of page 582.
    expect(
      completedPages([{ item: { sura: 'النبأ', from: '1', to: '20' }, date: '2026-01-01' }]),
    ).toHaveLength(0);
  });

  it('counts a page once its ayat are all covered', () => {
    const pages = completedPages([
      { item: { sura: 'الفاتحة', from: '1', to: '7' }, date: '2026-01-01' },
    ]);
    expect(pages).toEqual([{ page: 1, date: '2026-01-01' }]);
  });

  it('dates a page by the session that FINISHED it, not the one that started it', () => {
    const pages = completedPages([
      { item: { sura: 'الفاتحة', from: '1', to: '4' }, date: '2026-01-01' },
      { item: { sura: 'الفاتحة', from: '5', to: '7' }, date: '2026-02-10' },
    ]);
    expect(pages).toEqual([{ page: 1, date: '2026-02-10' }]);
  });

  it('never counts the same page twice, however often it is re-assigned', () => {
    const pages = completedPages([
      { item: { sura: 'الفاتحة' }, date: '2026-01-01' },
      { item: { sura: 'الفاتحة' }, date: '2026-02-01' },
      { item: { sura: 'الفاتحة', from: '1', to: '7' }, date: '2026-03-01' },
    ]);
    expect(pages).toHaveLength(1);
    // Re-assignment is revision: the completion date stays the FIRST time the
    // page was actually finished.
    expect(pages[0].date).toBe('2026-01-01');
  });

  it('counts every page of a long multi-page assignment', () => {
    const pages = completedPages([{ item: { sura: 'البقرة' }, date: '2026-01-01' }]);
    // البقرة runs pages 2–49 and owns both ends outright (آل عمران only starts
    // on page 50), so the whole span completes.
    expect(pages.map((p) => p.page)).toEqual(Array.from({ length: 48 }, (_, i) => i + 2));
  });

  it('does not complete a page shared with a sura that was not assigned', () => {
    // الكهف starts mid-page-293, which الإسراء also sits on.
    const pages = completedPages([{ item: { sura: 'الكهف' }, date: '2026-01-01' }]);
    expect(pages.map((p) => p.page)).not.toContain(293);
    expect(pages.map((p) => p.page)).toContain(294);
  });

  it('completes a shared page only when both suras on it are covered', () => {
    const half = completedPages([{ item: { sura: 'الفلق' }, date: '2026-01-01' }]);
    expect(half.map((p) => p.page)).not.toContain(604);
    const whole = completedPages([
      { item: { sura: 'الفلق' }, date: '2026-01-01' },
      { item: { sura: 'الناس' }, date: '2026-01-08' },
      { item: { sura: 'الإخلاص' }, date: '2026-01-15' },
      { item: { sura: 'المسد' }, date: '2026-01-22' },
      { item: { sura: 'النصر' }, date: '2026-01-29' },
    ]);
    expect(whole.map((p) => p.page)).toContain(604);
  });

  it('ignores assignments with no date and unknown suras', () => {
    expect(completedPages([{ item: { sura: 'الفاتحة' }, date: '' }])).toHaveLength(0);
    expect(completedPages([{ item: { sura: 'مش سورة' }, date: '2026-01-01' }])).toHaveLength(0);
  });

  it('the whole mushaf is 604 pages', () => {
    const all = completedPages(SURAS.map((s) => ({ item: { sura: s.name }, date: '2026-01-01' })));
    expect(all).toHaveLength(TOTAL_PAGES);
  });
});

describe('pagesLabel', () => {
  it('uses the right Arabic plural form', () => {
    expect(pagesLabel(1)).toBe('صفحة واحدة');
    expect(pagesLabel(2)).toBe('صفحتين');
    expect(pagesLabel(5)).toBe('٥ صفحات');
    expect(pagesLabel(12)).toBe('١٢ صفحة');
  });
});

describe('the memorization path (ترتيب اللوح)', () => {
  it('starts at الفاتحة and continues with الناس, not البقرة', () => {
    expect(lohPositionOf(1, 1)).toBe(1);
    expect(lohPositionOf(1, 7)).toBe(7);
    expect(lohPositionOf(114, 1)).toBe(8); // الناس immediately follows الفاتحة
  });

  it('places each sura immediately before the one numbered below it', () => {
    // الحاقة (69) is followed on the path by القلم (68).
    expect(lohPositionOf(68, 1)).toBe(lohPositionOf(69, 52) + 1);
  });

  it('ends at the last ayah of البقرة', () => {
    expect(lohPositionOf(2, 286)).toBe(TOTAL_AYAT);
  });

  it('is a bijection with the global ayah ordinals', () => {
    const seen = new Set<number>();
    for (let s = 1; s <= 114; s++) seen.add(lohPositionOf(s, 1));
    expect(seen.size).toBe(114);
  });
});

describe('pagesInLohSpan', () => {
  it('counts the pages fully inside a span, ignoring how it was recorded', () => {
    // ياسين: الحاقة ٣٨ → آخر التحريم.
    const from = lohPositionOf(69, 38);
    const to = lohPositionOf(66, 12);
    expect(pagesInLohSpan(from, to)).toEqual([560, 561, 562, 563, 564, 565]);
  });

  it('does not credit a page the span only partly covers', () => {
    // Page 566 runs القلم ٤٣ → الحاقة ٨, which the span above never reaches.
    expect(pagesInLohSpan(lohPositionOf(69, 38), lohPositionOf(66, 12))).not.toContain(566);
  });

  it('grows as the student advances', () => {
    const from = lohPositionOf(69, 38);
    const short = pagesInLohSpan(from, lohPositionOf(67, 30)); // through الملك
    const long = pagesInLohSpan(from, lohPositionOf(66, 12)); // through التحريم
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('is empty when the end point sits before the start point', () => {
    expect(pagesInLohSpan(lohPositionOf(66, 1), lohPositionOf(69, 38))).toEqual([]);
  });

  it('counts a single page when the span is exactly one page', () => {
    expect(pagesInLohSpan(lohPositionOf(67, 1), lohPositionOf(67, 12))).toEqual([562]);
  });
});

describe('memorization direction', () => {
  it('walks descending suras for the halaqa default order', () => {
    expect(pathPositionOf(68, 1, 'descending')).toBe(pathPositionOf(69, 52, 'descending') + 1);
  });

  it('walks ascending mushaf order for students starting at البقرة', () => {
    expect(pathPositionOf(3, 1, 'ascending')).toBe(pathPositionOf(2, 286, 'ascending') + 1);
  });

  it('counts pages across a sura boundary in ascending order', () => {
    // البقرة ١ → آل عمران ٢٠ is a forward run for a mushaf-order student, and
    // must not read as going backwards.
    const from = pathPositionOf(2, 1, 'ascending');
    const to = pathPositionOf(3, 20, 'ascending');
    expect(to).toBeGreaterThan(from);
    expect(pagesInPathSpan(from, to, 'ascending').length).toBeGreaterThan(45);
  });

  it('agrees with the descending path while both stay inside one sura', () => {
    const d = pagesInPathSpan(
      pathPositionOf(2, 1, 'descending'),
      pathPositionOf(2, 60, 'descending'),
      'descending',
    );
    const a = pagesInPathSpan(
      pathPositionOf(2, 1, 'ascending'),
      pathPositionOf(2, 60, 'ascending'),
      'ascending',
    );
    expect(a).toEqual(d);
  });
});
