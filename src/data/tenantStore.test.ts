import { describe, it, expect, beforeEach } from 'vitest';
import { rememberTenant, recallTenant, forgetTenant, TENANT_STORAGE_KEY } from './tenantStore';
import type { StorageLike } from './membershipCache';
import type { Tenant } from '../domain/tenant';

class FakeStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

// Privacy modes make every localStorage access throw, not return null.
const hostileStorage: StorageLike = {
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
  removeItem() {
    throw new Error('denied');
  },
};

const TENANT: Tenant = { mosqueId: 'altayseer', halaqaId: 'main' };

let s: FakeStorage;
beforeEach(() => {
  s = new FakeStorage();
});

describe('tenantStore', () => {
  it('round-trips a tenant', () => {
    rememberTenant(TENANT, s);
    expect(recallTenant(s)).toEqual(TENANT);
  });

  it('reads as empty before anything is stored', () => {
    expect(recallTenant(s)).toBeNull();
  });

  it('forgets', () => {
    rememberTenant(TENANT, s);
    forgetTenant(s);
    expect(recallTenant(s)).toBeNull();
  });

  it('overwrites rather than accumulating keys', () => {
    rememberTenant(TENANT, s);
    rememberTenant({ mosqueId: 'alnour', halaqaId: 'nashieen' }, s);
    expect(s.map.size).toBe(1);
    expect(recallTenant(s)).toEqual({ mosqueId: 'alnour', halaqaId: 'nashieen' });
  });

  // The stored value is user-writable, so a tampered entry must read as absent
  // and let the caller fall back to the default mosque — never be trusted.
  it('rejects tampered values', () => {
    s.map.set(TENANT_STORAGE_KEY, 'not json{');
    expect(recallTenant(s)).toBeNull();
    s.map.set(TENANT_STORAGE_KEY, '"altayseer"');
    expect(recallTenant(s)).toBeNull();
    s.map.set(TENANT_STORAGE_KEY, JSON.stringify({ mosqueId: '../other', halaqaId: 'main' }));
    expect(recallTenant(s)).toBeNull();
  });

  it('never throws when storage itself is unavailable', () => {
    expect(() => rememberTenant(TENANT, hostileStorage)).not.toThrow();
    expect(recallTenant(hostileStorage)).toBeNull();
    expect(() => forgetTenant(hostileStorage)).not.toThrow();

    expect(() => rememberTenant(TENANT, null)).not.toThrow();
    expect(recallTenant(null)).toBeNull();
    expect(() => forgetTenant(null)).not.toThrow();
  });
});
