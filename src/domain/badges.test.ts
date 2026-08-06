import { describe, it, expect } from 'vitest';
import { HIDDEN_BADGE_KEYS, visibleBadges } from './badges';
import type { Badge } from '../types';

const badge = (key: string): Badge => ({ key, icon: '📖', label: key });

describe('visibleBadges', () => {
  it('removes hidden keys and keeps everything else', () => {
    const input = [
      badge('perfectAttendance'),
      badge('ayat100'),
      badge('ayat200'),
      badge('ayat500'),
      badge('excellence'),
    ];
    expect(visibleBadges(input).map((b) => b.key)).toEqual([
      'perfectAttendance',
      'ayat500',
      'excellence',
    ]);
  });

  it('preserves the original order of the surviving badges', () => {
    const input = [badge('streak'), badge('ayat100'), badge('improving')];
    expect(visibleBadges(input).map((b) => b.key)).toEqual(['streak', 'improving']);
  });

  it('leaves a list with nothing hidden untouched', () => {
    const input = [badge('streak'), badge('excellence')];
    expect(visibleBadges(input)).toEqual(input);
  });

  it('handles an empty list', () => {
    expect(visibleBadges([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [badge('ayat100'), badge('streak')];
    visibleBadges(input);
    expect(input.map((b) => b.key)).toEqual(['ayat100', 'streak']);
  });

  it('currently hides the two ayat milestones under review', () => {
    expect([...HIDDEN_BADGE_KEYS].sort()).toEqual(['ayat100', 'ayat200']);
  });
});
