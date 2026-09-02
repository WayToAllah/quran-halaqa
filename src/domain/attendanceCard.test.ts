import { describe, it, expect } from 'vitest';
import type { Student, SessionRecord } from '../types';
import {
  buildAttendanceCardData,
  buildAttendanceCardSvg,
  attendanceCardSize,
  attendanceCardText,
} from './attendanceCard';

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

const all = { minPct: 0 };

describe('buildAttendanceCardData', () => {
  it('ranks by attendance percentage, highest first', () => {
    const data = buildAttendanceCardData(students, distinctRecords, all);
    expect(data.stars[0].name).toBe('زيد أحمد');
    expect(data.stars[0].rank).toBe(1);
    expect(data.stars[0].attendPct).toBeGreaterThan(data.stars[1].attendPct);
  });

  it('applies dense ranking — tied students share a rank', () => {
    const tied: SessionRecord[] = [
      { id: 't1', studentId: 's1', date: '2026-07-01' },
      { id: 't2', studentId: 's2', date: '2026-07-01' },
      { id: 't3', studentId: 's3', date: '2026-07-01' },
    ];
    const data = buildAttendanceCardData(students, tied, all);
    expect(data.stars[0].rank).toBe(1);
    expect(data.stars[1].rank).toBe(1);
  });

  it('hides students below the نجم الحضور threshold by default', () => {
    const data = buildAttendanceCardData(students, distinctRecords);
    expect(data.stars.every((s) => s.attendPct >= 70)).toBe(true);
    expect(data.stars.find((s) => s.name === 'حسن فؤاد')).toBeUndefined();
  });

  it('reports the period it was built for', () => {
    const data = buildAttendanceCardData(students, distinctRecords, {
      ...all,
      periodLabel: 'يوليو ٢٠٢٦',
    });
    expect(data.periodLabel).toBe('يوليو ٢٠٢٦');
  });

  it('honours the row limit', () => {
    const data = buildAttendanceCardData(students, distinctRecords, { ...all, limit: 2 });
    expect(data.stars).toHaveLength(2);
    expect(data.count).toBe(2);
  });
});

describe('buildAttendanceCardSvg', () => {
  it('draws the live green-to-gold card, not the retired teal poster', () => {
    const svg = buildAttendanceCardSvg(buildAttendanceCardData(students, distinctRecords, all));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('#0f4a2c');
    expect(svg).not.toContain('#1B4D5C');
  });

  it('shows the title, the halaqa day total and every student', () => {
    const data = buildAttendanceCardData(students, distinctRecords, all);
    const svg = buildAttendanceCardSvg(data);
    expect(svg).toContain('نجوم الحضور');
    expect(svg).toContain(`من إجمالي ${'٥'} يوم`);
    data.stars.forEach((s) => expect(svg).toContain(s.name));
  });

  it('writes percentages in Arabic-Indic digits', () => {
    const svg = buildAttendanceCardSvg(buildAttendanceCardData(students, distinctRecords, all));
    expect(svg).toContain('١٠٠٪');
    expect(svg).not.toMatch(/>[0-9]+٪</);
  });

  it('grows with the list instead of clipping it', () => {
    const two = buildAttendanceCardData(students, distinctRecords, { ...all, limit: 2 });
    const five = buildAttendanceCardData(students, distinctRecords, { ...all, limit: 5 });
    expect(attendanceCardSize(five).height).toBeGreaterThan(attendanceCardSize(two).height);
    expect(attendanceCardSize(five).width).toBe(attendanceCardSize(two).width);
  });

  it('pins its own direction so an RTL page cannot flip text-anchor', () => {
    const svg = buildAttendanceCardSvg(buildAttendanceCardData(students, distinctRecords, all));
    expect(svg).toContain('direction="ltr"');
  });
});

describe('attendanceCardText', () => {
  it('builds a WhatsApp ranking with a badge per student', () => {
    const data = buildAttendanceCardData(students, distinctRecords, all);
    const text = attendanceCardText(data);
    expect(text).toContain('👑 زيد أحمد — ١٠٠٪');
    expect(text).toContain('نجوم الحضور');
    expect(text).toContain('جزاكم الله خيراً');
  });
});
