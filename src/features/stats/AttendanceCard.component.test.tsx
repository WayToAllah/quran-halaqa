import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// One halaqa day, one attendee -> 100% attendance, so the card has a star and
// the button is enabled.
const students: Student[] = [{ id: 's_1', name: 'زيد احمد' }];
const records: SessionRecord[] = [
  { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 } },
];

vi.mock('../../hooks/useStudents', () => ({ useStudents: () => ({ students, loaded: true }) }));
vi.mock('../../hooks/useAllRecords', () => ({ useAllRecords: () => ({ records, loaded: true }) }));

describe('StatsScreen — نجوم الحضور card', () => {
  it('opens the card modal with a rendered SVG and a share action, then closes', async () => {
    render(<StatsScreen />);

    const openBtn = screen.getByRole('button', { name: /بطاقة نجوم الحضور/ });
    expect(openBtn).not.toBeDisabled();

    await userEvent.click(openBtn);

    expect(screen.getByText('بطاقة نجوم الحضور')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /مشاركة \/ تحميل/ })).toBeInTheDocument();
    // the preview really contains the rasterization-ready SVG
    expect(document.querySelector('svg')).toBeTruthy();
    expect(document.body.innerHTML).toContain('نجوم الحضور');

    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(screen.queryByText('بطاقة نجوم الحضور')).not.toBeInTheDocument();
  });
});
