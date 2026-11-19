import { describe, it, expect } from 'vitest';
import { buildLogSheet, buildStudentsSheet, exportFileName } from './excelExport';
import type { SessionRecord, Student } from '../types';
import type { Season } from './seasons';

const students: Student[] = [
  { id: 's1', name: 'زيد', phonePrimary: '0100', joinDate: '2026-09-01' },
  { id: 's2', name: 'عمرو' },
];

const rec = (p: Partial<SessionRecord>): SessionRecord =>
  ({ id: p.id ?? `r_${p.studentId}_${p.date}`, ...p }) as SessionRecord;

const records: SessionRecord[] = [
  rec({
    id: 'a',
    studentId: 's1',
    date: '2026-10-01',
    newLoh: [{ sura: 'النبأ', from: '1', to: '10' }],
    newMadi: [{ sura: 'الملك' }],
  }),
  rec({
    id: 'b',
    studentId: 's1',
    date: '2026-10-03',
    loh: { score: 90, mistakes: { full: 1, tajweed: 2 } },
    madi: { score: 80 },
    newLoh: [{ sura: 'النبأ', from: '11', to: '20' }],
    note: 'ممتاز',
  }),
  rec({ id: 'c', studentId: 's2', date: '2026-10-03', attendance_only: true }),
  // Before the season — must not count in the students sheet.
  rec({ id: 'old', studentId: 's2', date: '2026-08-01', loh: { score: 40 } }),
];

// The first season also owns everything before it (seasonRange), so the
// window under test is the second one.
const seasons: Season[] = [
  { id: 'summer', name: 'صيف 2026', from: '2026-06-01' },
  { id: 'study', name: 'موسم دراسة', from: '2026-09-27' },
];

describe('buildStudentsSheet', () => {
  const sheet = buildStudentsSheet(students, records, seasons, '2026-10-05');

  it('names the season it covers', () => {
    expect(sheet.title).toBe('موسم دراسة');
  });

  it('has one row per student on the roster, the absent included', () => {
    expect(sheet.rows.map((r) => r[0])).toEqual(['زيد', 'عمرو']);
  });

  it('fills the stats from the season only', () => {
    const col = (name: string) => sheet.header.indexOf(name);
    const zaid = sheet.rows[0];
    expect(zaid[col('رقم ولي الأمر')]).toBe('0100');
    expect(zaid[col('الجلسات')]).toBe(2);
    expect(zaid[col('أيام الحضور')]).toBe(2);
    expect(zaid[col('متوسط اللوح')]).toBe(90);
    expect(zaid[col('متوسط الماضي')]).toBe(80);
    expect(zaid[col('آخر جلسة')]).toBe('2026-10-03');

    const amr = sheet.rows[1];
    expect(amr[col('الجلسات')]).toBe(1); // the August record is outside the season
    expect(amr[col('متوسط اللوح')]).toBeNull(); // unassessed ≠ 0
  });
});

describe('buildLogSheet', () => {
  const sheet = buildLogSheet([records[1], records[2]], students, records);
  const col = (name: string) => sheet.header.indexOf(name);

  it('one row per session, in the order shown', () => {
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0][col('الطالب')]).toBe('زيد');
    expect(sheet.rows[1][col('الطالب')]).toBe('عمرو');
  });

  it('a mark sits next to the assignment it was given for (from the previous session)', () => {
    const r = sheet.rows[0];
    expect(r[col('التاريخ')]).toBe('2026-10-03');
    expect(r[col('اللوح المتسمّع')]).toBe('النبأ (1–10)');
    expect(r[col('درجة اللوح')]).toBe(90);
    expect(r[col('أخطاء اللوح')]).toBe('أخطاء 1 · تجويد 2');
    expect(r[col('الماضي المتسمّع')]).toBe('الملك');
    expect(r[col('درجة الماضي')]).toBe(80);
    expect(r[col('لوح جديد')]).toBe('النبأ (11–20)');
    expect(r[col('ملاحظة')]).toBe('ممتاز');
  });

  it('marks attendance-only days', () => {
    expect(sheet.rows[1][col('النوع')]).toBe('حضور فقط');
    expect(sheet.rows[1][col('درجة اللوح')]).toBeNull();
  });
});

describe('exportFileName', () => {
  it('is safe on every OS and dated', () => {
    expect(exportFileName('سجل', '2026-11-19')).toBe('سجل-2026-11-19.xlsx');
    expect(exportFileName('طلاب: صيف/2026', '2026-11-19')).toBe('طلاب- صيف-2026-2026-11-19.xlsx');
  });
});
