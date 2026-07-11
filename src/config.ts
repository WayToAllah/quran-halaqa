/**
 * Hardcoded for now: مسجد التيسير is the only tenant in the system today
 * (see PROJECT_CONTEXT.md §10 and scripts/migrate-rtdb-to-firestore.ts's
 * defaults, which write to exactly this mosque/halaqa). A mosque-switcher UI
 * only makes sense once there's a second mosque to switch to.
 */
export const MOSQUE_ID = 'altayseer';
export const HALAQA_ID = 'main';

/**
 * Base URL of the public parent progress page. Points at the v2 portal
 * (/v2/child.html, reads publicStats from Firestore over REST). Single source
 * of truth so the WhatsApp message and the copy-link button can never drift
 * apart — append `?t=${parentToken}` to build a family's link.
 */
export const CHILD_STATS_BASE_URL = 'https://waytoallah.github.io/quran-halaqa/v2/child.html';
