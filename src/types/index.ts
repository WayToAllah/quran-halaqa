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
  /** Random high-entropy token used in child.html?t={parentToken} links. */
  parentToken?: string;
}

/** A single sura assignment: sura name + optional ayah range. */
export interface SuraAssignment {
  sura: string;
  from?: string;
  to?: string;
}

/** Evaluation of a *previous* session's assignment. `score` is null/undefined
 * when nothing has been evaluated yet — distinct from a genuine zero grade.
 * Never use a plain truthy check on `.score` (0 is falsy in JS); use hasScore(). */
export interface ScoreEval {
  score?: number | null;
  stars?: number;
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
    loh: { score: number } | null;
    madi: { score: number } | null;
    newLoh: SuraAssignment[];
    newMadi: SuraAssignment[];
    tajweed: { sura: string; from: string; to: string } | null;
    note: string;
  }>;
}
