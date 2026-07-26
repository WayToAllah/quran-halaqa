import { describe, it, expect } from 'vitest';
import { pickActiveMosque } from './activeMosque';
import type { UserMosqueLink } from '../types';

const A: UserMosqueLink = { mosqueId: 'altayseer', label: 'مسجد التيسير' };
const B: UserMosqueLink = { mosqueId: 'noor', label: 'مسجد النور' };

describe('pickActiveMosque', () => {
  it('returns null for an empty list (user belongs to no mosque)', () => {
    expect(pickActiveMosque([], null)).toBeNull();
    expect(pickActiveMosque([], 'altayseer')).toBeNull();
  });

  it('picks the only mosque when there is exactly one, ignoring any remembered id', () => {
    expect(pickActiveMosque([A], null)).toBe(A);
    expect(pickActiveMosque([A], 'something-else')).toBe(A);
  });

  it('honors a remembered mosque id that is still in the list', () => {
    expect(pickActiveMosque([A, B], 'noor')).toBe(B);
  });

  it('falls back to the first mosque when the remembered id is gone', () => {
    expect(pickActiveMosque([A, B], 'deleted-mosque')).toBe(A);
  });

  it('falls back to the first mosque when nothing is remembered', () => {
    expect(pickActiveMosque([A, B], null)).toBe(A);
  });
});
