// ============================================================================
// Core data model types — deliberately mirror the exact shape of the live
// Firebase data (see PROJECT_CONTEXT.md §4 in the current production repo).
// No shape changes here; this is a 1:1 port so existing data needs zero
// migration transformation for these fields.
// ============================================================================

export interface Student {
  id: string;
  name: string;
  age?: string;
  grade?: string;
  school?: string;
  phoneType?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  /** ISO date (YYYY-MM-DD) the student joined the halaqa. Optional — many
   * legacy students predate this field being collected. */
  joinDate?: string;
  /** Random high-entropy token used in child.html?t={parentToken} links. */
  parentToken?: string;
}

/** A single sura assignment. Two mutually-exclusive shapes:
 *  - per-sura mode: `sura` + optional ayah range (`from`/`to`).
 *  - whole-sura range mode: `range: true` + `sura` (start) + `toSura` (end),
 *    meaning "from sura X through sura Y" with no ayah numbers. Matches the
 *    production {sura, toSura, range:true} shape so records written by the live
 *    index.html app read back identically here. */
export interface SuraAssignment {
  sura: string;
  from?: string;
  to?: string;
  /** End sura for a whole-sura range (only meaningful when `range` is true). */
  toSura?: string;
  /** True when this is a whole-sura range (`sura`..`toSura`), not an ayah range. */
  range?: boolean;
}

/** Evaluation of a *previous* session's assignment. `score` is null/undefined
 * when nothing has been evaluated yet — distinct from a genuine zero grade.
 * Never use a plain truthy check on `.score` (0 is falsy in JS); use hasScore(). */
/** Tally of mistakes recorded via the mistake counter for one evaluation.
 * Present only when the counter was actually used for that evaluation —
 * scores entered by hand carry no `mistakes` field at all (so old records
 * are never backfilled with empty {full:0, tajweed:0}). Ported verbatim
 * from the live index.html's mistakesSummary() contract. */
export interface MistakeTally {
  full: number;
  tajweed: number;
}

export interface ScoreEval {
  score?: number | null;
  stars?: number;
  mistakes?: MistakeTally;
}

export interface TajweedEval {
  sura?: string;
  from?: string;
  to?: string;
  score?: number;
  stars?: number;
  note?: string;
}

export interface SessionRecord {
  id: string;
  studentId?: string;
  /** Display-name snapshot at save time; studentId is authoritative for matching. */
  student?: string;
  date: string; // 'YYYY-MM-DD', local (Cairo) time
  loh?: ScoreEval;
  madi?: ScoreEval;
  newLoh?: SuraAssignment[];
  newMadi?: SuraAssignment[];
  tajweed?: TajweedEval;
  note?: string;
  attendance_only?: boolean;
  /** UID of the teacher who actually saved this session. Any member of the
   * mosque can record in any halaqa (so a substitute can cover an absent
   * teacher), so this records who did — useful when the primary teacher
   * later reviews a session they didn't run. Absent on pre-feature records. */
  recordedBy?: string;
}

// ============================================================================
// Multi-tenant hierarchy (Phase 2 — Firestore). A mosque owns one or more
// halaqat (memorization circles); each halaqa owns its own students/records.
// See /firestore.rules for the access-control rules built on this shape.
// ============================================================================

export interface Mosque {
  id: string;
  name: string;
  createdAt: number;
}

export interface MosqueMember {
  role: 'owner' | 'admin';
}

/** One mosque an admin belongs to, denormalized for a single fast lookup at
 * login. `label` is a display name for the mosque switcher so we don't have
 * to fetch each mosque doc just to render the picker.
 *
 * Deliberately mosque-level only: membership is scoped to the MOSQUE, and
 * every halaqa inside it is visible and writable to every member. That's what
 * lets a substitute teacher cover an absent colleague's halaqa without any
 * extra provisioning. Which halaqa is currently *selected* is a UI concern
 * (see HalaqaContext), not a permission. */
export interface UserMosqueLink {
  mosqueId: string;
  label: string;
}

/** The `admins/{uid}` doc: every mosque a signed-in admin can work on. Read
 * once at login to resolve which tenant(s) the user belongs to, replacing the
 * old hardcoded MOSQUE_ID. A one-element list is the common case (one teacher,
 * one mosque) and behaves exactly like the single-tenant app did. */
export interface UserMosques {
  mosques: UserMosqueLink[];
}

export interface Halaqa {
  id: string;
  name: string;
  /** Bonus/makeup days excluded from attendance % (was a hardcoded constant,
   * now per-halaqa so changing it doesn't require a redeploy). */
  excludedDates: string[];
  /** Minimum attendance % for the "نجم الحضور" badge (was a hardcoded constant). */
  attendanceBadgeThreshold: number;
  /** Admin-editable rotating intentions (نوايا) shown in the app header. Stored
   * on the halaqa doc (already member-gated) so the teacher can add/edit/remove
   * them from inside the app with no redeploy. Empty/absent → the header shows a
   * default verse instead. */
  niyyat?: string[];
  /** UID of the halaqa's regular teacher. Purely organizational — it does NOT
   * restrict access (any mosque member can open and record in any halaqa, so
   * substitutes work). It's used to pick which halaqa opens by default for a
   * teacher and to label whose circle it is. */
  primaryTeacherUid?: string;
}

export interface Badge {
  key: string;
  icon: string;
  label: string;
}


/** Precomputed, publicly-readable per-student stats (denormalized for child.html). */
export interface PublicStats {
  name: string;
  updatedAt: number;
  totalHalaqaDays: number;
  uniqueDays: number;
  attendPct: number;
  rank: number | null;
  sessionsCount: number;
  totalAyat: number;
  avgLoh: number | null;
  avgMadi: number | null;
  badges: Badge[];
  currentTask: {
    date: string;
    newLoh: SuraAssignment[];
    newMadi: SuraAssignment[];
  } | null;
  recentSessions: Array<{
    date: string;
    loh: { score: number; mistakes?: MistakeTally } | null;
    madi: { score: number; mistakes?: MistakeTally } | null;
    newLoh: SuraAssignment[];
    newMadi: SuraAssignment[];
    tajweed: { sura: string; from: string; to: string } | null;
    note: string;
  }>;
  /** Every scored session, oldest-first, lightweight (date + two scores only)
   * — powers child.html's progress chart across the whole history. */
  scoreHistory: Array<{ date: string; loh: number | null; madi: number | null }>;
  /** Pre-aggregated per-month figures for child.html's month filter, keyed by
   * 'YYYY-MM'. The chart, badges, and session list stay outside this filter. */
  monthlyStats: Record<
    string,
    { attendPct: number; sessionsCount: number; totalAyat: number; avgLoh: number | null }
  >;
}
