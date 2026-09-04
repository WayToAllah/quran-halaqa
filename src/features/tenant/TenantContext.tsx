import { createContext } from 'preact';
import { useCallback, useContext, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { DEFAULT_TENANT } from '../../config';
import { isTenant, sameTenant, type Tenant } from '../../domain/tenant';
import { recallTenant, rememberTenant } from '../../data/tenantStore';

export interface TenantControls {
  tenant: Tenant;
  /** Ignores anything that isn't a valid tenant; see the comment on setTenant. */
  setTenant: (next: Tenant) => void;
}

/**
 * `null` means "no provider above me", which the two hooks treat differently
 * on purpose:
 *
 *   - `useTenant()` falls back to DEFAULT_TENANT. That is precisely what the
 *     old build-time `MOSQUE_ID`/`HALAQA_ID` constants did, so no existing
 *     screen (or component test rendering one in isolation) changes behaviour.
 *   - `useTenantControls()` throws. A switcher rendered outside the provider
 *     would otherwise appear to work and change nothing — a silent no-op is a
 *     far worse failure than a loud one.
 */
const TenantCtx = createContext<TenantControls | null>(null);

export function TenantProvider({
  initial,
  children,
}: {
  initial?: Tenant;
  children: ComponentChildren;
}) {
  // Resolved once, on mount: an explicit prop (tests, deep links) wins, then
  // this device's last choice, then the configured default.
  const [tenant, setTenantState] = useState<Tenant>(
    () => initial ?? recallTenant() ?? DEFAULT_TENANT,
  );

  const setTenant = useCallback((next: Tenant) => {
    // A tenant id is about to become user-influenced (a teacher creating their
    // own mosque). An id containing `/` would silently re-path every Firestore
    // reference into a different collection, so an invalid value must not move
    // the app: staying on the current mosque is the safe failure.
    if (!isTenant(next)) {
      console.warn('setTenant: ignoring invalid tenant', next);
      return;
    }
    setTenantState((current) => {
      if (sameTenant(current, next)) return current;
      rememberTenant(next);
      return next;
    });
  }, []);

  const value = useMemo<TenantControls>(() => ({ tenant, setTenant }), [tenant, setTenant]);

  return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>;
}

/** The mosque/halaqa every read and write in the admin app is scoped to. */
export function useTenant(): Tenant {
  return useContext(TenantCtx)?.tenant ?? DEFAULT_TENANT;
}

/** Read + switch. Throws outside a TenantProvider — see the note on TenantCtx. */
export function useTenantControls(): TenantControls {
  const ctx = useContext(TenantCtx);
  if (!ctx) throw new Error('useTenantControls must be used inside a TenantProvider');
  return ctx;
}
