import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { TenantSwitcher } from './TenantSwitcher';
import { TenantProvider, useTenant } from './TenantContext';
import { DraftGuardProvider } from './DraftGuard';
import type { TenantOption } from '../../domain/memberships';

// Renaming a mosque or halaqa, and adding a halaqa to a mosque that exists,
// from the switcher — there was no way to do either after creation.

let options: TenantOption[] = [];
const reload = vi.fn();
vi.mock('../../hooks/useMemberships', () => ({
  useMemberships: () => ({ options, loading: false, reload }),
}));
const renameMosque = vi.fn().mockResolvedValue(undefined);
const renameHalaqa = vi.fn().mockResolvedValue(undefined);
const addHalaqa = vi.fn().mockResolvedValue('h_new');
vi.mock('../../data/mosques.repo', () => ({
  renameMosque: (...a: unknown[]) => renameMosque(...a),
  renameHalaqa: (...a: unknown[]) => renameHalaqa(...a),
  addHalaqa: (...a: unknown[]) => addHalaqa(...a),
}));

const NOUR: TenantOption = {
  mosqueId: 'alnour',
  mosqueName: 'مسجد النور',
  halaqaId: 'h1',
  halaqaName: 'الحلقة الرئيسية',
  ownerUid: 'uid_1',
};

function Probe() {
  const { mosqueId, halaqaId } = useTenant();
  return <span data-testid="now">{`${mosqueId}/${halaqaId}`}</span>;
}

function setup(uid = 'uid_1') {
  return render(
    <ToastProvider>
      <TenantProvider initial={{ mosqueId: 'alnour', halaqaId: 'h1' }}>
        <DraftGuardProvider>
          <TenantSwitcher uid={uid} />
          <Probe />
        </DraftGuardProvider>
      </TenantProvider>
    </ToastProvider>,
  );
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /مسجد النور/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  options = [NOUR];
});

describe('TenantSwitcher — names', () => {
  it('lets the owner rename both the mosque and the halaqa', async () => {
    const user = userEvent.setup();
    setup();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'تعديل مسجد النور — الحلقة الرئيسية' }));

    const mosque = screen.getByLabelText('اسم المسجد');
    const halaqa = screen.getByLabelText('اسم الحلقة');
    expect(mosque).toHaveValue('مسجد النور');
    expect(halaqa).toHaveValue('الحلقة الرئيسية');

    await user.clear(mosque);
    await user.type(mosque, 'مسجد النور الكبير');
    await user.clear(halaqa);
    await user.type(halaqa, 'حلقة الفجر');
    await user.click(screen.getByRole('button', { name: 'حفظ' }));

    await waitFor(() => expect(renameMosque).toHaveBeenCalledWith('alnour', 'مسجد النور الكبير'));
    expect(renameHalaqa).toHaveBeenCalledWith('alnour', 'h1', 'حلقة الفجر');
    expect(reload).toHaveBeenCalled();
    expect(screen.queryByLabelText('اسم الحلقة')).not.toBeInTheDocument();
  });

  it('only writes what changed', async () => {
    const user = userEvent.setup();
    setup();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: /^تعديل / }));
    const halaqa = screen.getByLabelText('اسم الحلقة');
    await user.clear(halaqa);
    await user.type(halaqa, 'حلقة العصر');
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() => expect(renameHalaqa).toHaveBeenCalledTimes(1));
    expect(renameMosque).not.toHaveBeenCalled();
  });

  it('shows only the halaqa name to a teacher who does not own the mosque', async () => {
    const user = userEvent.setup();
    setup('someone_else');
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: /^تعديل / }));
    expect(screen.queryByLabelText('اسم المسجد')).not.toBeInTheDocument();
    expect(screen.getByLabelText('اسم الحلقة')).toBeInTheDocument();
  });

  it('refuses a blank name', async () => {
    const user = userEvent.setup();
    setup();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: /^تعديل / }));
    await user.clear(screen.getByLabelText('اسم الحلقة'));
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(await screen.findByText('اكتب اسم الحلقة')).toBeInTheDocument();
    expect(renameHalaqa).not.toHaveBeenCalled();
  });

  it('adds a halaqa to the current mosque and opens it', async () => {
    const user = userEvent.setup();
    setup();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: '＋ حلقة جديدة في مسجد النور' }));
    await user.type(screen.getByLabelText('اسم الحلقة'), 'حلقة البنات');
    await user.click(screen.getByRole('button', { name: 'إضافة الحلقة' }));

    await waitFor(() => expect(addHalaqa).toHaveBeenCalledWith('alnour', 'حلقة البنات'));
    expect(reload).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('now')).toHaveTextContent('alnour/h_new'));
  });
});
