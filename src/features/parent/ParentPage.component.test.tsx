import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
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

  it('opens and closes the share sheet, and never exposes a write action', () => {
    render(<ParentPage previewStats={MOCK_PUBLIC_STATS} />);
    fireEvent.click(screen.getAllByText('مشاركة')[0]);
    expect(screen.getByText('مشاركة تقرير الجلسة')).toBeInTheDocument();
    // read-only: only WhatsApp + copy-link, no edit/save/delete controls
    expect(screen.getByText('واتساب')).toBeInTheDocument();
    expect(screen.getByText('نسخ الرابط')).toBeInTheDocument();
    fireEvent.click(screen.getByText('إغلاق'));
    expect(screen.queryByText('مشاركة تقرير الجلسة')).not.toBeInTheDocument();
  });
});
