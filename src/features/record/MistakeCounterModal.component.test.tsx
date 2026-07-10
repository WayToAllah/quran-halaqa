import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { MistakeCounterModal } from './MistakeCounterModal';
import type { MistakeKind } from '../../domain/mistakes';

function renderModal(opts: { initialHistory?: MistakeKind[] } = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <MistakeCounterModal
      label="اللوح"
      suraInfo="سورة البقرة (1–10)"
      initialHistory={opts.initialHistory ?? []}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose, ...result };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MistakeCounterModal', () => {
  it('starts at 100 with the sura info shown', () => {
    renderModal();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('سورة البقرة (1–10)')).toBeInTheDocument();
  });

  it('subtracts 1 for a full mistake', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText('➖ خطأ'));
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('subtracts 0.5 for a tajweed mistake and shows the half', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText('➖ خطأ تجويدي'));
    expect(screen.getByText('99.5')).toBeInTheDocument();
  });

  it('undo removes the last mistake', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText('➖ خطأ'));
    await user.click(screen.getByText('➖ خطأ'));
    expect(screen.getByText('98')).toBeInTheDocument();
    await user.click(screen.getByText('↩️ تراجع عن آخر خطأ'));
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('reset returns to 100', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText('➖ خطأ'));
    await user.click(screen.getByText('🔄 إعادة من الصفر'));
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('undo/reset are disabled when there are no mistakes', () => {
    renderModal();
    expect(screen.getByText('↩️ تراجع عن آخر خطأ')).toBeDisabled();
    expect(screen.getByText('🔄 إعادة من الصفر')).toBeDisabled();
  });

  it('reopens preserving the initial history', () => {
    renderModal({ initialHistory: ['full', 'full', 'tajweed'] });
    // 100 - 2 - 0.5 = 97.5
    expect(screen.getByText('97.5')).toBeInTheDocument();
  });

  it('save commits the rounded score and the history', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();
    await user.click(screen.getByText('➖ خطأ تجويدي')); // 99.5 -> rounds to 100
    await user.click(screen.getByText('✓ حفظ الدرجة'));
    expect(onSave).toHaveBeenCalledWith(100, ['tajweed']);
    expect(onClose).toHaveBeenCalled();
  });

  it('two tajweed mistakes commit an actual drop', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    await user.click(screen.getByText('➖ خطأ تجويدي'));
    await user.click(screen.getByText('➖ خطأ تجويدي'));
    await user.click(screen.getByText('✓ حفظ الدرجة'));
    expect(onSave).toHaveBeenCalledWith(99, ['tajweed', 'tajweed']);
  });
});
