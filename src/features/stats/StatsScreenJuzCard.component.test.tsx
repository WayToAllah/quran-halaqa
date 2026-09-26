import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { StatsScreen } from './StatsScreen';
import type { SessionRecord, Student } from '../../types';

// زيد and عمر sit in جزء عمّ, علي in تبارك, حسن has come round to البقرة
// (الجزء الأول), أنس is still on الفاتحة, and سيف has an assignment nobody has
// heard yet — so he is nowhere on the path.
const students: Student[] = [
  { id: 's_1', name: 'زيد' },
  { id: 's_2', name: 'عمر' },
  { id: 's_3', name: 'علي' },
  { id: 's_4', name: 'حسن' },
  { id: 's_5', name: 'أنس' },
  { id: 's_6', name: 'سيف' },
];

const DAYS = ['2026-07-01', '2026-07-08'];

function sess(
  studentId: string,
  day: number,
  loh: { sura: string; from: string; to: string } | null,
  graded = true,
): SessionRecord {
  return {
    id: `r_${studentId}_${day}`,
    studentId,
    date: DAYS[day],
    ...(graded ? { loh: { score: 90 } } : {}),
    ...(loh ? { newLoh: [loh] } : {}),
  };
}

const records: SessionRecord[] = [
  sess('s_1', 0, { sura: 'الناس', from: '1', to: '6' }),
  sess('s_1', 1, null),
  sess('s_2', 0, { sura: 'النبأ', from: '1', to: '20' }),
  sess('s_2', 1, null),
  sess('s_3', 0, { sura: 'الملك', from: '1', to: '10' }),
  sess('s_3', 1, null),
  sess('s_4', 0, { sura: 'البقرة', from: '1', to: '5' }),
  sess('s_4', 1, null),
  sess('s_5', 0, { sura: 'الفاتحة', from: '1', to: '7' }),
  sess('s_5', 1, null),
  sess('s_6', 0, { sura: 'الفلق', from: '1', to: '5' }, false),
];

vi.mock('../../hooks/useStudents', () => ({
  useStudents: () => ({ students, loaded: true }),
}));
vi.mock('../../hooks/useAllRecords', () => ({
  useAllRecords: () => ({ records, loaded: true }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function juzCard(): HTMLElement {
  return screen.getByText('🧭 توزيع الطلاب على الأجزاء').closest('[data-card]') as HTMLElement;
}

describe('StatsScreen — توزيع الأجزاء', () => {
  it('shows a row per occupied juz, named the way the halaqa says it', () => {
    render(<StatsScreen />);
    const text = juzCard().textContent ?? '';
    expect(text).toContain('عمّ');
    expect(text).toContain('تبارك');
    expect(text).toContain('الفاتحة');
  });

  it('does not list ajzaa nobody is in', () => {
    render(<StatsScreen />);
    expect(juzCard().textContent).not.toContain('سبحان الذي');
  });

  it('reports how many students have not recited anything yet', () => {
    render(<StatsScreen />);
    expect(juzCard().textContent).toContain('لم يُسمِّع بعد');
  });

  it('keeps the names hidden until asked, then shows who is where', async () => {
    render(<StatsScreen />);
    expect(juzCard().textContent).not.toContain('زيد');
    await userEvent.click(screen.getByLabelText(/عرض الأسماء — توزيع الطلاب على الأجزاء/));
    const text = juzCard().textContent ?? '';
    expect(text).toContain('زيد');
    expect(text).toContain('عمر');
    expect(text).toContain('أنس');
  });

  it('never shows a student who has not recited among the placed ones', async () => {
    render(<StatsScreen />);
    await userEvent.click(screen.getByLabelText(/عرض الأسماء — توزيع الطلاب على الأجزاء/));
    expect(juzCard().textContent).not.toContain('سيف');
  });
});
