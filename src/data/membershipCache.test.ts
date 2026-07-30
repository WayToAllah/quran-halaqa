import { describe, it, expect } from 'vitest';
import {
  rememberMembership,
  recallMembership,
  forgetMembership,
  type StorageLike,
} from './membershipCache';
import type { MosqueMember } from '../types';

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** Storage that throws on every access, as some privacy modes do. */
const hostileStorage: StorageLike = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
  removeItem() {
    throw new Error('blocked');
  },
};

const member: MosqueMember = { role: 'owner' };

describe('membershipCache', () => {
  it('round-trips a confirmed membership', () => {
    const s = fakeStorage();
    rememberMembership('altayseer', 'uid_1', member, s);
    expect(recallMembership('altayseer', 'uid_1', s)).toEqual(member);
  });

  it('scopes entries by mosque and by uid', () => {
    const s = fakeStorage();
    rememberMembership('altayseer', 'uid_1', member, s);
    expect(recallMembership('altayseer', 'uid_2', s)).toBeNull();
    expect(recallMembership('other', 'uid_1', s)).toBeNull();
  });

  it('forgets on demand, so a revoked account cannot open offline forever', () => {
    const s = fakeStorage();
    rememberMembership('altayseer', 'uid_1', member, s);
    forgetMembership('altayseer', 'uid_1', s);
    expect(recallMembership('altayseer', 'uid_1', s)).toBeNull();
  });

  it('treats corrupt or non-object values as absent rather than trusting them', () => {
    const s = fakeStorage();
    s.map.set('halaqa:member:altayseer:uid_1', 'not json{');
    expect(recallMembership('altayseer', 'uid_1', s)).toBeNull();
    s.map.set('halaqa:member:altayseer:uid_1', '"owner"');
    expect(recallMembership('altayseer', 'uid_1', s)).toBeNull();
    s.map.set('halaqa:member:altayseer:uid_1', 'null');
    expect(recallMembership('altayseer', 'uid_1', s)).toBeNull();
  });

  it('never throws when storage itself is unavailable', () => {
    expect(() => rememberMembership('altayseer', 'uid_1', member, hostileStorage)).not.toThrow();
    expect(recallMembership('altayseer', 'uid_1', hostileStorage)).toBeNull();
    expect(() => forgetMembership('altayseer', 'uid_1', hostileStorage)).not.toThrow();
  });

  it('is a no-op when there is no storage at all', () => {
    expect(() => rememberMembership('altayseer', 'uid_1', member, null)).not.toThrow();
    expect(recallMembership('altayseer', 'uid_1', null)).toBeNull();
  });
});
