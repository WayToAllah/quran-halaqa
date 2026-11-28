import { describe, it, expect } from 'vitest';
import { itemAyat, suraLabel, resolvedAyahRange } from './suras';
import { assignmentAyahSpan } from './pages';
import { mushafWardParam } from './mushafLink';

// «من» with «إلى» left blank means "to the end of the sura" — everywhere.
// It used to count as the WHOLE sura in some places (ayat, pages) and as a
// single ayah in the mushaf viewer.
describe('«من» without «إلى» runs to the end of the sura', () => {
  const row = { sura: 'البقرة', from: '51' };

  it('resolves to from..last ayah', () => {
    expect(resolvedAyahRange(row)).toEqual({ from: 51, to: 286 });
  });

  it('counts the ayat from «من» to the end', () => {
    expect(itemAyat(row)).toBe(236);
  });

  it('spans from «من» to the end for pages', () => {
    expect(assignmentAyahSpan(row)).toEqual(
      assignmentAyahSpan({ sura: 'البقرة', from: '51', to: '286' }),
    );
  });

  it('opens the mushaf on from..end', () => {
    expect(mushafWardParam([row])).toBe(`${encodeURIComponent('البقرة')}:51:286`);
  });

  it('labels it with the real end', () => {
    expect(suraLabel(row)).toBe('البقرة (51–286)');
  });

  it('an «إلى» on its own starts from ayah 1', () => {
    const only = { sura: 'البقرة', to: '30' };
    expect(itemAyat(only)).toBe(30);
    expect(resolvedAyahRange(only)).toEqual({ from: 1, to: 30 });
  });

  it('a bare sura is still the whole sura', () => {
    expect(itemAyat({ sura: 'البقرة' })).toBe(286);
    expect(resolvedAyahRange({ sura: 'البقرة' })).toEqual({ from: 1, to: 286 });
  });

  it('a full range is unchanged', () => {
    expect(itemAyat({ sura: 'البقرة', from: '1', to: '10' })).toBe(10);
    expect(suraLabel({ sura: 'البقرة', from: '5', to: '5' })).toBe('البقرة (آية 5)');
  });
});
