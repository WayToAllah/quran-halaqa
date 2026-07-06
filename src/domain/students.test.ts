import { describe, it, expect } from 'vitest';
import { displayStudentName, getStudentName, recordsForStudent, studentHasRecordOnDate, studentMatch } from './students';
import type { SessionRecord, Student } from '../types';

const zaid: Student = { id: 's_1', name: 'زيد احمد' };
const rewound: Student = { id: 's_2', name: 'رنيم' };

describe('studentMatch', () => {
  it('matches by studentId when both have one (primary path)', () => {
    const rec = { studentId: 's_1', student: 'اسم قديم مختلف' };
    expect(studentMatch(rec, zaid)).toBe(true);
  });

  it('does not match a different studentId even with the same name string', () => {
    const rec = { studentId: 's_2', student: 'زيد احمد' };
    expect(studentMatch(rec, zaid)).toBe(false);
  });

  it('falls back to name matching for legacy records with no studentId', () => {
    const rec = { student: 'زيد احمد' };
    expect(studentMatch(rec, zaid)).toBe(true);
  });

  it('returns false for null/undefined inputs', () => {
    expect(studentMatch(null, zaid)).toBe(false);
    expect(studentMatch({ student: 'x' }, null)).toBe(false);
  });
});

describe('displayStudentName', () => {
  const students = [zaid, rewound];

  it('resolves to the CURRENT name via studentId (renames propagate)', () => {
    const renamed: Student = { id: 's_1', name: 'زيد احمد الجديد' };
    const rec = { studentId: 's_1', student: 'زيد احمد' }; // stale snapshot
    expect(displayStudentName(rec, [renamed, rewound])).toBe('زيد احمد الجديد');
  });

  it('falls back to the record snapshot when the student was deleted', () => {
    const rec = { studentId: 's_deleted', student: 'طالب محذوف' };
    expect(displayStudentName(rec, students)).toBe('طالب محذوف');
  });

  it('falls back to em-dash when neither studentId nor student is present', () => {
    expect(displayStudentName({}, students)).toBe('—');
  });
});

describe('recordsForStudent', () => {
  it('filters records belonging to the given student only', () => {
    const records: SessionRecord[] = [
      { id: 'r1', studentId: 's_1', date: '2026-07-01' },
      { id: 'r2', studentId: 's_2', date: '2026-07-02' },
      { id: 'r3', studentId: 's_1', date: '2026-07-03' },
    ];
    const result = recordsForStudent(zaid, records);
    expect(result.map((r) => r.id)).toEqual(['r1', 'r3']);
  });
});

describe('studentHasRecordOnDate', () => {
  const records: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-01' },
    { id: 'att1', studentId: 's_1', date: '2026-07-02', attendance_only: true },
  ];
  it('is true for a date with any record (session or attendance-only)', () => {
    expect(studentHasRecordOnDate(zaid, '2026-07-01', records)).toBe(true);
    expect(studentHasRecordOnDate(zaid, '2026-07-02', records)).toBe(true);
  });
  it('is false for a date with no record at all', () => {
    expect(studentHasRecordOnDate(zaid, '2026-07-05', records)).toBe(false);
  });
});

describe('getStudentName', () => {
  it('accepts a bare string', () => {
    expect(getStudentName('اسم كنص')).toBe('اسم كنص');
  });
  it('accepts a Student object', () => {
    expect(getStudentName(zaid)).toBe('زيد احمد');
  });
});
