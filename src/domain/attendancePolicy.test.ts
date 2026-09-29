import { describe, it, expect } from 'vitest';
import { normalizeSeasons, validateSeasons } from './seasons';
import { PER_DAY, policyFromSeasons, saturdayOf, tallyAttendance } from './attendancePolicy';

// 2026-09-26 is a Saturday.
describe('saturdayOf', () => {
  it('maps every day to the Saturday that opens its week', () => {
    expect(saturdayOf('2026-09-26')).toBe('2026-09-26'); // Sat
    expect(saturdayOf('2026-09-27')).toBe('2026-09-26'); // Sun
    expect(saturdayOf('2026-10-02')).toBe('2026-09-26'); // Fri
    expect(saturdayOf('2026-10-03')).toBe('2026-10-03'); // next Sat
    expect(saturdayOf('2027-01-01')).toBe('2026-12-26'); // across a year
  });
});

const STUDY = [
  { id: 'sum', name: 'صيف 2026', from: '2026-06-01', daysPerWeek: 3 },
  { id: 'stu', name: 'دراسة 2027', from: '2026-09-26', daysPerWeek: 1 },
];
const study = policyFromSeasons(STUDY);

// Three study weeks, the teacher in on Sat, Mon and Wed each week.
const W1 = ['2026-09-26', '2026-09-28', '2026-09-30'];
const W2 = ['2026-10-03', '2026-10-05', '2026-10-07'];
const W3 = ['2026-10-10', '2026-10-12', '2026-10-14'];
const HALAQA = [...W1, ...W2, ...W3];
const AFTER = '2026-10-20';

describe('tallyAttendance — one day a week', () => {
  it('a boy who comes on his one day every week is at 100%, not 33%', () => {
    const t = tallyAttendance(
      new Set(['2026-09-28', '2026-10-05', '2026-10-12']),
      HALAQA,
      study,
      AFTER,
    );
    expect(t).toMatchObject({ attended: 3, required: 3, credited: 3, extra: 0, pct: 100 });
    expect(t.unit).toBe('week');
  });

  it('any day of the week counts', () => {
    const t = tallyAttendance(
      new Set(['2026-09-26', '2026-10-07', '2026-10-10']),
      HALAQA,
      study,
      AFTER,
    );
    expect(t.pct).toBe(100);
  });

  it('extra days show as extra but never lift the percentage past 100', () => {
    const t = tallyAttendance(
      new Set(['2026-09-26', '2026-09-28', '2026-10-03', '2026-10-05', '2026-10-10']),
      HALAQA,
      study,
      AFTER,
    );
    expect(t).toMatchObject({ attended: 5, required: 3, credited: 3, extra: 2, pct: 100 });
  });

  it('an extra day does not make up for a missed week', () => {
    const t = tallyAttendance(
      new Set(['2026-09-26', '2026-09-28', '2026-10-10']),
      HALAQA,
      study,
      AFTER,
    );
    expect(t).toMatchObject({ attended: 3, required: 3, credited: 2, extra: 1, pct: 67 });
  });

  it('the week in progress can only help: his day may still be ahead', () => {
    // Monday of week 3; the boy comes on Wednesdays.
    const soFar = ['2026-10-10', '2026-10-12'];
    const t = tallyAttendance(
      new Set(['2026-09-30', '2026-10-07']),
      [...W1, ...W2, ...soFar],
      study,
      '2026-10-12',
    );
    expect(t).toMatchObject({ required: 2, credited: 2, pct: 100, missedStreak: 0 });
    // Once he has come this week, it counts for him.
    const came = tallyAttendance(
      new Set(['2026-09-30', '2026-10-10']),
      [...W1, ...W2, ...soFar],
      study,
      '2026-10-12',
    );
    // Week 2 was missed; week 3 counts because he has already come.
    expect(came).toMatchObject({ required: 3, credited: 2 });
  });

  it('counts missed WEEKS for follow-up, newest first, skipping the week in progress', () => {
    const t = tallyAttendance(
      new Set(['2026-09-28']),
      [...HALAQA, '2026-10-17'],
      study,
      '2026-10-18',
    );
    expect(t.missedStreak).toBe(2);
  });

  it('a week the halaqa never met asks nothing of anyone', () => {
    const t = tallyAttendance(new Set(['2026-09-28', '2026-10-12']), [...W1, ...W3], study, AFTER);
    expect(t).toMatchObject({ required: 2, pct: 100 });
  });
});

describe('tallyAttendance — three days a week (summer)', () => {
  const SUMMER = ['2026-07-04', '2026-07-06', '2026-07-08', '2026-07-11', '2026-07-13'];
  it('asks for up to three days a week, fewer when the halaqa met less', () => {
    const t = tallyAttendance(
      new Set(['2026-07-04', '2026-07-06', '2026-07-11']),
      SUMMER,
      study,
      AFTER,
    );
    // Week 1 needs 3 (met 3 days), week 2 needs 2 (met only 2 days).
    expect(t).toMatchObject({ required: 5, credited: 3, pct: 60 });
  });
});

describe('tallyAttendance — per day (no weekly quota)', () => {
  it('is exactly the old rule: every halaqa day is required', () => {
    const t = tallyAttendance(new Set(['2026-09-28']), W1, PER_DAY, AFTER);
    expect(t).toMatchObject({
      attended: 1,
      required: 3,
      credited: 1,
      extra: 0,
      pct: 33,
      unit: 'day',
    });
  });
  it('a season with no daysPerWeek keeps the per-day rule', () => {
    const p = policyFromSeasons([{ id: 'x', name: 'x', from: '2026-01-01' }]);
    expect(tallyAttendance(new Set(['2026-09-28']), W1, p, AFTER).pct).toBe(33);
  });
  it('per-day missed streak counts days, as before', () => {
    expect(tallyAttendance(new Set(['2026-09-26']), W1, PER_DAY, AFTER).missedStreak).toBe(2);
  });
  it('nothing required → 0%, never NaN', () => {
    expect(tallyAttendance(new Set(), [], study, AFTER).pct).toBe(0);
  });
});

describe('seasons carry daysPerWeek', () => {
  it('normalizeSeasons keeps a valid quota and drops a bad one', () => {
    const out = normalizeSeasons([
      { id: 'a', name: 'a', from: '2026-06-01', daysPerWeek: 3 },
      { id: 'b', name: 'b', from: '2026-09-26', daysPerWeek: 9 },
    ]);
    expect(out[0].daysPerWeek).toBe(3);
    expect('daysPerWeek' in out[1]).toBe(false);
  });
  it('validateSeasons rejects a quota outside 1–7', () => {
    expect(validateSeasons([{ id: 'a', name: 'a', from: '2026-06-01', daysPerWeek: 0 }])).toMatch(
      /أيام/,
    );
  });
});
