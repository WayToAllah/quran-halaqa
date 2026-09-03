import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Ten students attending in bunched numbers across three weeks: 10, 8, 9.
// From a zero baseline those bars are 100% / 80% / 90% — nearly identical.
const students: Student[] = Array.from({ length: 10 }, (_, i) => ({
  id: `s_${i}`,
  name: `طالب ${i}`,
}));

const WEEKS: [string, number][] = [
  ['2026-07-04', 10],
  ['2026-07-11', 8],
  ['2026-07-18', 9],
];

const records: SessionRecord[] = WEEKS.flatMap(([date, n]) =>
  students.slice(0, n).map((s, i) => ({ id: `r_${date}_${i}`, studentId: s.id, date })),
);

vi.mock('../../hooks/useStudents', () => ({ useStudents: () => ({ students, loaded: true }) }));
vi.mock('../../hooks/useAllRecords', () => ({ useAllRecords: () => ({ records, loaded: true }) }));

beforeEach(() => vi.clearAllMocks());

function chartCard(): HTMLElement {
  return screen.getByText('📈 النشاط الأسبوعي').parentElement as HTMLElement;
}

function barHeights(): number[] {
  return Array.from(chartCard().querySelectorAll('div'))
    .map((el) => /height:\s*([\d.]+)%/.exec(el.getAttribute('style') ?? '')?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number);
}

describe('StatsScreen — مقياس النشاط الأسبوعي', () => {
  it('spreads bunched weeks apart instead of drawing them all near full height', () => {
    render(<StatsScreen />);
    const h = barHeights();
    expect(h).toHaveLength(3);
    // From zero these would be 100/80/90. Cropping must widen that spread well
    // beyond the 20 points a zero baseline gives.
    expect(Math.max(...h) - Math.min(...h)).toBeGreaterThan(50);
    expect(Math.max(...h)).toBe(100);
  });

  it('keeps the quietest week visible rather than collapsing it to nothing', () => {
    render(<StatsScreen />);
    expect(Math.min(...barHeights())).toBeGreaterThan(5);
  });

  it('says where the axis starts, so cropped bars are not read as a true zero', () => {
    render(<StatsScreen />);
    expect(chartCard().textContent).toMatch(/المقياس يبدأ من/);
  });

  it('still labels every bar with its real count', () => {
    render(<StatsScreen />);
    const text = chartCard().textContent ?? '';
    expect(text).toContain('١٠');
    expect(text).toContain('٨');
    expect(text).toContain('٩');
  });
});
