import type { Tenant } from './domain/tenant';

/**
 * The mosque/halaqa the app opens on when this device has never picked one.
 *
 * These used to be `MOSQUE_ID` / `HALAQA_ID`, imported directly by every screen
 * — which made "work with a second mosque" a rebuild rather than a state
 * change. They are now only a *default*: the live value comes from
 * `useTenant()` (see `src/features/tenant/TenantContext.tsx`), which reads the
 * device's stored selection and falls back to this.
 *
 * مسجد التيسير stays the default because it is the halaqa that exists today and
 * the one this device is used for; a returning teacher must never have to pick.
 */
export const DEFAULT_TENANT: Tenant = {
  mosqueId: 'altayseer',
  halaqaId: 'main',
};

/**
 * Base URL of the public parent progress page. Points at the v2 portal
 * (/v2/child.html, reads publicStats from Firestore over REST). Single source
 * of truth so the WhatsApp message and the copy-link button can never drift
 * apart — append `?t=${parentToken}` to build a family's link.
 */
export const CHILD_STATS_BASE_URL = 'https://waytoallah.github.io/quran-halaqa/v2/child.html';
