import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { TenantProvider, useTenant, useTenantControls } from './TenantContext';
import { DEFAULT_TENANT } from '../../config';
import { TENANT_STORAGE_KEY, rememberTenant } from '../../data/tenantStore';
import type { Tenant } from '../../domain/tenant';

const OTHER: Tenant = { mosqueId: 'alnour', halaqaId: 'nashieen' };

function Probe() {
  const { mosqueId, halaqaId } = useTenant();
  return <span data-testid="probe">{`${mosqueId}/${halaqaId}`}</span>;
}

function Switcher({ to }: { to: unknown }) {
  const { setTenant } = useTenantControls();
  return (
    <button onClick={() => setTenant(to as Tenant)} type="button">
      switch
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('TenantProvider', () => {
  it('falls back to the configured default when nothing is stored', () => {
    render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `${DEFAULT_TENANT.mosqueId}/${DEFAULT_TENANT.halaqaId}`,
    );
  });

  it('restores the tenant this device last used', () => {
    rememberTenant(OTHER);
    render(
      <TenantProvider>
        <Probe />
      </TenantProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('alnour/nashieen');
  });

  it('an explicit initial prop wins over storage', () => {
    rememberTenant(OTHER);
    render(
      <TenantProvider initial={{ mosqueId: 'x', halaqaId: 'y' }}>
        <Probe />
      </TenantProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('x/y');
  });

  it('switching updates every consumer and persists the choice', async () => {
    const user = userEvent.setup();
    render(
      <TenantProvider>
        <Probe />
        <Switcher to={OTHER} />
      </TenantProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'switch' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('alnour/nashieen');
    expect(localStorage.getItem(TENANT_STORAGE_KEY)).toContain('alnour');
  });

  // An id with a slash would re-path the Firestore reference into a different
  // collection. Refusing to move is the safe failure: the app keeps reading the
  // mosque it was already on instead of silently pointing somewhere else.
  it('refuses an invalid tenant and stays put', async () => {
    const user = userEvent.setup();
    render(
      <TenantProvider>
        <Probe />
        <Switcher to={{ mosqueId: 'a/b', halaqaId: 'main' }} />
      </TenantProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'switch' }));
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `${DEFAULT_TENANT.mosqueId}/${DEFAULT_TENANT.halaqaId}`,
    );
    expect(localStorage.getItem(TENANT_STORAGE_KEY)).toBeNull();
  });
});

describe('outside a provider', () => {
  // Reading falls back to the single configured tenant, which is exactly what
  // the old build-time constants did — so no existing screen changes behaviour.
  it('useTenant reads the configured default', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent(
      `${DEFAULT_TENANT.mosqueId}/${DEFAULT_TENANT.halaqaId}`,
    );
  });

  // Writing does not get a silent fallback: a switcher rendered outside the
  // provider would appear to work and change nothing.
  it('useTenantControls throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Switcher to={OTHER} />)).toThrow(/TenantProvider/);
    spy.mockRestore();
  });
});
