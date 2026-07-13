import { describe, it, expect } from 'vitest';
import { computeSharedStatsInputs } from './publishStats';
import type { SessionRecord, Student } from '../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد', parentToken: 'T1' },
  { id: 's_2', name: 'محمد', parentToken: 'T2' },
];

// s_1 attends 2 of 2 days (100%), s_2 attends 1 of 2 (50%) → dense ranks 1 and 2.
const records: SessionRecord[] = [
  { id: 'r1', studentId: 's_1', date: '2026-07-01', loh: { score: 90 }, newLoh: [{ sura: 'البقرة', from: '1', to: '10' }] },
  { id: 'r2', studentId: 's_1', date: '2026-07-03', loh: { score: 80 } },
  { id: 'r3', studentId: 's_2', date: '2026-07-01' },
];

describe('computeSharedStatsInputs', () => {
  it('computes total halaqa days from unique dates', () => {
    const { totalHalaqaDays } = computeSharedStatsInputs(students, records);
    expect(totalHalaqaDays).toBe(2); // 2026-07-01 and 2026-07-03
  });

  it('ranks only students at/above the 70% badge threshold, keyed by student id', () => {
    const { rankById } = computeSharedStatsInputs(students, records);
    expect(rankById['s_1']).toBe(1); // 100% — ranked
    // s_2 at 50% is below the 70% threshold, so he has no rank entry
    expect(rankById['s_2']).toBeUndefined();
  });

  it('never lets two students with the SAME display name share a rank (id-keyed)', () => {
    // Both named 'زيد' — s_1 attends 2/2 days (rank 1), s_dup attends 1/2 (50%,
    // below threshold → no rank). A name-keyed map would give s_dup rank 1 too.
    const dupStudents: Student[] = [
      { id: 's_1', name: 'زيد', parentToken: 'T1' },
      { id: 's_dup', name: 'زيد', parentToken: 'T9' },
    ];
    const dupRecords: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01' },
      { id: 'r2', studentId: 's_1', date: '2026-07-03' },
      { id: 'r3', studentId: 's_dup', date: '2026-07-01' },
    ];
    const { rankById } = computeSharedStatsInputs(dupStudents, dupRecords);
    expect(rankById['s_1']).toBe(1);
    expect(rankById['s_dup']).toBeUndefined();
  });

  it('returns halaqa dates in descending order', () => {
    const { halaqaDatesDesc } = computeSharedStatsInputs(students, records);
    expect(halaqaDatesDesc).toEqual(['2026-07-03', '2026-07-01']);
  });
});
