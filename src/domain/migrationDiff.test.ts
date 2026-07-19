import { describe, it, expect } from 'vitest';
import { idsOnlyInTarget, idsOnlyInSource } from './migrationDiff';

describe('migrationDiff', () => {
  it('idsOnlyInTarget returns target ids missing from source (the extras)', () => {
    expect(idsOnlyInTarget(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual(['c', 'd']);
  });

  it('idsOnlyInTarget is empty when target is a subset of source', () => {
    expect(idsOnlyInTarget(['a', 'b', 'c'], ['a', 'b'])).toEqual([]);
  });

  it('idsOnlyInSource returns source ids missing from target (the missing)', () => {
    expect(idsOnlyInSource(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c']);
  });

  it('does not duplicate output when the target has duplicate ids', () => {
    expect(idsOnlyInTarget(['a'], ['b', 'b', 'c'])).toEqual(['b', 'c']);
  });

  it('handles empty inputs on both sides', () => {
    expect(idsOnlyInTarget([], [])).toEqual([]);
    expect(idsOnlyInSource([], ['x'])).toEqual([]);
    expect(idsOnlyInTarget([], ['x'])).toEqual(['x']);
  });

  it('preserves target order for the extras', () => {
    expect(idsOnlyInTarget(['x'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });
});
