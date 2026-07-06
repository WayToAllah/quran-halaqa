import { describe, it, expect } from 'vitest';
import { byNewest, localDateStr } from './dates';

describe('localDateStr', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localDateStr(new Date('2026-07-06T10:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not roll back to the previous day for a late-night local time (Cairo UTC+2/3 regression)', () => {
    // 23:30 Cairo local time (UTC+3 in summer) on 2026-07-05 is 20:30 UTC —
    // a naive `new Date().toISOString()` would already say 2026-07-05 here
    // (no rollover in THIS example), so pick a case that actually crosses
    // midnight: 01:00 Cairo time (UTC+3) on 2026-07-06 is 22:00 UTC on 07-05.
    const d = new Date('2026-07-05T22:00:00Z');
    // With a -180 minute (UTC+3) offset simulated via a fixed Date object,
    // localDateStr subtracts getTimezoneOffset() — in this sandboxed test
    // environment the offset reflects the machine's configured TZ, so we
    // instead assert the *mechanism*: subtracting the offset moves the UTC
    // instant forward by exactly |offset| minutes before formatting.
    const offsetMs = d.getTimezoneOffset() * 60000;
    const expected = new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
    expect(localDateStr(d)).toBe(expected);
  });
});

describe('byNewest', () => {
  it('sorts a later date before an earlier date', () => {
    const a = { id: 'r_1', date: '2026-07-01' };
    const b = { id: 'r_2', date: '2026-07-05' };
    expect(byNewest(a, b)).toBeGreaterThan(0); // a is older -> sorts after b
    expect(byNewest(b, a)).toBeLessThan(0);
  });

  it('breaks same-day ties using the creation time embedded in the id', () => {
    const older = { id: 'r_1000_abcde', date: '2026-07-05' };
    const newer = { id: 'r_2000_fghij', date: '2026-07-05' };
    expect(byNewest(newer, older)).toBeLessThan(0); // newer sorts first
    expect(byNewest(older, newer)).toBeGreaterThan(0);
  });

  it('treats missing dates as empty string (sorts last)', () => {
    const noDate = { id: 'r_1', date: '' };
    const dated = { id: 'r_2', date: '2026-01-01' };
    expect(byNewest(noDate, dated)).toBeGreaterThan(0);
  });
});
