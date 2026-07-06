import { describe, it, expect } from 'vitest';
import { findPreviousSession, extractAssignedSuras, validateAyahRange } from './record';
import type { SessionRecord, Student } from '../types';

const zaid: Student = { id: 's_1', name: 'زيد احمد' };

describe('findPreviousSession', () => {
  const records: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'الفاتحة' }] },
    { id: 'r2', studentId: 's_1', date: '2026-07-03', newLoh: [{ sura: 'البقرة' }] },
    { id: 'r3', studentId: 's_1', date: '2026-07-05', newLoh: [{ sura: 'آل عمران' }] },
    { id: 'att1', studentId: 's_1', date: '2026-07-04', attendance_only: true },
  ];

  it('returns the most recent real (non-attendance-only) session', () => {
    const result = findPreviousSession(zaid, records);
    expect(result?.id).toBe('r3');
  });

  it('excludes attendance-only records entirely', () => {
    const onlyAttendance: SessionRecord[] = [{ id: 'a1', studentId: 's_1', date: '2026-07-01', attendance_only: true }];
    expect(findPreviousSession(zaid, onlyAttendance)).toBeNull();
  });

  it('returns null when the student has no sessions', () => {
    expect(findPreviousSession({ id: 's_new', name: 'جديد' }, records)).toBeNull();
  });

  it('when editing a session, excludes it and anything not strictly before it', () => {
    // Editing r3 (the latest) — "previous" must be r2, not r3 itself.
    const result = findPreviousSession(zaid, records, 'r3');
    expect(result?.id).toBe('r2');
  });

  it('when editing the OLDEST session, there is no valid previous session', () => {
    const result = findPreviousSession(zaid, records, 'r1');
    expect(result).toBeNull();
  });
});

describe('extractAssignedSuras', () => {
  it('prefers the modern array field when present', () => {
    const result = extractAssignedSuras([{ sura: 'البقرة', from: '1', to: '10' }], { sura: 'legacy' });
    expect(result).toEqual([{ sura: 'البقرة', from: '1', to: '10' }]);
  });

  it('filters out empty entries from the array field', () => {
    const result = extractAssignedSuras([{ sura: '' }, { sura: 'البقرة' }], undefined);
    expect(result).toEqual([{ sura: 'البقرة' }]);
  });

  it('falls back to the legacy single-object shape when the array is empty/missing', () => {
    const result = extractAssignedSuras(undefined, { sura: 'الفاتحة', from: '1', to: '7' });
    expect(result).toEqual([{ sura: 'الفاتحة', from: '1', to: '7' }]);
  });

  it('returns an empty array when neither shape has data', () => {
    expect(extractAssignedSuras(undefined, undefined)).toEqual([]);
    expect(extractAssignedSuras([], { score: 90 })).toEqual([]); // legacy ScoreEval has no .sura
  });
});

describe('validateAyahRange', () => {
  it('returns no errors for an unrecognized sura name', () => {
    expect(validateAyahRange('سورة غير موجودة', '1', '5')).toEqual({});
  });

  it('returns no errors when fields are empty', () => {
    expect(validateAyahRange('البقرة', '', '')).toEqual({});
  });

  it('flags a from-ayah below 1', () => {
    expect(validateAyahRange('الفاتحة', '0', '')).toHaveProperty('fromError');
  });

  it('flags a from/to-ayah beyond the sura length', () => {
    const errors = validateAyahRange('الفاتحة', '1', '10'); // الفاتحة has only 7 ayat
    expect(errors.toError).toContain('١');
  });

  it('flags "to" being less than "from"', () => {
    const errors = validateAyahRange('البقرة', '10', '5');
    expect(errors.toError).toBe('يجب أن تكون أكبر من آية البداية');
  });

  it('accepts a valid in-range, in-order pair', () => {
    expect(validateAyahRange('البقرة', '1', '10')).toEqual({});
  });
});
