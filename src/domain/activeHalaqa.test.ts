import { describe, it, expect } from 'vitest';
import { pickActiveHalaqa } from './activeHalaqa';
import type { Halaqa } from '../types';

const h = (id: string, primaryTeacherUid?: string): Halaqa => ({
  id,
  name: id,
  excludedDates: [],
  attendanceBadgeThreshold: 70,
  primaryTeacherUid,
});

const SABAH = h('sabah', 'uid_ahmed');
const ASR = h('asr', 'uid_mahmoud');
const EXTRA = h('extra');

describe('pickActiveHalaqa', () => {
  it('returns null when the mosque has no halaqat', () => {
    expect(pickActiveHalaqa([], null, 'uid_ahmed')).toBeNull();
  });

  it('honors the remembered halaqa when it still exists', () => {
    expect(pickActiveHalaqa([SABAH, ASR], 'asr', 'uid_ahmed')).toBe(ASR);
  });

  it("falls back to the teacher's own halaqa when nothing is remembered", () => {
    expect(pickActiveHalaqa([SABAH, ASR], null, 'uid_mahmoud')).toBe(ASR);
  });

  it('ignores a remembered halaqa that no longer exists', () => {
    expect(pickActiveHalaqa([SABAH, ASR], 'deleted', 'uid_mahmoud')).toBe(ASR);
  });

  it('falls back to the first halaqa for a substitute who owns none', () => {
    expect(pickActiveHalaqa([SABAH, ASR], null, 'uid_substitute')).toBe(SABAH);
  });

  it('falls back to the first halaqa when there is no signed-in uid', () => {
    expect(pickActiveHalaqa([SABAH, ASR], null, null)).toBe(SABAH);
  });

  it('handles halaqat with no primary teacher set', () => {
    expect(pickActiveHalaqa([EXTRA], null, 'uid_ahmed')).toBe(EXTRA);
  });

  it('prefers the remembered halaqa over the teacher\'s own circle', () => {
    // a substitute working in someone else's halaqa keeps that context
    expect(pickActiveHalaqa([SABAH, ASR], 'sabah', 'uid_mahmoud')).toBe(SABAH);
  });
});
