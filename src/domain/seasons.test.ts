import { describe, it, expect } from 'vitest';
import {
  normalizeSeasons,
  sortSeasons,
  seasonRange,
  currentSeasonId,
  inPeriod,
  toRange,
  intersectRanges,
  rangeKey,
  filterByPeriod,
  suggestInitialSeasons,
  validateSeasons,
  type Season,
} from './seasons';

const S: Season[] = [
  { id: 'b', name: 'دراسة 2027', from: '2026-09-27' },
  { id: 'a', name: 'صيف 2026', from: '2026-06-01' },
];

describe('normalizeSeasons', () => {
  it('drops malformed entries and sorts by start date', () => {
    const raw = [
      { id: 'b', name: 'دراسة 2027', from: '2026-09-27' },
      { id: 'x', name: '', from: '2026-01-01' },
      { id: 'y', name: 'bad', from: '27/09/2026' },
      'junk',
      { id: 'a', name: 'صيف 2026', from: '2026-06-01', extra: 1 },
    ];
    expect(normalizeSeasons(raw)).toEqual([
      { id: 'a', name: 'صيف 2026', from: '2026-06-01' },
      { id: 'b', name: 'دراسة 2027', from: '2026-09-27' },
    ]);
  });
  it('returns [] for a missing field', () => {
    expect(normalizeSeasons(undefined)).toEqual([]);
  });
});

describe('seasonRange', () => {
  it('ends where the next season starts (exclusive); the last is open-ended', () => {
    expect(seasonRange(S, 'b')).toEqual({ from: '2026-09-27' });
  });
  it('the first season also swallows anything recorded before it starts', () => {
    // Otherwise records older than the first season would belong to no season
    // and silently vanish from every season view.
    expect(seasonRange(S, 'a')).toEqual({ to: '2026-09-27' });
  });
  it('a middle season is bounded on both sides', () => {
    const three = [...S, { id: 'c', name: 'صيف 2027', from: '2027-06-01' }];
    expect(seasonRange(three, 'b')).toEqual({ from: '2026-09-27', to: '2027-06-01' });
  });
  it("'all' and unknown ids are the whole history", () => {
    expect(seasonRange(S, 'all')).toEqual({});
    expect(seasonRange(S, 'nope')).toEqual({});
  });
});

describe('currentSeasonId', () => {
  it('is the latest season already started', () => {
    expect(currentSeasonId(S, '2026-09-28')).toBe('b');
    expect(currentSeasonId(S, '2026-09-27')).toBe('b');
    expect(currentSeasonId(S, '2026-09-26')).toBe('a');
  });
  it("falls back to 'all' with no seasons, or before the first one", () => {
    expect(currentSeasonId([], '2026-09-28')).toBe('all');
    expect(currentSeasonId(S, '2026-01-01')).toBe('a');
  });
});

describe('ranges', () => {
  it('toRange understands all, a month and a range', () => {
    expect(toRange('all')).toEqual({});
    expect(toRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-10-01' });
    expect(toRange('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
    expect(toRange({ from: '2026-09-27' })).toEqual({ from: '2026-09-27' });
  });
  it('inPeriod: from inclusive, to exclusive', () => {
    const r = { from: '2026-06-01', to: '2026-09-27' };
    expect(inPeriod('2026-06-01', r)).toBe(true);
    expect(inPeriod('2026-09-26', r)).toBe(true);
    expect(inPeriod('2026-09-27', r)).toBe(false);
    expect(inPeriod('2026-05-31', r)).toBe(false);
    expect(inPeriod(undefined, r)).toBe(false);
    expect(inPeriod('2026-09-27', 'all')).toBe(true);
    expect(inPeriod('2026-09-27', '2026-09')).toBe(true);
  });
  it('intersects a season with a month that straddles its start', () => {
    expect(intersectRanges({ from: '2026-09-27' }, toRange('2026-09'))).toEqual({
      from: '2026-09-27',
      to: '2026-10-01',
    });
  });
  it('rangeKey is stable for memo deps', () => {
    expect(rangeKey({})).toBe('..');
    expect(rangeKey({ from: '2026-09-27' })).toBe('2026-09-27..');
  });
  it('filterByPeriod keeps records inside the window', () => {
    const recs = [{ date: '2026-09-26' }, { date: '2026-09-27' }, { date: undefined }];
    expect(filterByPeriod(recs, { from: '2026-09-27' })).toEqual([{ date: '2026-09-27' }]);
    expect(filterByPeriod(recs, {})).toBe(recs);
  });
});

describe('suggestInitialSeasons', () => {
  it('names the existing history and opens a new season today', () => {
    const out = suggestInitialSeasons(['2026-07-01', '2026-06-05', '2026-09-20'], '2026-09-27');
    expect(out.map(({ name, from }) => ({ name, from }))).toEqual([
      { name: 'صيف 2026', from: '2026-06-05' },
      { name: 'موسم جديد', from: '2026-09-27' },
    ]);
    expect(new Set(out.map((s) => s.id)).size).toBe(2);
  });
  it('with no history, suggests the new season alone', () => {
    expect(suggestInitialSeasons([], '2026-09-27').map((s) => s.from)).toEqual(['2026-09-27']);
  });
});

describe('validateSeasons', () => {
  it('accepts a clean list', () => {
    expect(validateSeasons(S)).toBeNull();
  });
  it('rejects empty names, bad dates and two seasons starting the same day', () => {
    expect(validateSeasons([{ id: 'a', name: ' ', from: '2026-06-01' }])).toMatch(/اسم/);
    expect(validateSeasons([{ id: 'a', name: 'x', from: '' }])).toMatch(/تاريخ/);
    expect(
      validateSeasons([
        { id: 'a', name: 'x', from: '2026-06-01' },
        { id: 'b', name: 'y', from: '2026-06-01' },
      ]),
    ).toMatch(/نفس اليوم/);
  });
});

describe('sortSeasons', () => {
  it('does not mutate its input', () => {
    const copy = [...S];
    sortSeasons(S);
    expect(S).toEqual(copy);
  });
});
