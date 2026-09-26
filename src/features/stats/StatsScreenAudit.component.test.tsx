import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

const names = ['زيد احمد', 'خالد سعيد', 'عمر حسن', 'أنس طارق', 'بلال يوسف'];
const students: Student[] = names.map((name, i) => ({ id: `s_${i}`, name }));
const DAYS = ['2026-06-03', '2026-06-10', '2026-07-01', '2026-07-08'];

const records: SessionRecord[] = students.flatMap((s, si) =>
  DAYS.slice(0, si === 0 ? 1 : si === 1 ? 2 : 4).map((date, di) => ({
    id: `r_${si}_${di}`,
    studentId: s.id,
    date,
    loh: { score: 90 },
    newLoh: [{ sura: 'الناس' }],
  })),
);

vi.mock('../../hooks/useStudents', () => ({ useStudents: () => ({ students, loaded: true }) }));
vi.mock('../../hooks/useAllRecords', () => ({ useAllRecords: () => ({ records, loaded: true }) }));

beforeEach(() => vi.clearAllMocks());

function card(title: string): HTMLElement {
  return screen.getByText(title).closest('[data-card]') as HTMLElement;
}

describe('StatsScreen — details caught in review', () => {
  it('does not double-escape the search term', async () => {
    render(<StatsScreen />);
    await userEvent.type(screen.getByLabelText('ابحث عن طالب في تفصيل الطلاب'), 'a&b');
    const detail = card('تفصيل الطلاب');
    expect(detail.textContent).toContain('a&b');
    expect(detail.textContent).not.toContain('&amp;');
  });

  it('agrees the session count with its noun instead of always saying جلسة', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByRole('button', { name: /^عرض الكل.*تفصيل الطلاب$/ }));
    const detail = card('تفصيل الطلاب');
    // One student attended once, one twice, the rest four times.
    expect(detail.textContent).toContain('جلسة واحدة');
    expect(detail.textContent).toContain('جلستين');
    expect(detail.textContent).toContain('٤ جلسات');
    expect(detail.textContent).not.toContain('١ جلسة');
    expect(detail.textContent).not.toContain('٢ جلسة');
  });

  it('names the month in the period picker rather than showing 2026-07', () => {
    render(<StatsScreen />);
    const options = Array.from(screen.getByRole('combobox').querySelectorAll('option'));
    const july = options.find((o) => (o as HTMLOptionElement).value === '2026-07');
    expect(july!.textContent).not.toBe('2026-07');
    expect(july!.textContent).toContain('٢٠٢٦');
  });

  it('previews تفصيل الطلاب like every other card instead of listing everyone', async () => {
    render(<StatsScreen />);
    const detail = card('تفصيل الطلاب');
    expect(detail.textContent).not.toContain('زيد احمد');
    await userEvent.click(screen.getByRole('button', { name: /^عرض الكل.*تفصيل الطلاب$/ }));
    expect(card('تفصيل الطلاب').textContent).toContain('زيد احمد');
  });

  it('writes the overall points without a Latin decimal point among Arabic digits', () => {
    render(<StatsScreen />);
    expect(card('🥇 الترتيب العام').textContent).not.toMatch(/[٠-٩]\.[٠-٩]/);
  });
});
