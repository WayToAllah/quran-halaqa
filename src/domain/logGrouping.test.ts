import { describe, it, expect } from 'vitest';
import { groupRecordsByDay, matchesLogFilter, markedAssignments } from './logGrouping';
import type { SessionRecord } from '../types';

function rec(id: string, date: string, extra: Partial<SessionRecord> = {}): SessionRecord {
  return { id, studentId: 's_1', date, ...extra };
}

describe('groupRecordsByDay', () => {
  it('puts every record of a day under one block', () => {
    const days = groupRecordsByDay([
      rec('r1', '2026-07-25'),
      rec('r2', '2026-07-25'),
      rec('r3', '2026-07-22'),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe('2026-07-25');
    expect(days[0].records.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(days[1].records.map((r) => r.id)).toEqual(['r3']);
  });

  it('orders days newest-first even when the input is not sorted', () => {
    const days = groupRecordsByDay([
      rec('r_old', '2026-07-01'),
      rec('r_new', '2026-07-30'),
      rec('r_mid', '2026-07-15'),
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-07-30', '2026-07-15', '2026-07-01']);
  });

  it('regroups a day whose records were not adjacent in the input', () => {
    const days = groupRecordsByDay([
      rec('r1', '2026-07-25'),
      rec('r2', '2026-07-22'),
      rec('r3', '2026-07-25'),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0].records).toHaveLength(2);
  });

  it('keeps undated records reachable, at the end', () => {
    const days = groupRecordsByDay([rec('r_bad', ''), rec('r1', '2026-07-25')]);
    expect(days.map((d) => d.date)).toEqual(['2026-07-25', '']);
    expect(days[1].records.map((r) => r.id)).toEqual(['r_bad']);
  });

  it('returns nothing for an empty list', () => {
    expect(groupRecordsByDay([])).toEqual([]);
  });
});

describe('matchesLogFilter', () => {
  const plain = rec('r1', '2026-07-25', { loh: { score: 90 } });
  const failed = rec('r2', '2026-07-25', { loh: { score: 40 } });
  const failedMadi = rec('r3', '2026-07-25', { madi: { score: 30 } });
  const attendance = rec('r4', '2026-07-25', { attendance_only: true });
  const withTajweed = rec('r5', '2026-07-25', { tajweed: { sura: 'البقرة', stars: 4 } });

  it('lets everything through under "الكل"', () => {
    for (const r of [plain, failed, attendance, withTajweed]) {
      expect(matchesLogFilter(r, 'all')).toBe(true);
    }
  });

  it('catches إعادة on either half of the session', () => {
    expect(matchesLogFilter(failed, 'repeat')).toBe(true);
    expect(matchesLogFilter(failedMadi, 'repeat')).toBe(true);
    expect(matchesLogFilter(plain, 'repeat')).toBe(false);
  });

  it('does not treat an unmarked session as إعادة', () => {
    // score == null is "not evaluated", which is not a failing grade.
    const unmarked = rec('r6', '2026-07-25', { loh: { score: null } });
    expect(matchesLogFilter(unmarked, 'repeat')).toBe(false);
  });

  it('counts a genuine zero as إعادة', () => {
    const zero = rec('r7', '2026-07-25', { loh: { score: 0 } });
    expect(matchesLogFilter(zero, 'repeat')).toBe(true);
  });

  it('separates attendance-only rows from real sessions', () => {
    expect(matchesLogFilter(attendance, 'attendance')).toBe(true);
    expect(matchesLogFilter(plain, 'attendance')).toBe(false);
  });

  it('finds sessions carrying a tajweed passage', () => {
    expect(matchesLogFilter(withTajweed, 'tajweed')).toBe(true);
    expect(matchesLogFilter(plain, 'tajweed')).toBe(false);
    // A tajweed object with no sura is an empty shell, not a passage.
    const empty = rec('r8', '2026-07-25', { tajweed: { sura: '', stars: 0 } });
    expect(matchesLogFilter(empty, 'tajweed')).toBe(false);
  });
});

describe('markedAssignments', () => {
  const jul01 = rec('r1', '2026-07-01', { newLoh: [{ sura: 'الفاتحة', from: '1', to: '7' }] });
  const jul05 = rec('r2', '2026-07-05', {
    loh: { score: 90 },
    newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
  });

  it('attributes a mark to the assignment given at the previous session', () => {
    const map = markedAssignments([jul05, jul01]);
    // The 5 July score was earned on الفاتحة, handed out on 1 July — NOT on
    // البقرة, which is the new assignment sitting on the same card.
    expect(map.get('r2')?.loh).toEqual([{ sura: 'الفاتحة', from: '1', to: '7' }]);
  });

  it('gives nothing for a session with no predecessor loaded', () => {
    // The log pages newest-first, so an older session may not be loaded yet.
    // Better a bare mark than a sura taken from the wrong session.
    expect(markedAssignments([jul05]).get('r2')).toBeUndefined();
  });

  it('never crosses students', () => {
    const otherStudent = { ...jul01, id: 'r_x', studentId: 's_2' };
    expect(markedAssignments([jul05, otherStudent]).get('r2')).toBeUndefined();
  });

  it('skips attendance rows when looking back', () => {
    const att = rec('r_att', '2026-07-03', { attendance_only: true });
    const map = markedAssignments([jul05, att, jul01]);
    expect(map.get('r2')?.loh).toEqual([{ sura: 'الفاتحة', from: '1', to: '7' }]);
  });

  it('works off an unsorted list', () => {
    const map = markedAssignments([jul01, jul05]);
    expect(map.get('r2')?.loh?.[0].sura).toBe('الفاتحة');
  });
});
