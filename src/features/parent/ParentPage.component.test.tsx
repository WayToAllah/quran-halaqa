import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { ParentPage } from './ParentPage';
import { MOCK_PUBLIC_STATS } from './mockPublicStats';

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
});
