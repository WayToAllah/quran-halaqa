import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/preact';
import type { SessionRecord, Student } from '../types';

// One pending fetch per student, resolved by hand, so a test can switch
// students while the previous one's records are still on their way.
const pending = new Map<string, (r: SessionRecord[]) => void>();
vi.mock('../data/records.repo', () => ({
  getAllRecordsForStudent: (_m: string, _h: string, id: string) =>
    new Promise<SessionRecord[]>((res) => pending.set(id, res)),
}));

import { usePreviousSession } from './usePreviousSession';

const zaid: Student = { id: 's_zaid', name: 'زيد' } as Student;
const omar: Student = { id: 's_omar', name: 'عمر' } as Student;
const rec = (studentId: string, sura: string): SessionRecord =>
  ({
    id: 'r_' + studentId,
    studentId,
    date: '2026-11-10',
    loh: { score: 95 },
    newLoh: [{ sura, from: '1', to: '10' }],
  }) as SessionRecord;

let seen: { prev: SessionRecord | null; loading: boolean }[] = [];
function Probe({ student }: { student: Student | null }) {
  const r = usePreviousSession('m', 'h', student);
  seen.push(r);
  return null;
}
const last = () => seen[seen.length - 1];

beforeEach(() => {
  pending.clear();
  seen = [];
});

describe('usePreviousSession — switching students', () => {
  it("never hands the next student the last student's session while theirs loads", async () => {
    const { rerender } = render(<Probe student={zaid} />);
    await act(async () => pending.get('s_zaid')!([rec('s_zaid', 'النبأ')]));
    await waitFor(() => expect(last().prev?.studentId).toBe('s_zaid'));

    seen = [];
    rerender(<Probe student={omar} />);
    // Omar's records haven't arrived: nothing — never Zaid's session — and loading.
    for (const r of seen) expect(r.prev?.studentId).not.toBe('s_zaid');
    expect(last().prev).toBeNull();
    expect(last().loading).toBe(true);

    await act(async () => pending.get('s_omar')!([rec('s_omar', 'الملك')]));
    await waitFor(() => expect(last().prev?.studentId).toBe('s_omar'));
  });

  it('drops a late answer for a student the teacher already moved away from', async () => {
    const { rerender } = render(<Probe student={zaid} />);
    rerender(<Probe student={omar} />);
    await act(async () => pending.get('s_omar')!([rec('s_omar', 'الملك')]));
    await act(async () => pending.get('s_zaid')!([rec('s_zaid', 'النبأ')]));
    expect(last().prev?.studentId).toBe('s_omar');
  });
});
