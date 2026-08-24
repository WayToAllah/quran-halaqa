import { describe, it, expect } from 'vitest';
import {
  isRepeatGrade,
  assignmentsGradedRepeat,
  findPreviousSession,
  extractAssignedSuras,
  validateAyahRange,
  isRowComplete,
  isRowStarted,
  firstIncompleteRow,
  assignmentPairSignature,
  cleanAssignmentRow,
  cleanTajweed,
  rowsSignature,
  sessionGrading,
} from './record';
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
    const onlyAttendance: SessionRecord[] = [
      { id: 'a1', studentId: 's_1', date: '2026-07-01', attendance_only: true },
    ];
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
    const result = extractAssignedSuras([{ sura: 'البقرة', from: '1', to: '10' }], {
      sura: 'legacy',
    });
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
    expect(validateAyahRange('الفاتحة', '0', '3')).toHaveProperty('fromError');
  });

  it('does not flag "من" filled without "إلى" (auto-fill leaves it blank on purpose)', () => {
    expect(validateAyahRange('البقرة', '5', '')).toEqual({});
  });

  it('does not flag an empty range (both ends blank = whole sura)', () => {
    expect(validateAyahRange('البقرة', '', '')).toEqual({});
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

describe('isRowComplete', () => {
  it('accepts a per-sura row with just a sura', () => {
    expect(isRowComplete({ sura: 'الفاتحة' })).toBe(true);
  });
  it('rejects an empty row', () => {
    expect(isRowComplete({ sura: '' })).toBe(false);
  });
  it('accepts a whole-sura range with both ends', () => {
    expect(isRowComplete({ sura: 'الملك', toSura: 'الناس', range: true })).toBe(true);
  });
  it('rejects a range missing its end sura', () => {
    expect(isRowComplete({ sura: 'الملك', range: true })).toBe(false);
  });
  it('rejects a range missing its start sura', () => {
    expect(isRowComplete({ sura: '', toSura: 'الناس', range: true })).toBe(false);
  });
});

describe('cleanAssignmentRow', () => {
  it('keeps a per-sura row with its ayah range and no range fields', () => {
    expect(cleanAssignmentRow({ sura: 'البقرة', from: '1', to: '10' })).toEqual({
      sura: 'البقرة',
      from: '1',
      to: '10',
    });
  });
  it('omits empty from/to on a per-sura row', () => {
    expect(cleanAssignmentRow({ sura: 'الفاتحة', from: '', to: '' })).toEqual({ sura: 'الفاتحة' });
  });
  it('saves a whole-sura range as {sura, toSura, range}', () => {
    expect(cleanAssignmentRow({ sura: 'الملك', toSura: 'الناس', range: true })).toEqual({
      sura: 'الملك',
      toSura: 'الناس',
      range: true,
    });
  });
  it('strips leftover ayah numbers from a range row (toggle residue)', () => {
    // A row toggled from per-sura → range could still carry stale from/to.
    expect(
      cleanAssignmentRow({ sura: 'الملك', toSura: 'الناس', range: true, from: '3', to: '9' }),
    ).toEqual({ sura: 'الملك', toSura: 'الناس', range: true });
  });
  it('strips range/toSura when the row is not a valid range', () => {
    // range:true but no toSura → treated as an ordinary per-sura row.
    expect(cleanAssignmentRow({ sura: 'الملك', range: true })).toEqual({ sura: 'الملك' });
  });
});

describe('cleanTajweed', () => {
  it('keeps a plain sura + ayah range as-is', () => {
    expect(cleanTajweed({ sura: 'البقرة', from: '1', to: '5' }, 4, ' إدغام ')).toEqual({
      sura: 'البقرة',
      from: '1',
      to: '5',
      stars: 4,
      note: 'إدغام',
    });
  });

  it('never emits undefined when the range toggle removed the ayah fields', () => {
    // Firestore rejects an undefined field value outright, which used to make
    // the entire save fail with a generic error.
    const out = cleanTajweed({ sura: 'الناس', toSura: 'الفلق', range: true }, 3, '');
    expect(out).toEqual({ sura: 'الناس', from: '', to: '', stars: 3, note: '' });
    expect(Object.values(out).some((v) => v === undefined)).toBe(false);
  });

  it('does not persist toSura/range — tajweed is always a specific passage', () => {
    const out = cleanTajweed({ sura: 'الناس', toSura: 'الفلق', range: true }, 0, '');
    expect(out).not.toHaveProperty('toSura');
    expect(out).not.toHaveProperty('range');
  });
});

describe('rowsSignature', () => {
  it('is stable across key order and missing optional fields', () => {
    expect(rowsSignature([{ from: '1', sura: 'البقرة', to: '10' }])).toBe(
      rowsSignature([{ sura: 'البقرة', from: '1', to: '10' }]),
    );
    expect(rowsSignature([{ sura: 'الفاتحة' }])).toBe(
      rowsSignature([{ sura: 'الفاتحة', from: '', to: '' }]),
    );
  });

  it('changes when the teacher edits any field', () => {
    const base = rowsSignature([{ sura: 'البقرة', from: '1', to: '10' }]);
    expect(rowsSignature([{ sura: 'البقرة', from: '1', to: '11' }])).not.toBe(base);
    expect(rowsSignature([{ sura: 'آل عمران', from: '1', to: '10' }])).not.toBe(base);
    expect(rowsSignature([{ sura: 'البقرة', from: '1', to: '10' }, { sura: 'النساء' }])).not.toBe(
      base,
    );
  });

  it('distinguishes a whole-sura range from an ordinary row on the same sura', () => {
    expect(rowsSignature([{ sura: 'الناس', toSura: 'الفلق', range: true }])).not.toBe(
      rowsSignature([{ sura: 'الناس' }]),
    );
  });
});

describe('isRepeatGrade', () => {
  it('treats a genuine zero as إعادة, not as "unscored"', () => {
    expect(isRepeatGrade({ score: 0 })).toBe(true);
  });

  it('follows the band boundary rather than a hard-coded number', () => {
    expect(isRepeatGrade({ score: 59 })).toBe(true);
    expect(isRepeatGrade({ score: 60 })).toBe(false); // مقبول
    expect(isRepeatGrade({ score: 100 })).toBe(false);
  });

  it('is false for work that simply has not been graded', () => {
    expect(isRepeatGrade(null)).toBe(false);
    expect(isRepeatGrade(undefined)).toBe(false);
    expect(isRepeatGrade({ score: null })).toBe(false);
    expect(isRepeatGrade({})).toBe(false);
  });
});

describe('assignmentsGradedRepeat', () => {
  const recs: SessionRecord[] = [
    { id: 'r1', studentId: 's_1', date: '2026-07-01', newLoh: [{ sura: 'البقرة' }] },
    // grades r1's assignment as إعادة, and hands out its own
    {
      id: 'r2',
      studentId: 's_1',
      date: '2026-07-03',
      loh: { score: 50 },
      newLoh: [{ sura: 'البقرة' }],
    },
    // grades r2's assignment as a pass
    {
      id: 'r3',
      studentId: 's_1',
      date: '2026-07-05',
      loh: { score: 90 },
      newLoh: [{ sura: 'آل عمران' }],
    },
  ];

  it("marks an assignment by the NEXT session's grade, not its own record", () => {
    const map = assignmentsGradedRepeat(recs);
    expect(map.get('r1')!.loh).toBe(true); // failed on 07-03
    expect(map.get('r2')!.loh).toBe(false); // passed on 07-05
  });

  it('leaves the newest assignment unflagged — it has not been recited yet', () => {
    expect(assignmentsGradedRepeat(recs).get('r3')!.loh).toBe(false);
  });

  it('grades loh and madi independently', () => {
    const map = assignmentsGradedRepeat([
      { id: 'a', studentId: 's_1', date: '2026-07-01' },
      { id: 'b', studentId: 's_1', date: '2026-07-03', loh: { score: 40 }, madi: { score: 95 } },
    ]);
    expect(map.get('a')).toEqual({ loh: true, madi: false });
  });

  it('never lets one student\u2019s grade fall onto another student\u2019s assignment', () => {
    const map = assignmentsGradedRepeat([
      { id: 'z1', studentId: 's_1', date: '2026-07-01' },
      { id: 'm1', studentId: 's_2', date: '2026-07-02', loh: { score: 10 } },
      { id: 'z2', studentId: 's_1', date: '2026-07-03', loh: { score: 95 } },
    ]);
    // زيد passed on 07-03; محمد's failure on 07-02 must not touch him.
    expect(map.get('z1')!.loh).toBe(false);
  });

  it('ignores attendance-only days when deciding what comes next', () => {
    const map = assignmentsGradedRepeat([
      { id: 'p1', studentId: 's_1', date: '2026-07-01' },
      { id: 'att', studentId: 's_1', date: '2026-07-02', attendance_only: true },
      { id: 'p2', studentId: 's_1', date: '2026-07-03', loh: { score: 20 } },
    ]);
    expect(map.get('p1')!.loh).toBe(true);
    expect(map.has('att')).toBe(false);
  });
});

describe('sessionGrading', () => {
  const base = { studentId: 's_1', student: 'زيد' };
  // 20th hands out البقرة 1–10; the 25th marks it. Deleting the 20th would
  // leave the 25th's score pointing at nothing.
  const jul20: SessionRecord = {
    ...base,
    id: 'r_20',
    date: '2026-07-20',
    newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
  };
  const jul25: SessionRecord = {
    ...base,
    id: 'r_25',
    date: '2026-07-25',
    loh: { score: 90 },
    newLoh: [{ sura: 'البقرة', from: '11', to: '20' }],
  };

  it('finds the next session that marked the assignment', () => {
    expect(sessionGrading(jul20, [jul20, jul25])?.id).toBe('r_25');
  });

  it('returns null when the next session has not been marked yet', () => {
    const unmarked: SessionRecord = { ...jul25, loh: undefined, madi: undefined };
    expect(sessionGrading(jul20, [jul20, unmarked])).toBeNull();
  });

  it('returns null when the session handed out no assignment', () => {
    const noAssignment: SessionRecord = { ...jul20, newLoh: [], newMadi: [] };
    expect(sessionGrading(noAssignment, [noAssignment, jul25])).toBeNull();
  });

  it('picks the IMMEDIATE successor, not the newest session', () => {
    const jul30: SessionRecord = { ...base, id: 'r_30', date: '2026-07-30', loh: { score: 80 } };
    expect(sessionGrading(jul20, [jul30, jul20, jul25])?.id).toBe('r_25');
  });

  it('ignores other students entirely', () => {
    const other: SessionRecord = { ...jul25, id: 'r_x', studentId: 's_2' };
    expect(sessionGrading(jul20, [jul20, other])).toBeNull();
  });

  it('ignores attendance-only rows on both sides of the pair', () => {
    const att: SessionRecord = { ...base, id: 'r_att', date: '2026-07-22', attendance_only: true };
    // An attendance row between them must not be mistaken for the marker...
    expect(sessionGrading(jul20, [jul20, att, jul25])?.id).toBe('r_25');
    // ...and an attendance row itself grades nothing.
    expect(sessionGrading(att, [jul20, att, jul25])).toBeNull();
  });

  it('treats a genuine zero as a mark — إعادة still depends on the assignment', () => {
    const failed: SessionRecord = { ...jul25, loh: { score: 0 } };
    expect(sessionGrading(jul20, [jul20, failed])?.id).toBe('r_25');
  });

  it('returns null when nothing follows the session', () => {
    expect(sessionGrading(jul25, [jul20, jul25])).toBeNull();
  });
});

describe('isRowStarted', () => {
  it('is false for an untouched blank row', () => {
    expect(isRowStarted({ sura: '', from: '', to: '' })).toBe(false);
  });

  it('is true for text the picker could not resolve to a sura', () => {
    // The picker commits sura:'' for anything it can't match, so without the
    // draft this row is byte-identical to a blank one.
    expect(isRowStarted({ sura: '', draft: 'بقرة' })).toBe(true);
  });

  it('is true for an unresolved end sura in range mode', () => {
    expect(isRowStarted({ sura: '', toSuraDraft: 'فلق', range: true })).toBe(true);
  });

  it('is true when only ayah numbers were typed', () => {
    expect(isRowStarted({ sura: '', from: '3' })).toBe(true);
  });
});

describe('firstIncompleteRow', () => {
  it('ignores blank rows entirely', () => {
    expect(firstIncompleteRow([{ sura: 'الناس' }, { sura: '', from: '', to: '' }])).toBeNull();
  });

  it('reports an unresolved sura name and where it is', () => {
    expect(firstIncompleteRow([{ sura: 'الناس' }, { sura: '', draft: 'بقرة' }])).toEqual({
      index: 1,
      reason: 'اسم السورة مش متحدد',
    });
  });

  it('reports a range that has a start but no end sura', () => {
    expect(firstIncompleteRow([{ sura: 'الناس', range: true }])).toEqual({
      index: 0,
      reason: 'سورة النهاية مش متحددة',
    });
  });

  it('returns the FIRST offender, not the last', () => {
    const bad = firstIncompleteRow([
      { sura: '', draft: 'أ' },
      { sura: '', draft: 'ب' },
    ]);
    expect(bad?.index).toBe(0);
  });

  it('passes a fully complete set', () => {
    expect(
      firstIncompleteRow([
        { sura: 'الناس', from: '1', to: '6' },
        { sura: 'الفلق', toSura: 'المسد', range: true },
      ]),
    ).toBeNull();
  });
});

describe('assignmentPairSignature', () => {
  it('ignores drafts and other UI-only fields', () => {
    expect(assignmentPairSignature([{ sura: 'الناس', draft: 'نا' }], [])).toBe(
      assignmentPairSignature([{ sura: 'الناس' }], []),
    );
  });

  it('drops incomplete rows, so half-typing changes nothing on its own', () => {
    expect(assignmentPairSignature([{ sura: 'الناس' }, { sura: '', draft: 'بق' }], [])).toBe(
      assignmentPairSignature([{ sura: 'الناس' }], []),
    );
  });

  it('changes when a stored end ayah is really corrected', () => {
    expect(assignmentPairSignature([{ sura: 'البقرة', from: '1', to: '10' }], [])).not.toBe(
      assignmentPairSignature([{ sura: 'البقرة', from: '1', to: '5' }], []),
    );
  });

  it('keeps the two sides apart', () => {
    expect(assignmentPairSignature([{ sura: 'الناس' }], [])).not.toBe(
      assignmentPairSignature([], [{ sura: 'الناس' }]),
    );
  });
});
