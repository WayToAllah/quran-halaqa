import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

// Three ways the record screen could lose the teacher's work without telling
// them. Each of these came out of reading the save/switch paths, not from a
// crash — they all fail quietly, which is exactly why they need tests.
//
//  1. A sura row the teacher started but that never matched a real sura was
//     filtered out on save (`isRowComplete`) and the session saved short.
//  2. A correction typed into the evaluation card's "إلى" box was not counted
//     as unsaved work, so switching students discarded it with no warning.
//  3. Opening a saved session for edit moved the shared date picker to that
//     session's date and never moved it back — so every student recorded
//     afterwards landed on the wrong day.

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'سالم' },
];

const saveRecordMock = vi.fn().mockResolvedValue(undefined);
let previousSessionForS1: SessionRecord | null = null;

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/usePreviousSession', () => ({
  usePreviousSession: (_m: string, _h: string, student: Student | null) => ({
    prev: student?.id === 's_1' ? previousSessionForS1 : null,
    loading: false,
  }),
}));
vi.mock('../../data/records.repo', () => ({
  saveRecord: (...args: unknown[]) => saveRecordMock(...args),
  getRecordsByDate: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../data/publishStats', () => ({
  republishPublicStatsFor: vi.fn().mockResolvedValue(undefined),
}));

function renderScreen(editRecord: SessionRecord | null = null) {
  return render(
    <ToastProvider>
      <RecordScreen editRecord={editRecord} onEditConsumed={() => {}} />
    </ToastProvider>,
  );
}

const studentBox = () => screen.getByPlaceholderText('ابحث أو اختر اسم الطالب…');

async function pickStudent(name: string) {
  const input = studentBox();
  await userEvent.click(input);
  await userEvent.clear(input);
  await userEvent.type(input, name);
  await userEvent.click(screen.getByRole('button', { name }));
}

/** The sura pickers, in DOM order: [0] = اللوح الجديد, [1] = مراجعة الماضي. */
const suraBoxes = () => screen.getAllByPlaceholderText('اكتب اسم السورة…');

const dateBox = () => screen.getByLabelText('تاريخ الجلسة') as HTMLInputElement;

const saveButton = () => screen.getByRole('button', { name: /حفظ الجلسة|تحديث الجلسة/ });

const prevSession: SessionRecord = {
  id: 'r_prev',
  studentId: 's_1',
  student: 'زيد احمد',
  date: '2026-07-20',
  newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
  newMadi: [{ sura: 'آل عمران', from: '1', to: '20' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  previousSessionForS1 = null;
});

describe('RecordScreen — a started-but-incomplete sura row blocks the save', () => {
  it('refuses to save when a typed sura name never matched a real sura', async () => {
    renderScreen();
    await pickStudent('سالم');

    // "بقرة" is not a sura name — the real one is "البقرة" — so the picker
    // commits nothing and the row is left with no sura at all.
    await userEvent.type(suraBoxes()[0], 'بقرة');
    await userEvent.click(saveButton());

    expect(await screen.findByText(/اللوح — السورة الأولى/)).toBeInTheDocument();
    // Nothing was written and the review modal never opened.
    expect(saveRecordMock).not.toHaveBeenCalled();
    expect(screen.queryByText('مراجعة قبل الحفظ')).not.toBeInTheDocument();
  });

  it('names the section and the row so the teacher knows where to look', async () => {
    renderScreen();
    await pickStudent('سالم');

    // Second row of مراجعة الماضي: complete the first, then half-fill another.
    await userEvent.click(suraBoxes()[1]);
    await userEvent.click(screen.getByRole('button', { name: /^1\. الفاتحة/ }));
    await userEvent.click(screen.getAllByRole('button', { name: '+ إضافة سورة' })[1]);
    await userEvent.type(suraBoxes()[2], 'ناس');
    await userEvent.click(saveButton());

    expect(await screen.findByText(/الماضي — سورة 2/)).toBeInTheDocument();
    expect(saveRecordMock).not.toHaveBeenCalled();
  });

  it('refuses a whole-sura range that has a start but no end sura', async () => {
    renderScreen();
    await pickStudent('سالم');

    await userEvent.click(screen.getAllByRole('checkbox')[0]); // 🔗 نطاق سور on the loh row
    await userEvent.click(suraBoxes()[0]);
    await userEvent.click(screen.getByRole('button', { name: /^114\. الناس/ }));
    await userEvent.click(saveButton());

    expect(await screen.findByText(/اللوح — السورة الأولى/)).toBeInTheDocument();
    expect(saveRecordMock).not.toHaveBeenCalled();
  });

  it('still saves normally once the row names a real sura', async () => {
    renderScreen();
    await pickStudent('سالم');

    await userEvent.click(suraBoxes()[0]);
    await userEvent.click(screen.getByRole('button', { name: /^114\. الناس/ }));
    await userEvent.click(saveButton());

    // Reaches the review-before-save modal instead of being blocked.
    expect(await screen.findByText('مراجعة قبل الحفظ')).toBeInTheDocument();
  });

  it('leaves an untouched blank row alone — only started rows are checked', async () => {
    renderScreen();
    await pickStudent('سالم');

    await userEvent.click(suraBoxes()[0]);
    await userEvent.click(screen.getByRole('button', { name: /^114\. الناس/ }));
    // A second, completely untouched row must not block anything.
    await userEvent.click(screen.getAllByRole('button', { name: '+ إضافة سورة' })[0]);
    await userEvent.click(saveButton());

    expect(await screen.findByText('مراجعة قبل الحفظ')).toBeInTheDocument();
  });
});

describe('RecordScreen — a correction to the previous session counts as unsaved work', () => {
  it('warns before switching students when the "إلى" ayah was corrected', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await pickStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const endBox = screen.getByLabelText('آخر آية اتحفظت في البقرة');
    await userEvent.clear(endBox);
    await userEvent.type(endBox, '5');

    await pickStudent('سالم');

    expect(await screen.findByText('بيانات لسه متحفظتش')).toBeInTheDocument();
    // The form still belongs to زيد until the teacher confirms.
    expect(studentBox()).toHaveValue('زيد احمد');
  });

  it('does not warn when the correction was typed and then undone', async () => {
    previousSessionForS1 = prevSession;
    renderScreen();
    await pickStudent('زيد احمد');
    await screen.findByText('📋 ما سمعناه النهارده');

    const endBox = screen.getByLabelText('آخر آية اتحفظت في البقرة');
    await userEvent.clear(endBox);
    await userEvent.type(endBox, '5');
    await userEvent.clear(endBox);
    await userEvent.type(endBox, '10'); // back to what was stored

    await pickStudent('سالم');

    expect(screen.queryByText('بيانات لسه متحفظتش')).not.toBeInTheDocument();
    expect(studentBox()).toHaveValue('سالم');
  });
});

describe('RecordScreen — the recording-run date survives an edit', () => {
  it('restores the date the teacher was working on when the edit is cancelled', async () => {
    const { rerender } = renderScreen();
    fireEvent.input(dateBox(), { target: { value: '2026-08-24' } });
    expect(dateBox()).toHaveValue('2026-08-24');

    rerender(
      <ToastProvider>
        <RecordScreen
          editRecord={{ ...prevSession, id: 'r_old', date: '2026-07-10' }}
          onEditConsumed={() => {}}
        />
      </ToastProvider>,
    );
    expect(dateBox()).toHaveValue('2026-07-10');

    await userEvent.click(screen.getByRole('button', { name: 'إلغاء التعديل' }));
    expect(dateBox()).toHaveValue('2026-08-24');
  });

  it('keeps a date the teacher changed themselves while in edit mode', async () => {
    const { rerender } = renderScreen();
    fireEvent.input(dateBox(), { target: { value: '2026-08-24' } });

    rerender(
      <ToastProvider>
        <RecordScreen
          editRecord={{ ...prevSession, id: 'r_old', date: '2026-07-10' }}
          onEditConsumed={() => {}}
        />
      </ToastProvider>,
    );
    fireEvent.input(dateBox(), { target: { value: '2026-07-12' } });

    await userEvent.click(screen.getByRole('button', { name: 'إلغاء التعديل' }));
    expect(dateBox()).toHaveValue('2026-07-12');
  });
});
