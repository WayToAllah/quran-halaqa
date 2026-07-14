import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRecord, Student } from '../types';

/**
 * Proves the read-cost win: when the shared cache is warm, republishPublicStatsFor
 * must NOT issue one-shot getAllStudents/getAllRecords, and when cold it MUST
 * fall back to them (preserving pre-optimisation behaviour).
 */

const getAllStudentsMock = vi.fn();
const getAllRecordsMock = vi.fn();
const setPublicStatsMock = vi.fn().mockResolvedValue(undefined);
const getCachedSnapshotMock = vi.fn();

vi.mock('./students.repo', () => ({
  getAllStudents: (...a: unknown[]) => getAllStudentsMock(...a),
  subscribeStudents: vi.fn(),
}));
vi.mock('./records.repo', () => ({
  getAllRecords: (...a: unknown[]) => getAllRecordsMock(...a),
  subscribeAllRecords: vi.fn(),
}));
vi.mock('./publicStats.repo', () => ({
  setPublicStats: (...a: unknown[]) => setPublicStatsMock(...a),
}));
vi.mock('./halaqaCache', () => ({
  getCachedHalaqaSnapshot: (...a: unknown[]) => getCachedSnapshotMock(...a),
}));

import { republishPublicStatsFor } from './publishStats';

const students: Student[] = [
  { id: 's_1', name: 'زيد', parentToken: 'T1' },
  { id: 's_2', name: 'محمد', parentToken: 'T2' },
];
const records: SessionRecord[] = [
  { id: 'r1', studentId: 's_1', date: '2026-07-01' },
  { id: 'r2', studentId: 's_1', date: '2026-07-03' },
];

beforeEach(() => {
  vi.clearAllMocks();
  setPublicStatsMock.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe('republishPublicStatsFor read source', () => {
  it('uses the warm cache and does NOT fetch the full halaqa', async () => {
    getCachedSnapshotMock.mockReturnValue({ students, records });

    await republishPublicStatsFor(['s_1']);

    expect(getAllStudentsMock).not.toHaveBeenCalled();
    expect(getAllRecordsMock).not.toHaveBeenCalled();
    expect(setPublicStatsMock).toHaveBeenCalledTimes(1);
    expect(setPublicStatsMock.mock.calls[0][0]).toBe('T1'); // s_1's token
  });

  it('falls back to one-shot fetch when the cache is cold', async () => {
    getCachedSnapshotMock.mockReturnValue(null);
    getAllStudentsMock.mockResolvedValue(students);
    getAllRecordsMock.mockResolvedValue(records);

    await republishPublicStatsFor(['s_1']);

    expect(getAllStudentsMock).toHaveBeenCalledTimes(1);
    expect(getAllRecordsMock).toHaveBeenCalledTimes(1);
    expect(setPublicStatsMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an empty id list (no reads at all)', async () => {
    await republishPublicStatsFor([]);
    expect(getCachedSnapshotMock).not.toHaveBeenCalled();
    expect(getAllStudentsMock).not.toHaveBeenCalled();
    expect(setPublicStatsMock).not.toHaveBeenCalled();
  });

  it('skips a student with no parentToken but still uses one snapshot for the batch', async () => {
    const mixed: Student[] = [
      { id: 's_1', name: 'زيد', parentToken: 'T1' },
      { id: 's_3', name: 'بدون', parentToken: undefined },
    ];
    getCachedSnapshotMock.mockReturnValue({ students: mixed, records });

    await republishPublicStatsFor(['s_1', 's_3']);

    expect(getAllStudentsMock).not.toHaveBeenCalled();
    expect(setPublicStatsMock).toHaveBeenCalledTimes(1); // only s_1
  });
});
