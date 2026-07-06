import { describe, it, expect } from 'vitest';
import { fbKey, genId, genParentToken, recTime } from './ids';

describe('fbKey', () => {
  it('replaces every RTDB-illegal character', () => {
    expect(fbKey('a.b#c$d[e]f/g')).toBe('a_b_c_d_e_f_g');
  });
  it('leaves a clean key untouched', () => {
    expect(fbKey('s_123_abcde')).toBe('s_123_abcde');
  });
  it('coerces a number to a string first', () => {
    expect(fbKey(123)).toBe('123');
  });
});

describe('genId', () => {
  it('starts with the given prefix', () => {
    expect(genId('r')).toMatch(/^r_\d+_[a-z0-9]+$/);
  });
  it('generates unique values across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => genId('s')));
    expect(ids.size).toBe(50);
  });
});

describe('genParentToken', () => {
  it('is exactly 20 characters', () => {
    expect(genParentToken()).toHaveLength(20);
  });
  it('never contains visually-ambiguous characters (0/O, 1/l/I)', () => {
    const token = genParentToken();
    expect(token).not.toMatch(/[0O1lI]/);
  });
  it('generates unique tokens across calls', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => genParentToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('recTime', () => {
  it('extracts the embedded creation timestamp from a session id', () => {
    expect(recTime({ id: 'r_1751500000000_ab12c' })).toBe(1751500000000);
  });
  it('returns 0 for an id with no embedded timestamp (e.g. attendance-only)', () => {
    expect(recTime({ id: 'att_20260706_ab12c' })).toBe(0);
  });
  it('returns 0 for null/undefined/missing id', () => {
    expect(recTime(null)).toBe(0);
    expect(recTime(undefined)).toBe(0);
    expect(recTime({})).toBe(0);
  });
});
