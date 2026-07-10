import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../ui/ToastProvider';
import { RecordScreen } from './RecordScreen';
import type { SessionRecord, Student } from '../../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
];

// Controllable so a test can simulate students arriving AFTER edit mode starts.
let studentsForHook: Student[] = students;

const saveRecordMock = vi.fn().mockResolvedValue(undefined);
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
  saveRecord: (...args: unknown[]) => saveRecordMock(...args),
}));

function renderScreen(props: { editRecord?: SessionRecord | null; onEditConsumed?: () => void } = {}) {
  return render(
    <ToastProvider>
      <RecordScreen editRecord={props.editRecord ?? null} onEditConsumed={props.onEditConsumed} />
    </ToastProvider>,
  );
}

async function selectStudent(name: string) {
  const input = screen.getByPlaceholderText('اكتب اسم الطالب...');
  await userEvent.click(input);
  await userEvent.type(input, name);
  await userEvent.click(screen.getByRole('button', { name }));
}

/** Pick a sura through the searchable combobox (replaces the old <select>).
 * `index` selects which sura input to use when several rows are present. */
async function pickSura(name: string, index = 0) {
  const inputs = screen.getAllByPlaceholderText('اكتب اسم السورة…');
  await userEvent.click(inputs[index]);
  await userEvent.type(inputs[index], name);
  // dropdown option button reads "N. الاسم  count آية · صفحة…" — match on the name
  const option = await screen.findByRole('button', { name: new RegExp(`\\d+\\. ${name}`) });
  await userEvent.click(option);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
  previousSessionForS1 = null;
  studentsForHook = students;
});

describe('RecordScreen — student picker', () => {
  it('defaults the date to today', () => {
    renderScreen();
    const dateInput = screen.getByDisplayValue(new Date().toISOString().slice(0, 10)) as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
  });

  it('filters and selects a student, normalizing Arabic hamza forms', async () => {
    renderScreen();
    const input = screen.getByPlaceholderText('اكتب اسم الطالب...');
    await userEvent.click(input);
    await userEvent.type(input, 'احمد'); // no hamza, must still match "زيد احمد"
    await userEvent.click(screen.getByRole('button', { name: 'زيد احمد' }));
    expect((input as HTMLInputElement).value).toBe('زيد احمد');
  });
});

describe('RecordScreen — previous session card', () => {
  it('is hidden when the student has no previous session', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    expect(screen.queryByText('📋 ما سمعناه النهارده')).not.toBeInTheDocument();
  });

  it('shows the previous assignment and lets the admin enter an evaluation score', async () => {
    previousSessionForS1 = {
      id: 'r_prev',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
    };
    renderScreen();
    await selectStudent('زيد احمد');
    expect(screen.getByText('📋 ما سمعناه النهارده')).toBeInTheDocument();
    expect(screen.getByText(/سورة البقرة/)).toBeInTheDocument();
  });

  it('only shows the madi sub-section when a previous madi assignment exists', async () => {
    previousSessionForS1 = {
      id: 'r_prev',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
    };
    renderScreen();
    await selectStudent('زيد احمد');
    expect(screen.queryByText('الماضي')).not.toBeInTheDocument();
  });
});

describe('RecordScreen — multi-sura rows', () => {
  it('adds and removes loh rows', async () => {
    renderScreen();
    const addButtons = screen.getAllByRole('button', { name: '+ إضافة سورة' });
    await userEvent.click(addButtons[0]); // loh add button
    expect(screen.getAllByText(/سورة \d/).length).toBeGreaterThan(0); // "سورة 2" row label appeared
    await userEvent.click(screen.getAllByRole('button', { name: '✕ حذف' })[0]);
    expect(screen.queryByText('سورة 2')).not.toBeInTheDocument();
  });
});

describe('RecordScreen — save validation', () => {
  it('rejects saving without a selected student', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
    expect(screen.getByText('اختر طالباً أولاً')).toBeInTheDocument();
    expect(saveRecordMock).not.toHaveBeenCalled();
  });

  it('asks for confirmation before saving a completely empty session, and respects "cancel"', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    renderScreen();
    await selectStudent('زيد احمد');
    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
    expect(saveRecordMock).not.toHaveBeenCalled();
  });

  it('saves without confirmation when a note is present (non-empty session)', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await userEvent.type(screen.getByPlaceholderText('اختيارية', { exact: false }), 'ملاحظة تجريبية');
    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
  });
});

describe('RecordScreen — save flow', () => {
  it('builds a correct record and resets the form on success (keeping the date)', async () => {
    renderScreen();
    await selectStudent('زيد احمد');

    // fill first loh row
    await pickSura('البقرة');
    const fromInputs = screen.getAllByPlaceholderText('من آية');
    const toInputs = screen.getAllByPlaceholderText('إلى آية');
    await userEvent.type(fromInputs[0], '1');
    await userEvent.type(toInputs[0], '10');

    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));

    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
    const savedRecord = saveRecordMock.mock.calls[0][2];
    expect(savedRecord.studentId).toBe('s_1');
    expect(savedRecord.newLoh).toEqual([{ sura: 'البقرة', from: '1', to: '10' }]);

    // form resets: student field clears
    expect(screen.getByPlaceholderText('اكتب اسم الطالب...')).toHaveValue('');
  });

  it('mistake counter fills the loh score and saves the tally into the record', async () => {
    previousSessionForS1 = {
      id: 'r_prev',
      studentId: 's_1',
      date: '2026-07-01',
      newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
    };
    renderScreen();
    await selectStudent('زيد احمد');

    // open the loh mistake counter, tap two full + two tajweed mistakes
    await userEvent.click(screen.getByRole('button', { name: /عدّاد الأخطاء/ }));
    await userEvent.click(screen.getByText('➖ خطأ'));
    await userEvent.click(screen.getByText('➖ خطأ'));
    await userEvent.click(screen.getByText('➖ خطأ تجويدي'));
    await userEvent.click(screen.getByText('➖ خطأ تجويدي'));
    // 100 - 2 - 1 = 97
    await userEvent.click(screen.getByRole('button', { name: /حفظ الدرجة/ }));

    // score field now shows 97
    expect(screen.getByDisplayValue('97')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
    const savedRecord = saveRecordMock.mock.calls[0][2];
    expect(savedRecord.loh.score).toBe(97);
    expect(savedRecord.loh.mistakes).toEqual({ full: 2, tajweed: 2 });
    // madi eval was untouched, so it carries no mistakes field
    expect(savedRecord.madi.mistakes).toBeUndefined();
  });

  it('shows an error toast and keeps form data on failure', async () => {
    saveRecordMock.mockRejectedValueOnce(new Error('network'));
    renderScreen();
    await selectStudent('زيد احمد');
    await userEvent.type(screen.getByPlaceholderText('اختيارية', { exact: false }), 'ملاحظة');
    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));

    await waitFor(() => expect(screen.getByText(/فشل الحفظ/)).toBeInTheDocument());
    // student selection preserved after failure
    expect(screen.getByPlaceholderText('اكتب اسم الطالب...')).toHaveValue('زيد احمد');
  });

  it('rejects an out-of-range ayah before calling saveRecord', async () => {
    renderScreen();
    await selectStudent('زيد احمد');
    await pickSura('الفاتحة'); // only 7 ayat
    const fromInputs = screen.getAllByPlaceholderText('من آية');
    await userEvent.type(fromInputs[0], '1');
    const toInputs = screen.getAllByPlaceholderText('إلى آية');
    await userEvent.type(toInputs[0], '20'); // out of range

    await userEvent.click(screen.getByRole('button', { name: /حفظ الجلسة/ }));
    expect(screen.getByText(/يوجد خطأ في أرقام الآيات/)).toBeInTheDocument();
    expect(saveRecordMock).not.toHaveBeenCalled();
  });
});

describe('RecordScreen — tajweed toggle', () => {
  it('hides tajweed fields until the toggle is checked', () => {
    renderScreen();
    expect(screen.queryByText('سورة التجويد')).not.toBeInTheDocument();
  });

  it('shows tajweed fields once toggled on', async () => {
    renderScreen();
    const toggle = screen.getByRole('checkbox');
    await userEvent.click(toggle);
    expect(screen.getByText('سورة التجويد')).toBeInTheDocument();
  });
});

describe('RecordScreen — edit mode', () => {
  const editRec: SessionRecord = {
    id: 'r_edit_1',
    studentId: 's_1',
    student: 'زيد احمد',
    date: '2026-07-05',
    loh: { score: 90, stars: 4, mistakes: { full: 2, tajweed: 1 } },
    madi: { score: 80, stars: 4 },
    newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
    newMadi: [{ sura: 'الفاتحة', from: '1', to: '7' }],
    note: 'ملاحظة قديمة',
  };

  it('pre-fills the form from the record being edited', async () => {
    renderScreen({ editRecord: editRec });
    // edit banner + updated save label
    expect(await screen.findByText(/تعديل جلسة محفوظة/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تحديث الجلسة/ })).toBeInTheDocument();
    // student, date, scores, note prefilled
    expect(screen.getByDisplayValue('زيد احمد')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-07-05')).toBeInTheDocument();
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ملاحظة قديمة')).toBeInTheDocument();
    // the assigned suras must appear in the SuraRow inputs (regression: the
    // combobox kept its empty initial query and showed only the tiny page hint)
    expect(screen.getByDisplayValue('البقرة')).toBeInTheDocument();
    expect(screen.getByDisplayValue('الفاتحة')).toBeInTheDocument();
    // the loh mistake counter carries its restored tally (2 full + 1 tajweed = 3)
    expect(screen.getByRole('button', { name: /عدّاد الأخطاء.*\(3\)/ })).toBeInTheDocument();
  });

  it('still fills the form when the students list loads AFTER edit mode starts', async () => {
    // Reproduce the real bug: opening ✏️ from a search result hands the record
    // in before useStudents has resolved. The evaluation card (which needs
    // selectedStudent) and the scores must still appear once students arrive.
    studentsForHook = []; // students not loaded yet
    const { rerender } = renderScreen({ editRecord: editRec });
    // edit mode engaged, but student not resolvable yet
    expect(await screen.findByText(/تعديل جلسة محفوظة/)).toBeInTheDocument();

    // students arrive
    studentsForHook = students;
    rerender(
      <ToastProvider>
        <RecordScreen editRecord={null} onEditConsumed={() => {}} />
      </ToastProvider>,
    );

    // the evaluation card + prefilled values now show
    expect(await screen.findByText('📋 ما سمعناه النهارده')).toBeInTheDocument();
    expect(screen.getByDisplayValue('زيد احمد')).toBeInTheDocument();
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
    expect(screen.getByDisplayValue('البقرة')).toBeInTheDocument();
  });

  it('overwrites the same record id on save and does not create a new one', async () => {
    const onEditConsumed = vi.fn();
    renderScreen({ editRecord: editRec, onEditConsumed });
    await screen.findByText(/تعديل جلسة محفوظة/);
    expect(onEditConsumed).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /تحديث الجلسة/ }));
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
    const saved = saveRecordMock.mock.calls[0][2];
    expect(saved.id).toBe('r_edit_1'); // same id — overwrite, not new
    expect(saved.studentId).toBe('s_1');
    expect(saved.loh.score).toBe(90);
    expect(saved.loh.mistakes).toEqual({ full: 2, tajweed: 1 });
  });

  it('does not open the WhatsApp preview after an edit save', async () => {
    renderScreen({ editRecord: editRec });
    await screen.findByText(/تعديل جلسة محفوظة/);
    await userEvent.click(screen.getByRole('button', { name: /تحديث الجلسة/ }));
    await waitFor(() => expect(saveRecordMock).toHaveBeenCalledTimes(1));
    // WhatsApp modal (new-homework message) must not appear on a correction
    expect(screen.queryByText(/واتساب|WhatsApp/i)).not.toBeInTheDocument();
    expect(screen.getByText(/تم تحديث الجلسة/)).toBeInTheDocument();
  });

  it('cancel edit clears the form back to a blank new session', async () => {
    renderScreen({ editRecord: editRec });
    await screen.findByText(/تعديل جلسة محفوظة/);
    await userEvent.click(screen.getByRole('button', { name: 'إلغاء التعديل' }));
    expect(screen.queryByText(/تعديل جلسة محفوظة/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /حفظ الجلسة/ })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('ملاحظة قديمة')).not.toBeInTheDocument();
  });
});
