import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { LoginScreen } from './LoginScreen';
import { TenantProvider, useTenant } from '../tenant/TenantContext';
import { DEFAULT_TENANT } from '../../config';
import { TENANT_STORAGE_KEY, rememberTenant } from '../../data/tenantStore';
import type { AuthState } from './useAuth';

function deniedAuth(): AuthState {
  return {
    status: 'denied',
    user: null,
    member: null,
    offlineSession: false,
    signIn: vi.fn(),
    signOutUser: vi.fn(),
    retry: vi.fn(),
  } as unknown as AuthState;
}

function Probe() {
  const { mosqueId } = useTenant();
  return <span data-testid="now">{mosqueId}</span>;
}

function setup(initial?: { mosqueId: string; halaqaId: string }) {
  return render(
    <TenantProvider initial={initial}>
      <LoginScreen auth={deniedAuth()} />
      <Probe />
    </TenantProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

/**
 * The device remembers the last mosque it was pointed at. If that mosque is one
 * the signed-in account has no membership in, useAuth lands on 'denied' — and
 * before this there was no way out but clearing browser data, because signing
 * in again just returned to the same remembered mosque.
 */
describe('LoginScreen — escaping a remembered mosque', () => {
  it('offers a way back when the remembered mosque is not the default', () => {
    setup({ mosqueId: 'alnour', halaqaId: 'h1' });
    expect(screen.getByRole('button', { name: /المسجد الافتراضي/ })).toBeInTheDocument();
  });

  it('does not offer it when the account is simply not a member anywhere', () => {
    setup(DEFAULT_TENANT);
    expect(screen.queryByRole('button', { name: /المسجد الافتراضي/ })).not.toBeInTheDocument();
  });

  it('returns to the default and forgets the stored choice', async () => {
    const user = userEvent.setup();
    rememberTenant({ mosqueId: 'alnour', halaqaId: 'h1' });
    setup({ mosqueId: 'alnour', halaqaId: 'h1' });

    await user.click(screen.getByRole('button', { name: /المسجد الافتراضي/ }));

    await waitFor(() =>
      expect(screen.getByTestId('now')).toHaveTextContent(DEFAULT_TENANT.mosqueId),
    );
    // Forgotten, not just changed in memory — otherwise the next launch would
    // walk straight back into the same dead end.
    expect(localStorage.getItem(TENANT_STORAGE_KEY)).toBeNull();
  });

  it('still offers signing out as a separate way forward', () => {
    setup({ mosqueId: 'alnour', halaqaId: 'h1' });
    expect(screen.getByRole('button', { name: /حساب آخر/ })).toBeInTheDocument();
  });
});
