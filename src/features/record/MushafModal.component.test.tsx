import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { MushafModal } from './MushafModal';
import type { SuraAssignment } from '../../types';

function renderModal(opts: { list?: SuraAssignment[]; token?: string } = {}) {
  const onCount = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <MushafModal
      label="اللوح"
      list={opts.list ?? [{ sura: 'النبأ', from: '1', to: '40' }]}
      studentName="زيد احمد"
      token={opts.token ?? 'r_9'}
      onCount={onCount}
      onClose={onClose}
    />,
  );
  return { onCount, onClose, ...result };
}

function postFromViewer(data: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MushafModal', () => {
  it('opens the viewer on the ward being recited', () => {
    renderModal();
    const frame = screen.getByTestId('mushaf-frame') as HTMLIFrameElement;
    expect(frame.getAttribute('src')).toContain(`a=${encodeURIComponent('النبأ')}:1:40`);
    expect(frame.getAttribute('src')).toContain('id=r_9');
  });

  it('shows the student and which ward is open', () => {
    renderModal();
    expect(screen.getByText('زيد احمد')).toBeInTheDocument();
    expect(screen.getByText('اللوح')).toBeInTheDocument();
  });

  it('hands the count back and closes when the viewer reports it', async () => {
    const { onCount, onClose } = renderModal();
    postFromViewer({ type: 'mushaf-count', id: 'r_9', count: 6 });
    await waitFor(() => expect(onCount).toHaveBeenCalledWith(6));
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores a count meant for a different open', async () => {
    const { onCount } = renderModal({ token: 'r_9' });
    postFromViewer({ type: 'mushaf-count', id: 'r_OLD', count: 3 });
    await new Promise((r) => setTimeout(r, 10));
    expect(onCount).not.toHaveBeenCalled();
  });

  it('ignores unrelated messages on the window', async () => {
    const { onCount } = renderModal();
    postFromViewer({ type: 'other', id: 'r_9', count: 3 });
    await new Promise((r) => setTimeout(r, 10));
    expect(onCount).not.toHaveBeenCalled();
  });

  it('reports the count once even if the message arrives twice', async () => {
    const { onCount } = renderModal();
    postFromViewer({ type: 'mushaf-count', id: 'r_9', count: 2 });
    postFromViewer({ type: 'mushaf-count', id: 'r_9', count: 5 });
    await waitFor(() => expect(onCount).toHaveBeenCalledTimes(1));
    expect(onCount).toHaveBeenCalledWith(2);
  });

  it('closes without a count when the teacher backs out', async () => {
    const user = userEvent.setup();
    const { onClose, onCount } = renderModal();
    await user.click(screen.getByLabelText('إغلاق المصحف'));
    expect(onClose).toHaveBeenCalled();
    expect(onCount).not.toHaveBeenCalled();
  });

  it('renders nothing when there is no ward to open', () => {
    const { container } = renderModal({ list: [] });
    expect(container.querySelector('[data-testid="mushaf-frame"]')).toBeNull();
  });
});
