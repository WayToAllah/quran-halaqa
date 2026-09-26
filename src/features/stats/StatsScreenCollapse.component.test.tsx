import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'خالد سعيد' },
  { id: 's_3', name: 'عمر حسن' },
  { id: 's_4', name: 'أنس طارق' },
  { id: 's_5', name: 'بلال يوسف' },
];

const DAYS = ['2026-07-01', '2026-07-08', '2026-07-15'];

const records: SessionRecord[] = students.flatMap((s) =>
  DAYS.map((date, i) => ({ id: `r_${s.id}_${i}`, studentId: s.id, date, loh: { score: 90 } })),
);

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function card(title: string): HTMLElement {
  return screen.getByText(title).closest('[data-card]') as HTMLElement;
}
function cardHeader(title: string): HTMLElement {
  return card(title).querySelector('[data-card-header]') as HTMLElement;
}
function showAll(title: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^عرض (الكل|أقل).*${title}$`) });
}

describe('StatsScreen — card headers', () => {
  it('pins the header so it stays reachable from the middle of a long list', () => {
    const cls = (render(<StatsScreen />), cardHeader('🥇 الترتيب العام').className);
    expect(cls).toContain('sticky');
    expect(cls).toContain('top-[69px]');
  });

  it('carries the list toggle in the header rather than under the list', () => {
    render(<StatsScreen />);
    expect(cardHeader('🥇 الترتيب العام').textContent).toContain('عرض الكل');
  });

  it('leaves only one control per header — no separate open/close chevron', () => {
    render(<StatsScreen />);
    const buttons = cardHeader('🥇 الترتيب العام').querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('عرض');
    // The old chevron reported its state this way; nothing in the header
    // should still be claiming to fold the card away.
    expect(cardHeader('🥇 الترتيب العام').querySelector('[aria-label="🥇 الترتيب العام"]')).toBe(
      null,
    );
  });

  it('lengthens and shortens the list from that one control', async () => {
    render(<StatsScreen />);
    expect(card('🥇 الترتيب العام').textContent).not.toContain('زيد احمد');
    await userEvent.click(showAll('الترتيب العام'));
    expect(card('🥇 الترتيب العام').textContent).toContain('زيد احمد');
    await userEvent.click(showAll('الترتيب العام'));
    expect(card('🥇 الترتيب العام').textContent).not.toContain('زيد احمد');
  });

  it('leaves you at the header when عرض أقل shortens the list under you', async () => {
    render(<StatsScreen />);
    await userEvent.click(showAll('الترتيب العام'));

    const scrollTo = vi.fn();
    const origScroll = window.scrollTo;
    const origRect = Element.prototype.getBoundingClientRect;
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    window.scrollY = 500;
    // Scrolled 200px into the card.
    Element.prototype.getBoundingClientRect = () => ({ top: -200 }) as DOMRect;
    try {
      await userEvent.click(showAll('الترتيب العام'));
      expect(scrollTo).toHaveBeenCalledWith({ top: 500 - 200 - 69 });
    } finally {
      window.scrollTo = origScroll;
      Element.prototype.getBoundingClientRect = origRect;
    }
  });

  it('does not move the page when عرض الكل lengthens it', async () => {
    render(<StatsScreen />);
    const scrollTo = vi.fn();
    const origScroll = window.scrollTo;
    const origRect = Element.prototype.getBoundingClientRect;
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Element.prototype.getBoundingClientRect = () => ({ top: -200 }) as DOMRect;
    try {
      await userEvent.click(showAll('الترتيب العام'));
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      window.scrollTo = origScroll;
      Element.prototype.getBoundingClientRect = origRect;
    }
  });
});
