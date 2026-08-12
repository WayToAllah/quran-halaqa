import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { ParentPage } from './ParentPage';
import { MOCK_PUBLIC_STATS } from './mockPublicStats';
import type { PublicStats } from '../../types';

describe('ParentPage', () => {
  it('renders the child name, rank badge, and current task from preview stats', () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    expect(screen.getByText('زيد أحمد')).toBeInTheDocument();
    expect(screen.getByText(/المركز ٢ في الحضور/)).toBeInTheDocument();
    expect(screen.getByText('المهمة الحالية')).toBeInTheDocument();
    expect(screen.getAllByText(/آل عمران/).length).toBeGreaterThan(0);
  });

  it('shows a friendly not-found message when there is no token', () => {
    render(<ParentPage />);
    expect(screen.getByText(/الرابط غير صحيح/)).toBeInTheDocument();
  });

  it('calls the injected loader with the token and renders the result', async () => {
    const load = vi.fn().mockResolvedValue(MOCK_PUBLIC_STATS);
    render(<ParentPage token="abc123" load={load} />);
    await waitFor(() => expect(screen.getByText('زيد أحمد')).toBeInTheDocument());
    expect(load).toHaveBeenCalledWith('abc123');
  });

  it('shows the not-found state when the loader returns null', async () => {
    const load = vi.fn().mockResolvedValue(null);
    render(<ParentPage token="missing" load={load} />);
    await waitFor(() => expect(screen.getByText(/الرابط غير صحيح/)).toBeInTheDocument());
  });

  it('shows the failure state when the loader rejects', async () => {
    const load = vi.fn().mockRejectedValue(new Error('network'));
    render(<ParentPage token="x" load={load} />);
    await waitFor(() => expect(screen.getByText(/تعذّر تحميل التقرير/)).toBeInTheDocument());
  });

  it('exposes no share action and no write action (fully read-only)', () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    // Share was removed entirely — no button, no sheet, no WhatsApp/copy.
    expect(screen.queryByText('مشاركة')).not.toBeInTheDocument();
    expect(screen.queryByText('مشاركة تقرير الجلسة')).not.toBeInTheDocument();
    expect(screen.queryByText('واتساب')).not.toBeInTheDocument();
    expect(screen.queryByText('نسخ الرابط')).not.toBeInTheDocument();
    // Still no edit/save/delete controls — the page only ever reads.
    for (const label of ['حفظ', 'تعديل', 'حذف', 'إرسال']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('renders the new assignment and the session evaluations in separate sections', () => {
    // A record where today's session GRADED the previous homework (آل عمران)
    // but ASSIGNED new homework (الكهف). The page must show الكهف under the
    // "current task" section and the grade under the sessions timeline — never
    // presenting the grade as the new homework or vice versa.
    const stats: PublicStats = {
      ...MOCK_PUBLIC_STATS,
      currentTask: {
        date: '2026-07-09',
        newLoh: [{ sura: 'الكهف', from: '1', to: '20' }],
        newMadi: [],
      },
      recentSessions: [
        {
          date: '2026-07-09',
          loh: { score: 88 },
          madi: null,
          newLoh: [{ sura: 'الكهف', from: '1', to: '20' }],
          newMadi: [],
          note: '',
        },
      ],
    };
    render(<ParentPage previewStats={stats} />);

    // Both sections exist and are distinct headings.
    expect(screen.getByText('المهمة الحالية')).toBeInTheDocument();
    expect(screen.getByText('آخر الجلسات')).toBeInTheDocument();

    // The evaluation grade (٨٨) shows in the timeline, as a score — separate
    // from the assignment text.
    expect(screen.getByText('٨٨')).toBeInTheDocument();

    // The current-task section names the NEW assignment (الكهف), not the graded
    // homework — proving the score is not being surfaced as the assignment.
    expect(screen.getAllByText(/الكهف/).length).toBeGreaterThan(0);
  });
});

describe('ParentPage — dates', () => {
  it('shows the session date in both calendars, never as an ISO string', async () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    const iso = MOCK_PUBLIC_STATS.recentSessions[0].date;
    expect(screen.queryByText(iso)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت/).length,
    ).toBeGreaterThan(0);
  });

  it('labels the current task with a formatted date, not the stored one', () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    const label = screen.getByText(/آخر جلسة:/);
    expect(label.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('ParentPage — progress chart', () => {
  it('draws the chart without a trend caption underneath it', () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    // The chart itself and its legend stay.
    expect(screen.getByText('تقدّم آخر الجلسات')).toBeInTheDocument();
    // The verdict sentence that used to sit under the chart was removed on
    // request — a parent gets the line and the numbers, not a judgement.
    expect(screen.queryByText(/في تحسّن مستمر/)).not.toBeInTheDocument();
    expect(screen.queryByText(/محتاج تشجيع/)).not.toBeInTheDocument();
    expect(screen.queryByText(/مستقر/)).not.toBeInTheDocument();
  });

  it('prints the axis values so a non-zero floor cannot mislead', () => {
    // A chart whose baseline is 50 while looking like 0 exaggerates every
    // difference. The gridline labels are what make the scale honest.
    const { container } = render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    const texts = Array.from(container.querySelectorAll('svg text')).map((t) => t.textContent);
    expect(texts).toEqual(['١٠٠', '٨٠', '٦٠']);
  });

  it('marks an إعادة session and breaks the line instead of plunging to it', () => {
    const stats = {
      ...MOCK_PUBLIC_STATS,
      scoreHistory: [
        { date: '2026-07-01', loh: 90, madi: null },
        { date: '2026-07-03', loh: 0, madi: null },
        { date: '2026-07-05', loh: 85, madi: null },
      ],
    };
    const { container } = render(<ParentPage previewStats={stats} />);
    const paths = Array.from(container.querySelectorAll('svg path')).map(
      (p) => p.getAttribute('d') || '',
    );
    const line = paths.find((d) => d.includes('L') && (d.match(/M/g) || []).length === 2);
    expect(line).toBeTruthy(); // two subpaths = the line broke at the إعادة
    // ✕ marks are two crossing strokes; one إعادة means one such mark.
    const crosses = paths.filter((d) => (d.match(/M/g) || []).length === 2 && !d.includes(' L 1'));
    expect(crosses.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('إعادة').length).toBeGreaterThan(0);
  });

  it('hides withheld badges even when the stored publicStats document still has them', () => {
    // publicStats documents are written once and only rewritten when that
    // student is republished, so an already-stored ayat100/ayat200 must be
    // filtered out at render time — not left to wait for a republish.
    const stats: PublicStats = {
      ...MOCK_PUBLIC_STATS,
      badges: [
        { key: 'ayat100', icon: '📖', label: 'حافظ ١٠٠ آية' },
        { key: 'ayat200', icon: '📗', label: 'حافظ ٢٠٠ آية' },
        { key: 'ayat500', icon: '📘', label: 'حافظ ٥٠٠ آية' },
      ],
    };
    render(<ParentPage previewStats={stats} />);
    expect(screen.queryByText(/حافظ ١٠٠ آية/)).not.toBeInTheDocument();
    expect(screen.queryByText(/حافظ ٢٠٠ آية/)).not.toBeInTheDocument();
    expect(screen.getByText(/حافظ ٥٠٠ آية/)).toBeInTheDocument();
  });

  it('drops the whole badges card when every stored badge is withheld', () => {
    const stats: PublicStats = {
      ...MOCK_PUBLIC_STATS,
      badges: [
        { key: 'ayat100', icon: '📖', label: 'حافظ ١٠٠ آية' },
        { key: 'ayat200', icon: '📗', label: 'حافظ ٢٠٠ آية' },
      ],
    };
    render(<ParentPage previewStats={stats} />);
    expect(screen.queryByText('الأوسمة')).not.toBeInTheDocument();
  });
  // ── The grade word ─────────────────────────────────────────────────────
  it('prints the band name beside each score in the session list', () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    // 92 → ممتاز, 88 → جيد جداً; both appear in the timeline.
    expect(screen.getAllByText('ممتاز').length).toBeGreaterThan(0);
    expect(screen.getAllByText('جيد جداً').length).toBeGreaterThan(0);
  });

  // The grade is added to the existing sub-line, so the mistake tally must
  // still be there — one line carrying both, not the grade replacing it.
  it('keeps the mistake tally on the same line as the grade', () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    // The grade is its own <span> (it carries the band colour), so the line is
    // split across nodes — assert on the containing line's text, not a single
    // text node.
    const line = screen
      .getAllByText('ممتاز')
      .map((el) => el.parentElement?.textContent ?? '')
      .find((t) => t.includes('خطأ'));
    expect(line).toBe('ممتاز، ٢ خطأ، ١ خطأ تجويدي');
  });

  it('says إعادة under a failed session', () => {
    const session = (score: number) => ({
      date: '2026-07-09',
      loh: { score },
      madi: null,
      newLoh: [],
      newMadi: [],
      note: '',
    });
    // The chart legend prints إعادة unconditionally, so counting occurrences
    // against a passing baseline is the only honest assertion here — an
    // absolute count would go green with no grade rendered at all.
    const count = (score: number) => {
      const { unmount } = render(
        <ParentPage previewStats={{ ...MOCK_PUBLIC_STATS, recentSessions: [session(score)] }} />,
      );
      const n = screen.queryAllByText('إعادة').length;
      unmount();
      return n;
    };
    expect(count(0)).toBe(count(95) + 1);
  });

  // ── Ten sessions ───────────────────────────────────────────────────────
  it('renders all ten published sessions, not five', () => {
    const stats: PublicStats = {
      ...MOCK_PUBLIC_STATS,
      recentSessions: Array.from({ length: 10 }, (_, i) => ({
        date: '2026-07-' + String(20 - i).padStart(2, '0'),
        loh: { score: 80 },
        madi: null,
        newLoh: [],
        newMadi: [],
        note: 'جلسة رقم ' + (i + 1),
      })),
    };
    render(<ParentPage previewStats={stats} />);
    expect(screen.getByText('جلسة رقم 1')).toBeInTheDocument();
    expect(screen.getByText('جلسة رقم 10')).toBeInTheDocument();
  });

  // ── Month filter ───────────────────────────────────────────────────────
  const monthly: PublicStats = {
    ...MOCK_PUBLIC_STATS,
    attendPct: 88,
    attendedDays: 23,
    totalAyat: 1240,
    avgLoh: 86,
    monthlyStats: {
      '2026-06': { attendPct: 70, attendedDays: 7, totalAyat: 300, avgLoh: 78 },
      '2026-07': { attendPct: 92, attendedDays: 12, totalAyat: 540, avgLoh: 90 },
    },
  };

  it('offers no month filter for documents without monthly figures', () => {
    render(<ParentPage previewStats={{ ...MOCK_PUBLIC_STATS, monthlyStats: {} }} />);
    expect(screen.queryByRole('group', { name: /الشهر/ })).not.toBeInTheDocument();
  });

  it('swaps the four headline numbers when a month is picked', async () => {
    render(<ParentPage previewStats={monthly} />);
    expect(screen.getByText('٨٨٪')).toBeInTheDocument();
    const june = screen.getByRole('button', { name: /يونيو/ });
    june.click();
    await waitFor(() => expect(screen.getByText('٧٠٪')).toBeInTheDocument());
    expect(screen.getByText('٣٠٠')).toBeInTheDocument();
    expect(screen.queryByText('٨٨٪')).not.toBeInTheDocument();
  });

  // The chart and the timeline are deliberately outside the filter, so the
  // page has to say so rather than let the parent assume otherwise.
  it('explains that only the headline numbers are filtered', async () => {
    render(<ParentPage previewStats={monthly} />);
    expect(screen.queryByText(/الرسم\s+والجلسات تحت/)).not.toBeInTheDocument();
    screen.getByRole('button', { name: /يونيو/ }).click();
    await waitFor(() =>
      expect(
        screen.getByText(/فقط، والرسم\s+والجلسات تحت بيعرضوا الفترة كلها/),
      ).toBeInTheDocument(),
    );
  });

  it('returns to the all-time figures via الكل', async () => {
    render(<ParentPage previewStats={monthly} />);
    screen.getByRole('button', { name: /يونيو/ }).click();
    await waitFor(() => expect(screen.getByText('٧٠٪')).toBeInTheDocument());
    screen.getByRole('button', { name: 'الكل' }).click();
    await waitFor(() => expect(screen.getByText('٨٨٪')).toBeInTheDocument());
  });
});
