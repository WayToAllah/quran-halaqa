import { describe, it, expect } from 'vitest';
import { mushafWardParam, mushafLink, readMushafCount, isMushafReady } from './mushafLink';

describe('mushafWardParam', () => {
  it('encodes a single assignment as sura:from:to', () => {
    expect(mushafWardParam([{ sura: 'النبأ', from: '1', to: '40' }])).toBe(
      `${encodeURIComponent('النبأ')}:1:40`,
    );
  });

  it('keeps several assignments in the order they were entered', () => {
    const out = mushafWardParam([
      { sura: 'الملك', from: '1', to: '10' },
      { sura: 'الفاتحة', from: '1', to: '7' },
    ]);
    expect(out.split(',')).toEqual([
      `${encodeURIComponent('الملك')}:1:10`,
      `${encodeURIComponent('الفاتحة')}:1:7`,
    ]);
  });

  it('sends a whole-sura range as the sura alone', () => {
    expect(mushafWardParam([{ sura: 'النبأ', toSura: 'النازعات', range: true }])).toBe(
      encodeURIComponent('النبأ'),
    );
  });

  it('sends a sura with no ayah numbers as the sura alone', () => {
    expect(mushafWardParam([{ sura: 'الناس' }])).toBe(encodeURIComponent('الناس'));
  });

  it('drops entries with no sura', () => {
    expect(mushafWardParam([{ sura: '' }, { sura: 'الملك', from: '1', to: '5' }])).toBe(
      `${encodeURIComponent('الملك')}:1:5`,
    );
  });
});

describe('mushafLink', () => {
  it('returns null when there is nothing to show', () => {
    expect(mushafLink([])).toBeNull();
    expect(mushafLink([{ sura: '' }])).toBeNull();
  });

  it('builds a link with the student, ward and token', () => {
    const url = mushafLink([{ sura: 'النبأ', from: '1', to: '40' }], {
      name: 'زيد',
      ward: 'اللوح',
      token: 'r_9',
    });
    expect(url).toContain('../mushaf/?a=');
    expect(url).toContain(`n=${encodeURIComponent('زيد')}`);
    expect(url).toContain(`w=${encodeURIComponent('اللوح')}`);
    expect(url).toContain('id=r_9');
  });

  it('leaves out the optional parts when they are empty', () => {
    const url = mushafLink([{ sura: 'الناس' }]);
    expect(url).toBe(`../mushaf/?a=${encodeURIComponent('الناس')}`);
  });
});

describe('readMushafCount', () => {
  const ok = { type: 'mushaf-count', id: 'r_9', count: 4 };

  it('reads the count of a matching message', () => {
    expect(readMushafCount(ok, 'r_9')).toBe(4);
  });

  it('ignores a message from another open of the viewer', () => {
    expect(readMushafCount(ok, 'r_10')).toBeNull();
  });

  it('ignores anything that is not the viewer count message', () => {
    expect(readMushafCount({ type: 'something-else', id: 'r_9', count: 4 }, 'r_9')).toBeNull();
    expect(readMushafCount('hello', 'r_9')).toBeNull();
    expect(readMushafCount(null, 'r_9')).toBeNull();
  });

  it('rejects counts that are not a usable number', () => {
    expect(readMushafCount({ ...ok, count: -1 }, 'r_9')).toBeNull();
    expect(readMushafCount({ ...ok, count: 'كتير' }, 'r_9')).toBeNull();
  });

  it('floors a fractional count', () => {
    expect(readMushafCount({ ...ok, count: 3.7 }, 'r_9')).toBe(3);
  });
});

describe('isMushafReady', () => {
  it('accepts the viewer saying it is showing the ward', () => {
    expect(isMushafReady({ type: 'mushaf-ready', id: 'r_9' }, 'r_9')).toBe(true);
  });

  it('ignores a ready from another open of the viewer', () => {
    expect(isMushafReady({ type: 'mushaf-ready', id: 'r_10' }, 'r_9')).toBe(false);
  });

  it('ignores anything that is not the ready message', () => {
    expect(isMushafReady({ type: 'mushaf-count', id: 'r_9', count: 1 }, 'r_9')).toBe(false);
    expect(isMushafReady('hello', 'r_9')).toBe(false);
    expect(isMushafReady(null, 'r_9')).toBe(false);
  });
});
