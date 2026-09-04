import { describe, it, expect } from 'vitest';
import {
  isValidTenantId,
  isTenant,
  parseTenant,
  serializeTenant,
  sameTenant,
  type Tenant,
} from './tenant';

const t = (mosqueId: string, halaqaId: string): Tenant => ({ mosqueId, halaqaId });

describe('isValidTenantId', () => {
  it('accepts ordinary ids', () => {
    expect(isValidTenantId('altayseer')).toBe(true);
    expect(isValidTenantId('main')).toBe(true);
    expect(isValidTenantId('masjid-al-nour_2')).toBe(true);
  });

  it('rejects non-strings and empties', () => {
    expect(isValidTenantId(undefined)).toBe(false);
    expect(isValidTenantId(null)).toBe(false);
    expect(isValidTenantId(42)).toBe(false);
    expect(isValidTenantId('')).toBe(false);
  });

  // A slash would silently re-path the Firestore reference into a different
  // collection, so it can never be part of a single document id.
  it('rejects ids containing a slash', () => {
    expect(isValidTenantId('a/b')).toBe(false);
    expect(isValidTenantId('/altayseer')).toBe(false);
  });

  it('rejects the relative-path ids Firestore forbids', () => {
    expect(isValidTenantId('.')).toBe(false);
    expect(isValidTenantId('..')).toBe(false);
    expect(isValidTenantId('...')).toBe(true);
  });

  it('rejects the __reserved__ pattern Firestore forbids', () => {
    expect(isValidTenantId('__proto__')).toBe(false);
    expect(isValidTenantId('__id7__')).toBe(false);
    expect(isValidTenantId('__leading')).toBe(true);
  });

  // Measured in UTF-8 bytes, not characters — Arabic ids cost 2 bytes a letter.
  it('rejects ids over 1500 UTF-8 bytes', () => {
    expect(isValidTenantId('a'.repeat(1500))).toBe(true);
    expect(isValidTenantId('a'.repeat(1501))).toBe(false);
    expect(isValidTenantId('ح'.repeat(751))).toBe(false);
  });
});

describe('isTenant', () => {
  it('accepts a well-formed pair', () => {
    expect(isTenant(t('altayseer', 'main'))).toBe(true);
  });

  it('rejects anything that is not a pair of valid ids', () => {
    expect(isTenant(null)).toBe(false);
    expect(isTenant('altayseer')).toBe(false);
    expect(isTenant({ mosqueId: 'altayseer' })).toBe(false);
    expect(isTenant({ mosqueId: 'altayseer', halaqaId: '' })).toBe(false);
    expect(isTenant({ mosqueId: 'a/b', halaqaId: 'main' })).toBe(false);
  });
});

describe('parseTenant / serializeTenant', () => {
  it('round-trips', () => {
    const tenant = t('altayseer', 'main');
    expect(parseTenant(serializeTenant(tenant))).toEqual(tenant);
  });

  it('drops unknown fields rather than carrying them forward', () => {
    const raw = JSON.stringify({ mosqueId: 'altayseer', halaqaId: 'main', role: 'owner' });
    expect(parseTenant(raw)).toEqual(t('altayseer', 'main'));
  });

  // The stored value is user-writable (localStorage), so every hostile shape
  // has to read as "nothing stored" rather than throwing or being trusted.
  it('treats absent, malformed and invalid values as nothing stored', () => {
    expect(parseTenant(null)).toBeNull();
    expect(parseTenant(undefined)).toBeNull();
    expect(parseTenant('')).toBeNull();
    expect(parseTenant('not json{')).toBeNull();
    expect(parseTenant('"altayseer"')).toBeNull();
    expect(parseTenant('null')).toBeNull();
    expect(parseTenant('[]')).toBeNull();
    expect(parseTenant(JSON.stringify({ mosqueId: 'a/b', halaqaId: 'main' }))).toBeNull();
    expect(parseTenant(JSON.stringify({ mosqueId: 'altayseer' }))).toBeNull();
  });
});

describe('sameTenant', () => {
  it('compares both ids', () => {
    expect(sameTenant(t('altayseer', 'main'), t('altayseer', 'main'))).toBe(true);
    expect(sameTenant(t('altayseer', 'main'), t('altayseer', 'nashieen'))).toBe(false);
    expect(sameTenant(t('altayseer', 'main'), t('alnour', 'main'))).toBe(false);
  });
});
