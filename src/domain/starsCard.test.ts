import { describe, it, expect } from 'vitest';
import { buildStarsCardSvg, starsCardSize, starsRankBadge, type StarsCardModel } from './starsCard';

const model: StarsCardModel = {
  title: '🌟 نجوم الحضور',
  subtitle: 'يوليو ٢٠٢٦ · من إجمالي ٢٠ يوم',
  footer: 'جزاكم الله خيراً 🤲',
  rows: [
    { rank: 1, name: 'زيد أحمد', value: '١٠٠٪' },
    { rank: 2, name: 'عمر خالد', value: '٩٥٪' },
    { rank: 3, name: 'علي حسن', value: '٩٠٪' },
    { rank: 4, name: 'يوسف طارق', value: '٨٥٪' },
  ],
};

describe('starsRankBadge', () => {
  it('crowns first place and medals second and third, like the live card', () => {
    expect(starsRankBadge(1)).toBe('👑');
    expect(starsRankBadge(2)).toBe('🥈');
    expect(starsRankBadge(3)).toBe('🥉');
  });

  it('falls back to the plain rank number after third', () => {
    expect(starsRankBadge(4)).toBe('٤');
    expect(starsRankBadge(11)).toBe('١١');
  });
});

describe('starsCardSize', () => {
  it('is a fixed width and grows taller with each row, like the live block', () => {
    const four = starsCardSize(4);
    const eight = starsCardSize(8);
    expect(four.width).toBe(1080);
    expect(eight.width).toBe(1080);
    expect(eight.height).toBeGreaterThan(four.height);
  });

  it('grows by exactly one row pitch per row, so rows never crowd', () => {
    const pitch = starsCardSize(5).height - starsCardSize(4).height;
    expect(starsCardSize(9).height - starsCardSize(8).height).toBe(pitch);
    expect(pitch).toBeGreaterThan(100);
  });
});

describe('buildStarsCardSvg', () => {
  it('renders at the size starsCardSize reports', () => {
    const { width, height } = starsCardSize(model.rows.length);
    const svg = buildStarsCardSvg(model);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain(`height="${height}"`);
  });

  it('uses the live green-to-gold gradient, not the v2 poster teal', () => {
    const svg = buildStarsCardSvg(model);
    expect(svg).toContain('#0f4a2c');
    expect(svg).toContain('#15613a');
    expect(svg).toContain('#d4a82c');
    expect(svg).not.toContain('#1B4D5C');
  });

  it('prints the title, subtitle and footer', () => {
    const svg = buildStarsCardSvg(model);
    expect(svg).toContain('نجوم الحضور');
    expect(svg).toContain('من إجمالي ٢٠ يوم');
    expect(svg).toContain('جزاكم الله خيراً');
  });

  it('prints every row with its badge, name and value', () => {
    const svg = buildStarsCardSvg(model);
    expect(svg).toContain('👑');
    expect(svg).toContain('زيد أحمد');
    expect(svg).toContain('١٠٠٪');
    expect(svg).toContain('يوسف طارق');
    expect(svg).toContain('٨٥٪');
  });

  it('pins its own direction so an RTL page cannot flip text-anchor', () => {
    expect(buildStarsCardSvg(model)).toContain('direction="ltr"');
  });

  it('escapes names instead of injecting markup', () => {
    const svg = buildStarsCardSvg({
      ...model,
      rows: [{ rank: 1, name: '<script>x</script>', value: '١٪' }],
    });
    expect(svg).not.toContain('<script>');
  });

  it('keeps the last row and the footer inside the canvas', () => {
    for (const n of [1, 4, 10]) {
      const rows = Array.from({ length: n }, (_, i) => ({
        rank: i + 1,
        name: `طالب ${i}`,
        value: '١٪',
      }));
      const { height } = starsCardSize(n);
      const svg = buildStarsCardSvg({ ...model, rows });
      const ys = Array.from(svg.matchAll(/ y="(-?[\d.]+)"/g)).map((m) => Number(m[1]));
      expect(Math.max(...ys)).toBeLessThanOrEqual(height);
    }
  });
});

describe('rank medals beyond third place', () => {
  const rowsFor = (ranks: number[]) =>
    ranks.map((rank) => ({ rank, name: `طالب ${rank}`, value: '١٪' }));

  it('keeps the emoji medals for the top three', () => {
    const svg = buildStarsCardSvg({ ...model, rows: rowsFor([1, 2, 3]) });
    expect(svg).toContain('👑');
    expect(svg).toContain('🥈');
    expect(svg).toContain('🥉');
  });

  it('draws a medal for fourth place and beyond instead of a bare number', () => {
    const svg = buildStarsCardSvg({ ...model, rows: rowsFor([4]) });
    expect(svg).toContain('rank-medal');
    expect(svg).toContain('<circle');
  });

  it('writes the rank inside the medal in Latin digits, readable at medal size', () => {
    const svg = buildStarsCardSvg({ ...model, rows: rowsFor([4, 12]) });
    expect(svg).toContain('>4<');
    expect(svg).toContain('>12<');
  });

  it('still gives the WhatsApp text a plain badge, since it cannot draw', () => {
    expect(starsRankBadge(1)).toBe('👑');
    expect(starsRankBadge(7)).toBe('٧');
  });
});
