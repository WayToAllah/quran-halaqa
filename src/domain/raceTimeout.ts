/**
 * Outcome of racing a promise against a deadline.
 *
 * `'settled'` — the promise resolved in time, with its value.
 * `'pending'` — the deadline won. The underlying promise is STILL RUNNING and
 *   was not cancelled; the caller must attach its own late handler (see below).
 */
export type RaceOutcome<T> = { status: 'settled'; value: T } | { status: 'pending' };

/**
 * Resolve as soon as EITHER `promise` settles or `ms` elapses — without
 * cancelling `promise`, which cannot be cancelled anyway.
 *
 * This exists because of a specific hang: Firestore's `setDoc()` promise only
 * resolves once the SERVER acknowledges the write. With no connection the SDK
 * silently queues the write locally and the promise stays pending forever — it
 * never rejects, so there is no error path and no timeout. Any `await` on it
 * pins the UI in its "saving" state indefinitely, which is exactly what stranded
 * the teacher mid-session with an un-dismissable modal.
 *
 * A rejection is NOT swallowed: it rejects this promise too, so genuine failures
 * (rules, bad data) still reach the caller's catch. But if the deadline wins
 * first, a LATER rejection has nowhere to go — the caller MUST attach its own
 * `.then/.catch` to the original promise in the `'pending'` branch, or an
 * unhandled rejection escapes.
 */
export function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<RaceOutcome<T>> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ status: 'pending' });
    }, ms);
    promise.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ status: 'settled', value });
      },
      (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
