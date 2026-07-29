import type { ScoreEval, SessionRecord, Student, SuraAssignment, TajweedEval } from '../types';
import { byNewest } from './dates';
import { hasScore, scoreName } from './scoring';
import { recordsForStudent } from './students';
import { findSuraByName } from './suras';

/**
 * A grade was actually entered AND it lands in the إعادة band.
 *
 * Tested through scoreName() rather than a hard-coded cut-off so it follows
 * the bands wherever they move next — they already went 85/75/65/50 →
 * 90/80/70/60 on 2026-07-27, and a literal `< 60` here would have silently
 * kept scoring by the old scale.
 *
 * hasScore() first: a genuine 0 IS إعادة, while an unscored side is simply
 * not graded yet and must not be mistaken for a failure.
 */
export function isRepeatGrade(o: ScoreEval | null | undefined): boolean {
  return hasScore(o) && scoreName(o.score) === 'إعادة';
}

/**
 * Which sessions' assignments were later graded إعادة, keyed by record id.
 *
 * A session's newLoh/newMadi is recited and graded at the student's NEXT
 * session, so the verdict on an assignment sits on a different record than
 * the assignment itself — the same linkage findPreviousSession() walks, taken
 * forwards instead of back. Records are grouped per student first: "the next
 * session" only means anything inside one student's own history.
 *
 * `false` covers both "passed" and "not graded yet". Ungraded work is
 * deliberately not treated as failed — the newest assignment simply hasn't
 * been recited, and dropping it would make every total lag a session behind.
 */
export function assignmentsGradedRepeat(
  records: SessionRecord[],
): Map<string, { loh: boolean; madi: boolean }> {
  const byStudent = new Map<string, SessionRecord[]>();
  for (const r of records) {
    if (r.attendance_only) continue;
    const key = r.studentId || r.student || '';
    const list = byStudent.get(key);
    if (list) list.push(r);
    else byStudent.set(key, [r]);
  }

  const out = new Map<string, { loh: boolean; madi: boolean }>();
  for (const recs of byStudent.values()) {
    const oldestFirst = [...recs].sort((a, b) => byNewest(b, a));
    oldestFirst.forEach((r, i) => {
      const grader = oldestFirst[i + 1];
      out.set(r.id, {
        loh: isRepeatGrade(grader?.loh),
        madi: isRepeatGrade(grader?.madi),
      });
    });
  }
  return out;
}

/**
 * Finds the session whose newLoh/newMadi assignment the admin is about to
 * evaluate today — the student's most recent REAL (non attendance-only)
 * session, excluding the one currently being edited.
 *
 * When editing an existing session, "previous" must mean chronologically
 * BEFORE the one being edited, not simply "the most recent session ever" —
 * otherwise editing a student's latest session makes it its own "previous
 * session", and the evaluation card ends up showing the exact same
 * newLoh/newMadi as the new-assignment section right below it. Ported
 * from the live app's onStudentChange().
 */
export function findPreviousSession(
  student: Student,
  allRecords: SessionRecord[],
  excludeRecordId?: string,
): SessionRecord | null {
  let recs = recordsForStudent(student, allRecords).filter((r) => !r.attendance_only);

  if (excludeRecordId) {
    const editingRec = allRecords.find((r) => r.id === excludeRecordId);
    if (editingRec) {
      recs = recs.filter((r) => r.id !== excludeRecordId && byNewest(r, editingRec) > 0);
    }
  }

  if (!recs.length) return null;
  return [...recs].sort(byNewest)[0];
}

/** Reads the "assigned" sura list off a session, preferring the modern
 * newLoh/newMadi array shape and falling back to the legacy single-object
 * shape for pre-migration records. */
export function extractAssignedSuras(
  field: SuraAssignment[] | undefined,
  legacy: unknown,
): SuraAssignment[] {
  if (field?.length) return field.filter((f) => f?.sura);
  const legacyObj = legacy as SuraAssignment | undefined;
  if (legacyObj?.sura) return [legacyObj];
  return [];
}

export interface AyahRangeErrors {
  fromError?: string;
  toError?: string;
}

/** A row counts as filled-in and worth saving when it has a sura, and — if it
 * is in whole-sura range mode — also an end sura. A range row missing its
 * `toSura` is treated as incomplete and dropped on save (mirrors the live
 * app's `.filter(x => x.range ? (x.sura && x.toSura) : x.sura)`). */
export function isRowComplete(row: SuraAssignment): boolean {
  if (!row.sura) return false;
  if (row.range) return !!row.toSura;
  return true;
}

/** Normalizes an entry row into the exact shape persisted to the DB. A range
 * row saves as `{sura, toSura, range:true}` with no ayah numbers; an ordinary
 * row saves as `{sura, from, to}` with no range fields. This prevents a stale
 * `toSura`/`range` (or a leftover `from`/`to`) from a toggled row leaking into
 * the saved record — matching the live index.html save mapping. */
export function cleanAssignmentRow(row: SuraAssignment): SuraAssignment {
  if (row.range && row.toSura) {
    return { sura: row.sura, toSura: row.toSura, range: true };
  }
  const out: SuraAssignment = { sura: row.sura };
  if (row.from) out.from = row.from;
  if (row.to) out.to = row.to;
  return out;
}

/**
 * Order-stable signature of a set of assignment rows.
 *
 * Used to tell the teacher's OWN typing apart from what the app itself put in
 * the fields (a blank row, or the last-session autofill suggestion): compare
 * the current rows against the signature taken when the app last wrote them.
 * Plain JSON.stringify is not enough — rows built by different code paths can
 * carry the same values under a different key order.
 */
export function rowsSignature(rows: SuraAssignment[]): string {
  return JSON.stringify(
    rows.map((r) => [r.sura ?? '', r.from ?? '', r.to ?? '', r.toSura ?? '', r.range ? 1 : 0]),
  );
}

/**
 * Normalizes the tajweed section into the exact shape persisted to the DB:
 * `{sura, from, to, stars, note}` with string (never `undefined`) ayah fields.
 *
 * This guard matters because the row's "🔗 نطاق سور" toggle *deletes* the
 * `from`/`to` keys, and Firestore rejects an `undefined` field value outright —
 * so building `rec.tajweed` straight off the row made the whole save throw and
 * the teacher only saw a generic "فشل الحفظ". Same job cleanAssignmentRow does
 * for loh/madi rows, adapted to tajweed's own {stars, note} shape.
 *
 * Note: `toSura`/`range` are intentionally NOT persisted — TajweedEval has no
 * such fields; tajweed is always a specific passage.
 */
export function cleanTajweed(row: SuraAssignment, stars: number, note: string): TajweedEval {
  return {
    sura: row.sura,
    from: row.from ?? '',
    to: row.to ?? '',
    stars,
    note: (note ?? '').trim(),
  };
}

/**
 * Validates a from/to ayah range against the real ayah count of the named
 * sura. Returns an empty object (no errors) when the sura isn't recognized
 * or fields are empty — matches the live app's "only validate once there's
 * something to validate" behavior.
 */
export function validateAyahRange(suraName: string, from: string, to: string): AyahRangeErrors {
  const sura = findSuraByName(suraName);
  if (!sura) return {};
  const max = sura.count;
  const fromNum = parseInt(from);
  const toNum = parseInt(to);
  const errors: AyahRangeErrors = {};

  // Note: a filled "من" with an empty "إلى" is intentionally NOT an error — the
  // auto-fill leaves "إلى" blank for the teacher on purpose, and the
  // review-before-save WhatsApp preview is where an unintended gap gets caught.
  if (from && (fromNum < 1 || fromNum > max)) {
    errors.fromError = `الآية بين ١ و${max}`;
  }
  if (to && (toNum < 1 || toNum > max)) {
    errors.toError = `الآية بين ١ و${max}`;
  } else if (to && from && !errors.fromError && toNum < fromNum) {
    errors.toError = 'يجب أن تكون أكبر من آية البداية';
  }
  return errors;
}
