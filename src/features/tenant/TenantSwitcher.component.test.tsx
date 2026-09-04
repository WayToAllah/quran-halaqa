import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { TenantSwitcher } from './TenantSwitcher';
import { TenantProvider, useTenant } from './TenantContext';
import { DraftGuardProvider, useReportDraft } from './DraftGuard';
import type { TenantOption } from '../../domain/memberships';

let options: TenantOption[] = [];
let loading = false;
const useMembershipsMock = vi.fn(() => ({ options, loading }));
vi.mock('../../hooks/useMemberships', () => ({
  useMemberships: (...a: unknown[]) => useMembershipsMock(...(a as [])),
}));

const opt = (
  mosqueId: string,
  mosqueName: string,
  halaqaId: string,
  halaqaName: string,
): TenantOption => ({ mosqueId, mosqueName, halaqaId, halaqaName });

const TAYSEER = opt('altayseer', 'مسجد التيسير', 'main', 'الحلقة');
const NOUR = opt('alnour', 'مسجد النور', 'h1', 'الحفظة');

function Probe() {
  const { mosqueId, halaqaId } = useTenant();
  return <span data-testid="now">{`${mosqueId}/${halaqaId}`}</span>;
}

function Draft({ dirty }: { dirty: boolean }) {
  useReportDraft(dirty);
  return null;
}

function setup({ dirty = false }: { dirty?: boolean } = {}) {
  return render(
    <TenantProvider initial={{ mosqueId: 'altayseer', halaqaId: 'main' }}>
      <DraftGuardProvider>
        <Draft dirty={dirty} />
        <TenantSwitcher uid="uid_1" />
        <Probe />
      </DraftGuardProvider>
    </TenantProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  loading = false;
  options = [TAYSEER, NOUR];
});

describe('TenantSwitcher', () => {
  // A teacher with one halaqa must not pay for a feature they can't use: no
  // control, no dead chrome in a header that is already tight on a phone.
  it('renders nothing at all when there is only one place to go', () => {
    options = [TAYSEER];
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing while the list is still loading', () => {
    loading = true;
    options = [];
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the mosque currently open', () => {
    setup();
    expect(screen.getByRole('button', { name: /مسجد التيسير/ })).toBeInTheDocument();
  });

  it('switches to the chosen halaqa', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /مسجد التيسير/ }));
    await user.click(await screen.findByRole('button', { name: /مسجد النور/ }));

    await waitFor(() => expect(screen.getByTestId('now')).toHaveTextContent('alnour/h1'));
  });

  /**
   * Every screen stays mounted, so a half-typed session survives a mosque
   * switch and would be saved under the wrong halaqa with a studentId that
   * doesn't exist there. Warn before moving, and let the teacher back out.
   */
  it('warns instead of switching when a session is half-typed', async () => {
    const user = userEvent.setup();
    setup({ dirty: true });
    await user.click(screen.getByRole('button', { name: /مسجد التيسير/ }));
    await user.click(await screen.findByRole('button', { name: /مسجد النور/ }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByTestId('now')).toHaveTextContent('altayseer/main');
  });

  it('keeps the teacher where they were when they back out of the warning', async () => {
    const user = userEvent.setup();
    setup({ dirty: true });
    await user.click(screen.getByRole('button', { name: /مسجد التيسير/ }));
    await user.click(await screen.findByRole('button', { name: /مسجد النور/ }));
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('now')).toHaveTextContent('altayseer/main');
  });

  it('moves once the teacher confirms they are giving the session up', async () => {
    const user = userEvent.setup();
    setup({ dirty: true });
    await user.click(screen.getByRole('button', { name: /مسجد التيسير/ }));
    await user.click(await screen.findByRole('button', { name: /مسجد النور/ }));
    await user.click(screen.getByRole('button', { name: 'بدّل وامسح' }));

    await waitFor(() => expect(screen.getByTestId('now')).toHaveTextContent('alnour/h1'));
  });

  it('closes without moving when the open mosque is re-picked', async () => {
    const user = userEvent.setup();
    setup({ dirty: true });
    await user.click(screen.getByRole('button', { name: /مسجد التيسير/ }));
    // Picking what is already open is not a switch, so it must not warn.
    const items = await screen.findAllByRole('button', { name: /مسجد التيسير/ });
    await user.click(items[items.length - 1]);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('now')).toHaveTextContent('altayseer/main');
  });
});
