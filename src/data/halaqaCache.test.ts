import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRecord, Student } from '../types';

// Mock the two repo subscriptions the cache builds on. Each mock records how
// many times it was called (= how many underlying onSnapshot listeners were
// opened) and hands back a controllable emit + an unsubscribe spy.
type Emit<T> = (list: T[]) => void;

const studentsSubs: { emit: Emit<Student>; unsub: ReturnType<typeof vi.fn> }[] = [];
const recordsSubs: { emit: Emit<SessionRecord>; unsub: ReturnType<typeof vi.fn> }[] = [];

vi.mock('./students.repo', () => ({
  subscribeStudents: (_m: string, _h: string, onChange: Emit<Student>) => {
    const unsub = vi.fn();
    studentsSubs.push({ emit: onChange, unsub });
    return unsub;
  },
}));
vi.mock('./records.repo', () => ({
  subscribeAllRecords: (_m: string, _h: string, onChange: Emit<SessionRecord>) => {
    const unsub = vi.fn();
    recordsSubs.push({ emit: onChange, unsub });
    return unsub;
  },
}));

import {
  subscribeStudentsCached,
  subscribeAllRecordsCached,
  getCachedHalaqaSnapshot,
  __resetHalaqaCacheForTests,
} from './halaqaCache';

const M = 'altayseer';
const H = 'main';
const s = (id: string): Student => ({ id, name: id, parentToken: 't_' + id });
const r = (id: string, studentId: string): SessionRecord => ({ id, studentId, date: '2026-07-01' });

beforeEach(() => {
  studentsSubs.length = 0;
  recordsSubs.length = 0;
  __resetHalaqaCacheForTests();
});
afterEach(() => {
  __resetHalaqaCacheForTests();
});

describe('halaqaCache — shared subscription', () => {
  it('opens only ONE underlying students onSnapshot for many subscribers', () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeStudentsCached(M, H, a);
    const unsubB = subscribeStudentsCached(M, H, b);
    expect(studentsSubs.length).toBe(1); // one listener, shared

    studentsSubs[0].emit([s('s_1'), s('s_2')]);
    expect(a).toHaveBeenCalledWith([s('s_1'), s('s_2')]);
    expect(b).toHaveBeenCalledWith([s('s_1'), s('s_2')]);

    unsubA();
    unsubB();
  });

  it('replays current data immediately to a late subscriber', () => {
    const early = vi.fn();
    subscribeStudentsCached(M, H, early);
    studentsSubs[0].emit([s('s_1')]);

    const late = vi.fn();
    subscribeStudentsCached(M, H, late);
    // late gets the cached value synchronously, without a new onSnapshot
    expect(studentsSubs.length).toBe(1);
    expect(late).toHaveBeenCalledWith([s('s_1')]);
  });

  it('tears down the onSnapshot only when the LAST subscriber leaves', () => {
    const unsubA = subscribeStudentsCached(M, H, vi.fn());
    const unsubB = subscribeStudentsCached(M, H, vi.fn());
    const underlyingUnsub = studentsSubs[0].unsub;

    unsubA();
    expect(underlyingUnsub).not.toHaveBeenCalled(); // B still active
    unsubB();
    expect(underlyingUnsub).toHaveBeenCalledTimes(1); // now torn down
  });

  it('a double-unsubscribe is a no-op (does not corrupt refCount)', () => {
    const unsubA = subscribeStudentsCached(M, H, vi.fn());
    const unsubB = subscribeStudentsCached(M, H, vi.fn());
    unsubA();
    unsubA(); // second call must not drop B's ref
    expect(studentsSubs[0].unsub).not.toHaveBeenCalled();
    unsubB();
    expect(studentsSubs[0].unsub).toHaveBeenCalledTimes(1);
  });
});

describe('halaqaCache — getCachedHalaqaSnapshot', () => {
  it('returns null when cold (no subscribers)', () => {
    expect(getCachedHalaqaSnapshot(M, H)).toBeNull();
  });

  it('returns null when only one of the two collections is warm', () => {
    subscribeStudentsCached(M, H, vi.fn());
    studentsSubs[0].emit([s('s_1')]);
    // records still cold
    expect(getCachedHalaqaSnapshot(M, H)).toBeNull();
  });

  it('returns the live snapshot when BOTH collections are warm and loaded', () => {
    subscribeStudentsCached(M, H, vi.fn());
    subscribeAllRecordsCached(M, H, vi.fn());
    studentsSubs[0].emit([s('s_1'), s('s_2')]);
    recordsSubs[0].emit([r('r_1', 's_1')]);

    const snap = getCachedHalaqaSnapshot(M, H);
    expect(snap).not.toBeNull();
    expect(snap!.students).toHaveLength(2);
    expect(snap!.records).toHaveLength(1);
  });

  it('reflects later emissions (deltas) without a new subscription', () => {
    subscribeStudentsCached(M, H, vi.fn());
    subscribeAllRecordsCached(M, H, vi.fn());
    studentsSubs[0].emit([s('s_1')]);
    recordsSubs[0].emit([r('r_1', 's_1')]);
    // a save arrives → onSnapshot re-emits with the new record
    recordsSubs[0].emit([r('r_1', 's_1'), r('r_2', 's_1')]);

    expect(getCachedHalaqaSnapshot(M, H)!.records).toHaveLength(2);
    expect(recordsSubs.length).toBe(1); // still just one listener
  });

  it('goes cold again after the last subscriber leaves', () => {
    const u1 = subscribeStudentsCached(M, H, vi.fn());
    const u2 = subscribeAllRecordsCached(M, H, vi.fn());
    studentsSubs[0].emit([s('s_1')]);
    recordsSubs[0].emit([r('r_1', 's_1')]);
    expect(getCachedHalaqaSnapshot(M, H)).not.toBeNull();
    u1();
    u2();
    expect(getCachedHalaqaSnapshot(M, H)).toBeNull();
  });
});

describe('halaqaCache — halaqa key change', () => {
  it('resets and re-subscribes when the halaqa key changes', () => {
    subscribeStudentsCached(M, H, vi.fn());
    studentsSubs[0].emit([s('s_1')]);

    // switching halaqa tears the old listener down and starts a fresh one
    subscribeStudentsCached(M, 'other', vi.fn());
    expect(studentsSubs[0].unsub).toHaveBeenCalledTimes(1);
    expect(studentsSubs.length).toBe(2);
    // snapshot for the OLD key is no longer served
    expect(getCachedHalaqaSnapshot(M, H)).toBeNull();
  });
});
