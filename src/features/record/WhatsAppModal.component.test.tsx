import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { WhatsAppModal } from './WhatsAppModal';

function renderModal(phone: string, onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <ToastProvider>
        <WhatsAppModal message="رسالة تجريبية" phone={phone} onClose={onClose} />
      </ToastProvider>,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  vi.stubGlobal('open', vi.fn());
});

describe('WhatsAppModal', () => {
  it('shows the message preview', () => {
    renderModal('201012345678');
    expect(screen.getByText('رسالة تجريبية')).toBeInTheDocument();
  });

  it('shows the send button when a phone number is known', () => {
    renderModal('201012345678');
    expect(screen.getByRole('button', { name: /إرسال واتساب/ })).toBeInTheDocument();
  });

  it('hides the send button when no phone number is known', () => {
    renderModal('');
    expect(screen.queryByRole('button', { name: /إرسال واتساب/ })).not.toBeInTheDocument();
  });

  it('copies the message to the clipboard', async () => {
    renderModal('201012345678');
    await userEvent.click(screen.getByRole('button', { name: 'نسخ' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('رسالة تجريبية');
  });

  it('opens a wa.me link with the encoded message and closes on send', async () => {
    const { onClose } = renderModal('201012345678');
    await userEvent.click(screen.getByRole('button', { name: /إرسال واتساب/ }));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/201012345678?text='),
      '_blank',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when "تخطي" is clicked', async () => {
    const { onClose } = renderModal('201012345678');
    await userEvent.click(screen.getByRole('button', { name: 'تخطي' }));
    expect(onClose).toHaveBeenCalled();
  });
});
