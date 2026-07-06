import { describe, it, expect } from 'vitest';
import { esc, normAr } from './text';

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
