/**
 * Pure set-difference helpers used to reconcile a source (RTDB) snapshot
 * against the current Firestore target during a migration dry-run.
 *
 * No Firebase imports — data in, data out — so this is fully unit-testable
 * and lives in the domain layer per the repo's architecture rules.
 */

/** IDs present in the target (Firestore) but absent from the source (RTDB). */
export function idsOnlyInTarget(
  sourceIds: Iterable<string>,
  targetIds: Iterable<string>,
): string[] {
  const source = new Set(sourceIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of targetIds) {
    if (!source.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** IDs present in the source (RTDB) but absent from the target (Firestore). */
export function idsOnlyInSource(
  sourceIds: Iterable<string>,
  targetIds: Iterable<string>,
): string[] {
  const target = new Set(targetIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of sourceIds) {
    if (!target.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
