import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// Two halaqa days total (2026-07-01, 2026-07-02). زيد attends both -> 100%
// (clears the ≥70% attendance-badge threshold, rank #1). محمد attends only
// one -> 50% (below threshold, excluded from the leaderboard entirely).
const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
];

const records: SessionRecord[] = [
  { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } },
  { id: 'r2', studentId: 's_1', date: '2026-07-02', loh: { score: 90 } },
  { id: 'r3', studentId: 's_2', date: '2026-07-01', loh: { score: 80 } },
];

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StatsScreen — attendance leaderboard rank wording', () => {
  it('shows the attendance rank as an Arabic ordinal word (المركز الأول), not a digit', () => {
    render(<StatsScreen />);
    expect(screen.getByText(/المركز الأول/)).toBeInTheDocument();
  });

  it('does not show the old digit-based المركز wording', () => {
    render(<StatsScreen />);
    expect(screen.queryByText(/المركز ١(?!\d)/)).not.toBeInTheDocument();
  });

  it('still shows a plain digit inside the compact rank circle badge (title uses the ordinal instead)', () => {
    render(<StatsScreen />);
    // The circle badge itself stays a compact digit — only the tooltip/label text changed.
    const badge = screen.getByTitle('المركز الأول');
    expect(badge.textContent).toBe('١');
  });
});
