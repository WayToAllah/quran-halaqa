/**
 * Hardcoded for now: مسجد التيسير is the only tenant in the system today
 * (see PROJECT_CONTEXT.md §10 and scripts/migrate-rtdb-to-firestore.ts's
 * defaults, which write to exactly this mosque/halaqa). A mosque-switcher UI
 * only makes sense once there's a second mosque to switch to.
 */
export const MOSQUE_ID = 'altayseer';
export const HALAQA_ID = 'main';
