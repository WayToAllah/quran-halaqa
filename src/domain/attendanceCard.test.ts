import { describe, it, expect } from 'vitest';
import type { Student, SessionRecord } from '../types';
import { buildAttendanceCardData, buildAttendanceCardSvg } from './attendanceCard';

const students: Student[] = [
  { id: 's1', name: 'زيد أحمد' },
  { id: 's2', name: 'عمر خالد' },
  { id: 's3', name: 'علي حسن' },
  { id: 's4', name: 'يوسف طارق' },
  { id: 's5', name: 'حسن فؤاد' },
];

const distinctRecords: SessionRecord[] = [
  { id: 'a1', studentId: 's1', date: '2026-07-01' },
  { id: 'a2', studentId: 's1', date: '2026-07-02' },
  { id: 'a3', studentId: 's1', date: '2026-07-03' },
  { id: 'a4', studentId: 's1', date: '2026-07-04' },
  { id: 'a5', studentId: 's1', date: '2026-07-05' },
  { id: 'b1', studentId: 's2', date: '2026-07-01' },
  { id: 'b2', studentId: 's2', date: '2026-07-02' },
  { id: 'b3', studentId: 's2', date: '2026-07-03' },
  { id: 'b4', studentId: 's2', date: '2026-07-04' },
  { id: 'c1', studentId: 's3', date: '2026-07-01' },
  { id: 'c2', studentId: 's3', date: '2026-07-02' },
  { id: 'c3', studentId: 's3', date: '2026-07-03' },
  { id: 'd1', studentId: 's4', date: '2026-07-01' },
  { id: 'd2', studentId: 's4', date: '2026-07-02' },
  { id: 'e1', studentId: 's5', date: '2026-07-01' },
];

describe('buildAttendanceCardData', () => {
  it('assigns crown/gold/silver/bronze in rank order, matching the mockup medal emoji for 2nd/3rd', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { minPct: 0, now: new Date('2026-07-06') });
    expect(data.stars[0].style.kind).toBe('crown');
    expect(data.stars[1]).toMatchObject({ style: { kind: 'gold', medalEmoji: '🥇' } });
    expect(data.stars[2]).toMatchObject({ style: { kind: 'silver', medalEmoji: '🥈' } });
    expect(data.stars[3]).toMatchObject({ style: { kind: 'bronze', medalEmoji: '🥉' } }); // added per product decision
    expect(data.stars[4].style.kind).toBe('number'); // 5th+ falls back to a numbered circle
  });

  it('applies dense ranking (ties share a rank/style) exactly like the on-screen leaderboard', () => {
    // omar and ali tie at 3/5 days -> both rank 2 (gold), matching getAttendanceRanking.
    const tiedRecords: SessionRecord[] = [
      ...distinctRecords.filter((r) => r.studentId === 's1'), // zaid 5/5
      { id: 'x1', studentId: 's2', date: '2026-07-01' },
      { id: 'x2', studentId: 's2', date: '2026-07-02' },
      { id: 'x3', studentId: 's2', date: '2026-07-03' },
      { id: 'y1', studentId: 's3', date: '2026-07-01' },
      { id: 'y2', studentId: 's3', date: '2026-07-02' },
      { id: 'y3', studentId: 's3', date: '2026-07-03' },
    ];
    const data = buildAttendanceCardData(students, tiedRecords, { minPct: 0, now: new Date('2026-07-06') });
    expect(data.stars[1].rank).toBe(2);
    expect(data.stars[2].rank).toBe(2);
    expect(data.stars[1].style.kind).toBe('gold');
    expect(data.stars[2].style.kind).toBe('gold');
  });

  it('includes only students at/above the badge threshold by default (70%)', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { now: new Date('2026-07-06') });
    expect(data.stars.map((s) => s.name)).toEqual(['زيد أحمد', 'عمر خالد']); // 100% and 80%
  });

  it('respects a custom limit', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { minPct: 0, limit: 1, now: new Date('2026-07-06') });
    expect(data.stars).toHaveLength(1);
    expect(data.stars[0].name).toBe('زيد أحمد');
  });

  it('uses the provided mosque name and an arabic-digit date label', () => {
    const data = buildAttendanceCardData(students, distinctRecords, {
      mosqueName: 'مسجد النور',
      now: new Date('2026-07-05'),
    });
    expect(data.mosqueName).toBe('مسجد النور');
    expect(data.dateLabel).toBe('٢٠٢٦/٧/٥');
  });

  it('computes the star count from the attendance percentage', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { minPct: 0, now: new Date('2026-07-06') });
    expect(data.stars[0].filledStars).toBe(5); // 100%
    expect(data.stars[1].filledStars).toBe(4); // 80%
  });
});

describe('buildAttendanceCardSvg', () => {
  it('produces a well-formed svg containing the title, mosque, and each star name', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { minPct: 0, now: new Date('2026-07-06') });
    const svg = buildAttendanceCardSvg(data);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('نجوم الحضور');
    expect(svg).toContain('مسجد التيسير');
    expect(svg).toContain('زيد أحمد');
    expect(svg).toContain('عمر خالد');
    expect(svg).toContain('٪');
    expect(svg).not.toContain('oklch'); // rasterization-safe
  });

  it('draws the exact mockup crown path for 1st place', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { minPct: 0, now: new Date('2026-07-06') });
    const svg = buildAttendanceCardSvg(data);
    expect(svg).toContain('M3 8l4 3 5-6 5 6 4-3-1.6 10H4.6L3 8z');
  });

  it('never sets direction=rtl on the svg root (it flips text-anchor start/end in SVG and pushes names into the badge circles — regression guard)', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { minPct: 0, now: new Date('2026-07-06') });
    const svg = buildAttendanceCardSvg(data);
    expect(svg).not.toMatch(/<svg[^>]*direction="rtl"/);
  });

  it('escapes names to stay xss-safe in the markup', () => {
    const data = buildAttendanceCardData(
      [{ id: 'x', name: '<script>zap' }],
      [{ id: 'r', studentId: 'x', date: '2026-07-01' }],
      { minPct: 0 },
    );
    const svg = buildAttendanceCardSvg(data);
    expect(svg).not.toContain('<script>zap');
    expect(svg).toContain('&lt;script&gt;zap');
  });

  it('handles an empty roster without throwing', () => {
    const data = buildAttendanceCardData([], [], { minPct: 0 });
    const svg = buildAttendanceCardSvg(data);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(data.stars).toHaveLength(0);
  });
});
