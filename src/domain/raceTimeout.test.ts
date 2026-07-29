import { describe, it, expect, vi, afterEach } from 'vitest';
import { raceTimeout } from './raceTimeout';

describe('raceTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the value when the promise settles before the deadline', async () => {
    const out = await raceTimeout(Promise.resolve('ok'), 1000);
    expect(out).toEqual({ status: 'settled', value: 'ok' });
  });

  it('reports pending when the deadline wins', async () => {
    vi.useFakeTimers();
    // A promise that never settles — the exact shape of an offline Firestore
    // write, which is the whole reason this helper exists.
    const never = new Promise<string>(() => {});
    const raced = raceTimeout(never, 8000);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await raced).toEqual({ status: 'pending' });
  });

  it('does not report pending one tick before the deadline', async () => {
    vi.useFakeTimers();
    let settled = false;
    const raced = raceTimeout(new Promise<string>(() => {}), 8000).then((o) => {
      settled = true;
      return o;
    });
    await vi.advanceTimersByTimeAsync(7999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await raced).toEqual({ status: 'pending' });
  });

  it('propagates a rejection that arrives before the deadline', async () => {
    await expect(raceTimeout(Promise.reject(new Error('denied')), 1000)).rejects.toThrow('denied');
  });

  it('does not reject after the deadline has already been reported', async () => {
    vi.useFakeTimers();
    let rejectLate: (e: Error) => void = () => {};
    const slow = new Promise<string>((_, rej) => {
      rejectLate = rej;
    });
    // The caller owns the late failure, so swallow it here the way the real
    // caller does — this asserts the raced promise itself stays resolved.
    slow.catch(() => {});
    const raced = raceTimeout(slow, 8000);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await raced).toEqual({ status: 'pending' });
    rejectLate(new Error('too late'));
    await expect(raced).resolves.toEqual({ status: 'pending' });
  });

  it('clears its timer once the promise settles, leaving nothing pending', async () => {
    vi.useFakeTimers();
    const out = await raceTimeout(Promise.resolve(1), 8000);
    expect(out).toEqual({ status: 'settled', value: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
