import { describe, it, expect } from 'vitest';
import type { Student, SessionRecord } from '../types';
import {
  buildPagesCardData,
  buildPagesCardSvg,
  pagesCardSize,
  pagesCardText,
  DEFAULT_ROWS,
} from './pagesCard';

const students: Student[] = [
  { id: 's1', name: 'زيد أحمد' },
  { id: 's2', name: 'عمر خالد' },
  { id: 's3', name: 'علي حسن' },
];

// s1 walks a long span, s2 a shorter one, s3 only revises — so s3 never
// appears and s1 outranks s2.
const records: SessionRecord[] = [
  {
    id: 'a1',
    studentId: 's1',
    date: '2026-07-01',
    newLoh: [{ sura: 'البقرة', from: '1', to: '5' }],
  },
  {
    id: 'a2',
    studentId: 's1',
    date: '2026-07-08',
    newLoh: [{ sura: 'البقرة', from: '6', to: '150' }],
  },
  {
    id: 'b1',
    studentId: 's2',
    date: '2026-07-01',
    newLoh: [{ sura: 'البقرة', from: '1', to: '5' }],
  },
  {
    id: 'b2',
    studentId: 's2',
    date: '2026-07-08',
    newLoh: [{ sura: 'البقرة', from: '6', to: '60' }],
  },
  { id: 'c1', studentId: 's3', date: '2026-07-01', newMadi: [{ sura: 'البقرة' }] },
  { id: 'g1', studentId: 's1', date: '2026-08-05', loh: { score: 90 } },
  { id: 'g2', studentId: 's2', date: '2026-08-05', loh: { score: 90 } },
];

describe('buildPagesCardData', () => {
  it('ranks by pages memorized, highest first, with dense ranks', () => {
    const data = buildPagesCardData(students, records);
    expect(data.entries[0].name).toBe('زيد أحمد');
    expect(data.entries[0].rank).toBe(1);
    expect(data.entries[0].pages).toBeGreaterThan(data.entries[1].pages);
  });

  it('excludes students with no completed pages — الماضي is not new memorization', () => {
    const data = buildPagesCardData(students, records);
    expect(data.entries.find((e) => e.name === 'علي حسن')).toBeUndefined();
  });

  it('totals the pages across the rows shown', () => {
    const data = buildPagesCardData(students, records);
    expect(data.totalPages).toBe(data.entries.reduce((n, e) => n + e.pages, 0));
  });

  it('shows more than five students by default — a five-name card is too thin', () => {
    expect(DEFAULT_ROWS).toBeGreaterThan(5);
  });

  it('respects the month filter the stats screen is showing', () => {
    const data = buildPagesCardData(students, records, { monthFilter: '2026-01' });
    expect(data.entries).toHaveLength(0);
  });

  it('reports the period it was built for', () => {
    const data = buildPagesCardData(students, records, { periodLabel: 'يوليو ٢٠٢٦' });
    expect(data.periodLabel).toBe('يوليو ٢٠٢٦');
  });
});

describe('buildPagesCardSvg', () => {
  it('wears the same star icon as the attendance card, not a book', () => {
    const svg = buildPagesCardSvg(buildPagesCardData(students, records));
    expect(svg).toContain('🌟 نجوم الحفظ');
    expect(svg).not.toContain('📖');
  });

  it('uses the same live card design as the attendance one', () => {
    const svg = buildPagesCardSvg(buildPagesCardData(students, records));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('#0f4a2c');
    expect(svg).toContain('نجوم الحفظ');
  });

  it('prints each name with its page count in Arabic-Indic digits', () => {
    const data = buildPagesCardData(students, records);
    const svg = buildPagesCardSvg(data);
    expect(svg).toContain('زيد أحمد');
    expect(svg).toContain('عمر خالد');
    expect(svg).not.toMatch(/>[0-9]+ صفح/);
  });

  it('grows with the list rather than clipping it', () => {
    const one = buildPagesCardData(students, records, { limit: 1 });
    const two = buildPagesCardData(students, records, { limit: 2 });
    expect(pagesCardSize(two).height).toBeGreaterThan(pagesCardSize(one).height);
  });

  it('pins its own direction so an RTL page cannot flip text-anchor', () => {
    expect(buildPagesCardSvg(buildPagesCardData(students, records))).toContain('direction="ltr"');
  });
});

describe('pagesCardText', () => {
  it('builds a WhatsApp ranking with a badge per student', () => {
    const text = pagesCardText(buildPagesCardData(students, records));
    expect(text).toContain('👑 زيد أحمد —');
    expect(text).toContain('نجوم الحفظ');
    expect(text).toContain('جزاكم الله خيراً');
  });
});
