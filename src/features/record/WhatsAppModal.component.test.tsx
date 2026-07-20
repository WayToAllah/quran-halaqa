import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { WhatsAppModal } from './WhatsAppModal';

function renderModal(
  phone: string,
  opts: { isEditing?: boolean; busy?: boolean } = {},
) {
  const onBack = vi.fn();
  const onSaveOnly = vi.fn();
  const onSaveAndSend = vi.fn();
  return {
    onBack,
    onSaveOnly,
    onSaveAndSend,
    ...render(
      <ToastProvider>
        <WhatsAppModal
          message="رسالة تجريبية"
          phone={phone}
          busy={opts.busy ?? false}
          isEditing={opts.isEditing ?? false}
          onBack={onBack}
          onSaveOnly={onSaveOnly}
          onSaveAndSend={onSaveAndSend}
        />
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
});

describe('WhatsAppModal (preview-before-save)', () => {
  it('shows the message preview and the "nothing saved yet" note', () => {
    renderModal('201012345678');
    expect(screen.getByText('رسالة تجريبية')).toBeInTheDocument();
    expect(screen.getByText(/لسه مفيش حاجة اتحفظت/)).toBeInTheDocument();
  });

  it('primary button saves AND sends when a phone number is known', async () => {
    const { onSaveAndSend } = renderModal('201012345678');
    await userEvent.click(screen.getByRole('button', { name: /احفظ وأرسل واتساب/ }));
    expect(onSaveAndSend).toHaveBeenCalledOnce();
  });

  it('offers a save-only option when a phone number is known', async () => {
    const { onSaveOnly } = renderModal('201012345678');
    await userEvent.click(screen.getByRole('button', { name: 'احفظ بدون إرسال' }));
    expect(onSaveOnly).toHaveBeenCalledOnce();
  });

  it('with no phone number, the primary button just saves (no send option)', async () => {
    const { onSaveOnly } = renderModal('');
    expect(screen.queryByText('احفظ بدون إرسال')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /واتساب/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /احفظ الجلسة/ }));
    expect(onSaveOnly).toHaveBeenCalledOnce();
  });

  it('back button goes to editing without saving', async () => {
    const { onBack, onSaveOnly, onSaveAndSend } = renderModal('201012345678');
    await userEvent.click(screen.getByRole('button', { name: /رجوع للتعديل/ }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSaveOnly).not.toHaveBeenCalled();
    expect(onSaveAndSend).not.toHaveBeenCalled();
  });

  it('uses "حدّث" wording in edit mode', () => {
    renderModal('201012345678', { isEditing: true });
    expect(screen.getByRole('button', { name: /حدّث وأرسل واتساب/ })).toBeInTheDocument();
  });

  it('disables the actions while a save is in flight', () => {
    renderModal('201012345678', { busy: true });
    const primary = screen.getByRole('button', { name: /جاري الحفظ/ });
    expect(primary).toBeDisabled();
  });

  it('copies the message to the clipboard', async () => {
    renderModal('201012345678');
    await userEvent.click(screen.getByRole('button', { name: /نسخ النص/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('رسالة تجريبية');
  });
});
