import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'خالد سعيد' },
];

const DAYS = ['2026-07-01', '2026-07-08', '2026-07-15'];

const records: SessionRecord[] = students.flatMap((s) =>
  DAYS.map((date, i) => ({
    id: `r_${s.id}_${i}`,
    studentId: s.id,
    date,
    loh: { score: 90 },
  })),
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

/** The header button a teacher taps to fold a card away. */
function header(title: string): HTMLElement {
  return screen.getByRole('button', { name: title });
}

function card(title: string): HTMLElement {
  return header(title).closest('[data-card]') as HTMLElement;
}

describe('StatsScreen — collapsible cards', () => {
  it('leaves you at the header you just tapped, not further down the page', async () => {
    // Closing a card from its middle shortens the page under you, so the same
    // scroll position now shows whatever came after it. The card is pulled
    // back under the app bar, where the button you tapped still is.
    const scrollTo = vi.fn();
    const origScroll = window.scrollTo;
    const origRect = Element.prototype.getBoundingClientRect;
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    window.scrollY = 500;
    // Scrolled 200px into the card: its top is above the viewport.
    Element.prototype.getBoundingClientRect = () => ({ top: -200 }) as DOMRect;
    try {
      render(<StatsScreen />);
      await userEvent.click(header('🥇 الترتيب العام'));
      expect(scrollTo).toHaveBeenCalledWith({ top: 500 - 200 - 69 });
    } finally {
      window.scrollTo = origScroll;
      Element.prototype.getBoundingClientRect = origRect;
    }
  });

  it('does not yank the page when the card was already fully in view', async () => {
    const scrollTo = vi.fn();
    const origScroll = window.scrollTo;
    const origRect = Element.prototype.getBoundingClientRect;
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    Element.prototype.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
    try {
      render(<StatsScreen />);
      await userEvent.click(header('🥇 الترتيب العام'));
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      window.scrollTo = origScroll;
      Element.prototype.getBoundingClientRect = origRect;
    }
  });

  it('opens every card by default', () => {
    render(<StatsScreen />);
    expect(card('🥇 الترتيب العام').textContent).toContain('زيد احمد');
    expect(header('🥇 الترتيب العام').getAttribute('aria-expanded')).toBe('true');
  });

  it('folds a card away when its header is tapped', async () => {
    render(<StatsScreen />);
    await userEvent.click(header('🥇 الترتيب العام'));
    expect(card('🥇 الترتيب العام').textContent).not.toContain('زيد احمد');
    expect(header('🥇 الترتيب العام').getAttribute('aria-expanded')).toBe('false');
  });

  it('opens it again on a second tap', async () => {
    render(<StatsScreen />);
    await userEvent.click(header('🥇 الترتيب العام'));
    await userEvent.click(header('🥇 الترتيب العام'));
    expect(card('🥇 الترتيب العام').textContent).toContain('زيد احمد');
  });

  it('keeps the header reachable while the card is open, so nothing needs scrolling past', () => {
    render(<StatsScreen />);
    // The control that closes a long list sits at its TOP, not buried under
    // fifty rows at the bottom — that was the whole complaint.
    const c = card('🥇 الترتيب العام');
    expect(c.firstElementChild).toBe(header('🥇 الترتيب العام'));
  });

  it('pins the header so it is still reachable from the middle of a long list', () => {
    render(<StatsScreen />);
    // Scrolled halfway down a fifty-row leaderboard, a header sitting at the
    // top of the card is off-screen and the card cannot be closed without
    // scrolling back up. It sticks just below the app bar instead.
    const cls = header('🥇 الترتيب العام').className;
    expect(cls).toContain('sticky');
    expect(cls).toContain('top-[69px]');
  });

  it('folds each card independently', async () => {
    render(<StatsScreen />);
    await userEvent.click(header('🥇 الترتيب العام'));
    expect(header('✅ الأكثر حضوراً').getAttribute('aria-expanded')).toBe('true');
    expect(card('✅ الأكثر حضوراً').textContent).toContain('زيد احمد');
  });

  it('gives the other leaderboards the same header control', () => {
    render(<StatsScreen />);
    for (const title of ['🏆 الأكثر حفظاً للصفحات', '⚠️ يحتاجون متابعة', 'تفصيل الطلاب']) {
      expect(header(title).getAttribute('aria-expanded')).toBe('true');
    }
  });
});
