import { describe, it, expect } from 'vitest';
import { resolvePrevRow, prevRowProblem } from './record';

const orig = { sura: 'البقرة', from: '1', to: '10' };

describe('resolvePrevRow', () => {
  it('keeps a real correction of the start', () => {
    expect(resolvePrevRow(orig, { sura: 'البقرة', from: '5', to: '10' })).toEqual({
      sura: 'البقرة',
      from: '5',
      to: '10',
    });
  });
  it('a blank box falls back to the stored value → no phantom edit', () => {
    expect(resolvePrevRow(orig, { sura: 'البقرة', to: '10' })).toEqual(orig);
    expect(resolvePrevRow(orig, { sura: 'البقرة', from: '1' })).toEqual(orig);
  });
  it('a whole-sura row with a start runs to the last ayah', () => {
    expect(resolvePrevRow({ sura: 'الفاتحة' }, { sura: 'الفاتحة', from: '3' })).toEqual({
      sura: 'الفاتحة',
      from: '3',
      to: '7',
    });
  });
  it('covering the whole sura again gives back the stored whole-sura row', () => {
    expect(resolvePrevRow({ sura: 'الفاتحة' }, { sura: 'الفاتحة', from: '1', to: '7' })).toEqual({
      sura: 'الفاتحة',
    });
  });
  it('an inverted range is kept as typed so the save guard can name it', () => {
    expect(resolvePrevRow(orig, { sura: 'البقرة', from: '15', to: '10' })).toEqual({
      sura: 'البقرة',
      from: '15',
      to: '10',
    });
  });
});

describe('prevRowProblem', () => {
  it('accepts a normal range and whole-sura ranges', () => {
    expect(prevRowProblem(orig)).toBeNull();
    expect(prevRowProblem({ sura: 'الناس', toSura: 'الفلق', range: true })).toBeNull();
  });
  it('rejects start after end', () => {
    expect(prevRowProblem({ sura: 'البقرة', from: '15', to: '10' })).toBe(
      'آية البداية بعد آية النهاية',
    );
  });
  it('rejects ayat beyond the sura', () => {
    expect(prevRowProblem({ sura: 'آل عمران', from: '300', to: '200' })).toBe('السورة 200 آية بس');
  });
  it('rejects zero', () => {
    expect(prevRowProblem({ sura: 'البقرة', from: '0', to: '5' })).toBe(
      'آية البداية لازم تكون 1 أو أكتر',
    );
  });
});

describe('resolvePrevRow — changing the sura itself', () => {
  it('keeps a new sura even when the ayah numbers are unchanged', () => {
    expect(resolvePrevRow(orig, { sura: 'النبأ', from: '1', to: '10' })).toEqual({
      sura: 'النبأ',
      from: '1',
      to: '10',
    });
  });

  it('does not carry the old sura’s ayah numbers onto the new one', () => {
    expect(resolvePrevRow(orig, { sura: 'النبأ' })).toEqual({
      sura: 'النبأ',
      from: '1',
      to: '40',
    });
  });
});
