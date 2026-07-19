import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { NiyyatModal } from './NiyyatModal';

function renderModal(niyyat: string[], onSave = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  return {
    onSave,
    onClose,
    ...render(
      <ToastProvider>
        <NiyyatModal niyyat={niyyat} onSave={onSave} onClose={onClose} />
      </ToastProvider>,
    ),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('NiyyatModal', () => {
  it('pre-fills existing niyyat, one row each', () => {
    renderModal(['نية ١', 'نية ٢']);
    expect((screen.getByDisplayValue('نية ١') as HTMLInputElement)).toBeInTheDocument();
    expect((screen.getByDisplayValue('نية ٢') as HTMLInputElement)).toBeInTheDocument();
  });

  it('starts with one empty row when there are no niyyat, and warns about the fallback', () => {
    renderModal([]);
    expect(screen.getByPlaceholderText('اكتب نية…')).toBeInTheDocument();
    // The empty-state hint about the default verse is shown.
    expect(screen.getByText(/نص افتراضي/)).toBeInTheDocument();
  });

  it('adds a new row when "إضافة نية" is tapped', async () => {
    const user = userEvent.setup();
    renderModal(['نية ١']);
    expect(screen.getAllByPlaceholderText('اكتب نية…')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '+ إضافة نية' }));
    expect(screen.getAllByPlaceholderText('اكتب نية…')).toHaveLength(2);
  });

  it('saves the cleaned list (trims + drops blanks + de-dupes)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal(['  نية ١  ', '', 'نية ١', 'نية ٢'], onSave);
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onSave).toHaveBeenCalledWith(['نية ١', 'نية ٢']);
  });

  it('removes a row via its delete button', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal(['نية ١', 'نية ٢'], onSave);
    const deleteButtons = screen.getAllByRole('button', { name: 'حذف النية' });
    await user.click(deleteButtons[0]); // remove نية ١
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onSave).toHaveBeenCalledWith(['نية ٢']);
  });

  it('allows saving an empty list (falls back to default verse in the bar)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal([''], onSave);
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it('closes on cancel without saving', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal(['نية']);
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
