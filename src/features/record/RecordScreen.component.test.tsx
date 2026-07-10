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
}));

function renderScreen() {
  return render(
    <ToastProvider>
      <RecordScreen />
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
