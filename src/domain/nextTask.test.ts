import { describe, it, expect } from 'vitest';
import { computeNextLoh, computeNextMadi } from './nextTask';

describe('computeNextLoh (loh order: الفاتحة → 114 → 2)', () => {
  it('continues the SAME sura from the next ayah when the last was partial', () => {
    // Took البقرة 1–10 → suggest البقرة from 11, "to" left blank.
    expect(computeNextLoh([{ sura: 'البقرة', from: '1', to: '10' }])).toEqual({
      sura: 'البقرة',
      from: '11',
      to: '',
    });
  });

  it('moves to the next sura in loh order when the last sura was completed', () => {
    // الناس is 114 (first after الفاتحة in loh order); completing it → الفلق (113).
    expect(computeNextLoh([{ sura: 'الناس', from: '1', to: '6' }])).toEqual({
      sura: 'الفلق',
      from: '1',
      to: '',
    });
  });

  it('after الفاتحة (index 0 in loh order) suggests الناس', () => {
    expect(computeNextLoh([{ sura: 'الفاتحة', from: '1', to: '7' }])).toEqual({
      sura: 'الناس',
      from: '1',
      to: '',
    });
  });

  it('leaves "to" blank on every suggestion', () => {
    expect(computeNextLoh([{ sura: 'الفلق', from: '1', to: '5' }])?.to).toBe('');
  });

  it('returns null when there is no valid previous item', () => {
    expect(computeNextLoh([])).toBeNull();
    expect(computeNextLoh([{ sura: '' }])).toBeNull();
    expect(computeNextLoh(undefined)).toBeNull();
  });

  it('uses the furthest-along item when several are present', () => {
    // الناس (114) is further along loh order than الفاتحة; frontier = الناس done → الفلق.
    expect(
      computeNextLoh([
        { sura: 'الفاتحة', from: '1', to: '7' },
        { sura: 'الناس', from: '1', to: '6' },
      ]),
    ).toEqual({ sura: 'الفلق', from: '1', to: '' });
  });
});

describe('computeNextMadi (ascending mushaf order)', () => {
  it('continues the SAME sura from the next ayah when partial', () => {
    expect(computeNextMadi([{ sura: 'البقرة', from: '1', to: '10' }])).toEqual({
      sura: 'البقرة',
      from: '11',
      to: '',
    });
  });

  it('moves to the next sura ascending when completed', () => {
    // الفاتحة (7 ayat) completed → البقرة from 1.
    expect(computeNextMadi([{ sura: 'الفاتحة', from: '1', to: '7' }])).toEqual({
      sura: 'البقرة',
      from: '1',
      to: '',
    });
  });

  it('continues one sura past a whole-sura range, in the range direction', () => {
    // Ascending range البقرة→النساء (2→4) → المائدة (5).
    expect(computeNextMadi([{ sura: 'البقرة', toSura: 'النساء', range: true }])).toEqual({
      sura: 'المائدة',
      from: '1',
      to: '',
    });
  });

  it('returns null with no valid previous item', () => {
    expect(computeNextMadi([])).toBeNull();
  });

  it('leaves "to" blank', () => {
    expect(computeNextMadi([{ sura: 'الفاتحة', from: '1', to: '7' }])?.to).toBe('');
  });
});
