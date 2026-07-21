import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

// The teacher's report: opening a session in EDIT mode showed the same مادي
// (القيامة من ١) in BOTH the top evaluation card and the bottom new-assignment
// section. Root cause: in edit mode the evaluation card was reading the record's
// OWN assignment instead of the PREVIOUS session's assignment (what today's
// scores actually grade). These tests lock in the fix.

const students: Student[] = [{ id: 's_1', name: 'عمار محمد يحيى' }];
let studentsForHook: Student[] = students;
// The session BEFORE the one being edited (what the eval card SHOULD show).
let previousSessionForS1: SessionRecord | null = null;

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students: studentsForHook, loaded: true }),
}));
vi.mock('../../hooks/usePreviousSession', () => ({
  usePreviousSession: (_m: string, _h: string, student: Student | null) => ({
    prev: student?.id === 's_1' ? previousSessionForS1 : null,
    loading: false,
  }),
}));
vi.mock('../../data/records.repo', () => ({
  saveRecord: vi.fn().mockResolvedValue(undefined),
  getRecordsByDate: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: vi.fn().mockResolvedValue(undefined),
}));

function renderScreen(editRecord: SessionRecord | null) {
  return render(
    <ToastProvider>
      <RecordScreen editRecord={editRecord} onEditConsumed={() => {}} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  previousSessionForS1 = null;
  studentsForHook = students;
});

const makeEditRec = (to: string): SessionRecord => ({
  id: 'r_edit',
  studentId: 's_1',
  student: 'عمار محمد يحيى',
  date: '2026-07-10',
  loh: { score: 85, stars: 4 },
  madi: { score: 80, stars: 4 },
  newLoh: [{ sura: 'الإخلاص', from: '1', to: '4' }],
  newMadi: [{ sura: 'القيامة', from: '1', to }],
  note: '',
});

const prevSession: SessionRecord = {
  id: 'r_prev',
  studentId: 's_1',
  student: 'عمار محمد يحيى',
  date: '2026-07-07',
  newLoh: [{ sura: 'الفلق', from: '1', to: '5' }],
  newMadi: [{ sura: 'المدثر', from: '1', to: '10' }],
};

describe('edit-mode evaluation card', () => {
  it('shows the PREVIOUS session assignment (المدثر), not the record’s own (القيامة)', async () => {
    previousSessionForS1 = prevSession;
    renderScreen(makeEditRec('')); // empty "إلى" — irrelevant to the bug
    await screen.findByText(/تعديل جلسة محفوظة/);

    // Eval card now references the previous session's مادي.
    expect(screen.getByText(/سورة المدثر/)).toBeInTheDocument();
    // The record's own القيامة must NOT appear as an eval-card label anymore…
    expect(screen.queryByText(/سورة القيامة/)).not.toBeInTheDocument();
    // …but it IS still the new assignment below (its input value).
    expect(screen.getByDisplayValue('القيامة')).toBeInTheDocument();
  });

  it('behaves the same whether or not "إلى" is filled', async () => {
    previousSessionForS1 = prevSession;
    renderScreen(makeEditRec('30')); // filled "إلى"
    await screen.findByText(/تعديل جلسة محفوظة/);
    expect(screen.getByText(/سورة المدثر/)).toBeInTheDocument();
    expect(screen.queryByText(/سورة القيامة/)).not.toBeInTheDocument();
  });

  it('falls back to the record’s own assignment when editing the first-ever session', async () => {
    previousSessionForS1 = null; // no prior session exists
    renderScreen(makeEditRec('20'));
    await screen.findByText(/تعديل جلسة محفوظة/);

    // With no previous session, the eval card keeps showing this session's own
    // assignment so the score fields still render (per product decision).
    expect(screen.getByText(/سورة القيامة/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('القيامة')).toBeInTheDocument();
  });
});
