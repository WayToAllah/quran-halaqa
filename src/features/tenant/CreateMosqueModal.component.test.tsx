import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { CreateMosqueModal } from './CreateMosqueModal';

const createMosqueMock = vi.fn();
vi.mock('../../data/mosqueSetup.repo', () => ({
  createMosque: (...a: unknown[]) => createMosqueMock(...a),
}));

const onClose = vi.fn();
const onCreated = vi.fn();

function setup() {
  return render(
    <ToastProvider>
      <CreateMosqueModal ownerUid="uid_1" onClose={onClose} onCreated={onCreated} />
    </ToastProvider>,
  );
}

const nameBox = () => screen.getByLabelText('اسم المسجد');
const halaqaBoxes = () => screen.getAllByLabelText(/اسم الحلقة/);
const saveBtn = () => screen.getByRole('button', { name: 'إنشاء المسجد' });

beforeEach(() => {
  vi.clearAllMocks();
  createMosqueMock.mockResolvedValue({ mosqueId: 'm_1', halaqaId: 'h_1' });
});

describe('CreateMosqueModal', () => {
  it('starts with one halaqa row, because a mosque with none can never be opened', () => {
    setup();
    expect(halaqaBoxes()).toHaveLength(1);
  });

  it('adds and removes halaqa rows', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'إضافة حلقة' }));
    expect(halaqaBoxes()).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: 'حذف الحلقة' })[1]);
    expect(halaqaBoxes()).toHaveLength(1);
  });

  it('creates the mosque with everything the teacher typed', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(nameBox(), 'مسجد النور');
    await user.type(halaqaBoxes()[0], 'الحفظة');
    await user.click(screen.getByRole('button', { name: 'إضافة حلقة' }));
    await user.type(halaqaBoxes()[1], 'الناشئين');
    await user.click(saveBtn());

    await waitFor(() => expect(createMosqueMock).toHaveBeenCalledTimes(1));
    expect(createMosqueMock).toHaveBeenCalledWith(
      { mosqueName: 'مسجد النور', halaqaNames: ['الحفظة', 'الناشئين'] },
      'uid_1',
    );
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({ mosqueId: 'm_1', halaqaId: 'h_1' }),
    );
  });

  it('refuses to write anything the validator rejects', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(saveBtn());
    expect(await screen.findByText('اكتب اسم المسجد')).toBeInTheDocument();
    expect(createMosqueMock).not.toHaveBeenCalled();

    await user.type(nameBox(), 'مسجد النور');
    await user.click(saveBtn());
    expect(await screen.findByText('ضيف حلقة واحدة على الأقل')).toBeInTheDocument();
    expect(createMosqueMock).not.toHaveBeenCalled();
  });

  /**
   * The rules will reject a mosque created before they are deployed, and an
   * offline write never resolves at all. Either way the teacher must not be
   * left staring at a spinner believing it worked.
   */
  it('surfaces a rejected write instead of pretending it succeeded', async () => {
    createMosqueMock.mockRejectedValue(new Error('permission-denied'));
    const user = userEvent.setup();
    setup();
    await user.type(nameBox(), 'مسجد النور');
    await user.type(halaqaBoxes()[0], 'الحفظة');
    await user.click(saveBtn());

    expect(await screen.findByText(/تعذّر/)).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(saveBtn()).toBeEnabled();
  });

  it('cannot be submitted twice while the first write is in flight', async () => {
    let release: () => void = () => {};
    createMosqueMock.mockImplementation(
      () => new Promise((res) => (release = () => res({ mosqueId: 'm_1', halaqaId: 'h_1' }))),
    );
    const user = userEvent.setup();
    setup();
    await user.type(nameBox(), 'مسجد النور');
    await user.type(halaqaBoxes()[0], 'الحفظة');
    await user.click(saveBtn());

    expect(saveBtn()).toBeDisabled();
    release();
    await waitFor(() => expect(createMosqueMock).toHaveBeenCalledTimes(1));
  });

  it('closes without writing anything', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(onClose).toHaveBeenCalled();
    expect(createMosqueMock).not.toHaveBeenCalled();
  });
});
