import { describe, it, expect } from 'vitest';
import {
  arabicPlural,
  esc,
  normAr,
  toArabicOrdinal,
  toWesternDigits,
  stripWhitespace,
} from './text';

describe('esc', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(esc(`<script>alert("x")&'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;y&#39;&lt;/script&gt;',
    );
  });
  it('handles null/undefined as empty string, not "null"/"undefined"', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
  it('passes through plain Arabic text unchanged', () => {
    expect(esc('زيد احمد')).toBe('زيد احمد');
  });
});

describe('normAr', () => {
  it('unifies hamza forms onto bare alef', () => {
    expect(normAr('أحمد')).toBe(normAr('احمد'));
    expect(normAr('إبراهيم')).toBe(normAr('ابراهيم'));
  });
  it('unifies alef-maqsura and ya', () => {
    expect(normAr('مصطفى')).toBe(normAr('مصطفي'));
  });
  it('unifies ta-marbuta and ha', () => {
    expect(normAr('فاطمة')).toBe(normAr('فاطمه'));
  });
  it('strips diacritics', () => {
    expect(normAr('مُحَمَّد')).toBe(normAr('محمد'));
  });
  it('collapses repeated whitespace and trims', () => {
    expect(normAr('  زيد    احمد  ')).toBe('زيد احمد');
  });
});

describe('toArabicOrdinal', () => {
  it('renders standalone ordinals 1–10', () => {
    expect(toArabicOrdinal(1)).toBe('الأول');
    expect(toArabicOrdinal(2)).toBe('الثاني');
    expect(toArabicOrdinal(3)).toBe('الثالث');
    expect(toArabicOrdinal(10)).toBe('العاشر');
  });
  it('renders the teens (11–19) with the compound form + عشر', () => {
    expect(toArabicOrdinal(11)).toBe('الحادي عشر');
    expect(toArabicOrdinal(12)).toBe('الثاني عشر');
    expect(toArabicOrdinal(19)).toBe('التاسع عشر');
  });
  it('renders round tens', () => {
    expect(toArabicOrdinal(20)).toBe('العشرون');
    expect(toArabicOrdinal(30)).toBe('الثلاثون');
    expect(toArabicOrdinal(90)).toBe('التسعون');
  });
  it('renders compound tens as "unit والtens"', () => {
    expect(toArabicOrdinal(21)).toBe('الحادي والعشرون');
    expect(toArabicOrdinal(25)).toBe('الخامس والعشرون');
    expect(toArabicOrdinal(99)).toBe('التاسع والتسعون');
  });
  it('falls back to Arabic-Indic digits outside the supported range', () => {
    expect(toArabicOrdinal(0)).toBe('٠');
    expect(toArabicOrdinal(100)).toBe('١٠٠');
    expect(toArabicOrdinal(-1)).toBe('-١');
  });
});

describe('toWesternDigits', () => {
  it('converts Arabic-Indic and Persian digits to ASCII', () => {
    expect(toWesternDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toWesternDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('leaves ASCII digits and surrounding text alone', () => {
    expect(toWesternDigits('01012345678')).toBe('01012345678');
    expect(toWesternDigits('رقم ٠١٠ هنا')).toBe('رقم 010 هنا');
  });
});

describe('stripWhitespace', () => {
  it('removes spaces anywhere in the value, not just at the ends', () => {
    expect(stripWhitespace('  0100 123 4567 ')).toBe('01001234567');
  });

  it('removes non-breaking and other Unicode spaces', () => {
    expect(stripWhitespace('0100\u00a0123\u202f4567')).toBe('01001234567');
  });

  it('handles empty and missing values', () => {
    expect(stripWhitespace('')).toBe('');
    expect(stripWhitespace(undefined)).toBe('');
  });
});

describe('arabicPlural', () => {
  const pages = { one: 'صفحة واحدة', two: 'صفحتين', few: 'صفحات', many: 'صفحة' };

  it('uses the standalone one/two forms without a numeral', () => {
    expect(arabicPlural(1, pages)).toBe('صفحة واحدة');
    expect(arabicPlural(2, pages)).toBe('صفحتين');
  });

  it('uses the broken plural for 3–10', () => {
    expect(arabicPlural(3, pages)).toBe('٣ صفحات');
    expect(arabicPlural(10, pages)).toBe('١٠ صفحات');
  });

  it('reverts to the singular for 0 and 11+', () => {
    expect(arabicPlural(11, pages)).toBe('١١ صفحة');
    expect(arabicPlural(0, pages)).toBe('٠ صفحة');
    expect(arabicPlural(604, pages)).toBe('٦٠٤ صفحة');
  });
});
