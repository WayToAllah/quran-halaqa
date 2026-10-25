import { describe, it, expect } from 'vitest';
import {
  mushafWardParam,
  mushafLink,
  readMushafCount,
  readMushafMarksLink,
  readMushafState,
  isMushafReady,
} from './mushafLink';

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

describe('mushafLink phone', () => {
  it('passes the parent number so the viewer opens that chat', () => {
    const url = mushafLink([{ sura: 'الناس' }], { token: 't', phone: '201001234567' })!;
    expect(url).toContain('ph=201001234567');
  });
  it('leaves ph out when there is no number', () => {
    expect(mushafLink([{ sura: 'الناس' }])).not.toContain('ph=');
  });
});

describe('readMushafMarksLink', () => {
  const origin = 'https://waytoallah.github.io';
  const link = origin + '/quran-halaqa/mushaf/?e=3.2.3.4_3.3.3&p=50&x=1';
  const msg = { type: 'mushaf-count', id: 'r_9', count: 3, link };
  it('returns the marks link from the viewer', () => {
    expect(readMushafMarksLink(msg, 'r_9', origin)).toBe(link);
  });
  it('ignores a message for another open', () => {
    expect(readMushafMarksLink(msg, 'r_10', origin)).toBeNull();
  });
  it('is null when nothing was marked', () => {
    expect(readMushafMarksLink({ ...msg, link: '' }, 'r_9', origin)).toBeNull();
    expect(
      readMushafMarksLink({ type: 'mushaf-count', id: 'r_9', count: 2 }, 'r_9', origin),
    ).toBeNull();
  });
  it('never accepts a link to another site or another page', () => {
    expect(
      readMushafMarksLink({ ...msg, link: 'https://evil.example/mushaf/?e=1.1.1' }, 'r_9', origin),
    ).toBeNull();
    expect(
      readMushafMarksLink({ ...msg, link: origin + '/quran-halaqa/v3/?e=1' }, 'r_9', origin),
    ).toBeNull();
    expect(readMushafMarksLink({ ...msg, link: 'javascript:alert(1)' }, 'r_9', origin)).toBeNull();
  });
});

describe('mushafLink restore', () => {
  it('hands back the marks and the extra taps so the viewer reopens as it was left', () => {
    const url = mushafLink([{ sura: 'الناس' }], {
      token: 't',
      restore: { rk: '114.2.1.3', rx: 2 },
    })!;
    expect(url).toContain('rk=114.2.1.3');
    expect(url).toContain('rx=2');
  });
  it('adds nothing when there is nothing to restore', () => {
    const url = mushafLink([{ sura: 'الناس' }], { token: 't', restore: { rk: '', rx: 0 } })!;
    expect(url).not.toContain('rk=');
    expect(url).not.toContain('rx=');
  });
});

describe('readMushafState', () => {
  const base = { type: 'mushaf-count', id: 'r_9', count: 5, rk: '114.2.1.3', rx: 3 };
  it('reads what the viewer needs back on the next open', () => {
    expect(readMushafState(base, 'r_9')).toEqual({ rk: '114.2.1.3', rx: 3, total: 5 });
  });
  it('is null for another open or a non-count message', () => {
    expect(readMushafState(base, 'r_10')).toBeNull();
    expect(readMushafState({ ...base, type: 'x' }, 'r_9')).toBeNull();
  });
  it('treats a missing or empty state as nothing marked', () => {
    expect(readMushafState({ type: 'mushaf-count', id: 'r_9', count: 0 }, 'r_9')).toEqual({
      rk: '',
      rx: 0,
      total: 0,
    });
  });
  it('drops marks that are not the viewer short-format', () => {
    expect(readMushafState({ ...base, rk: '<script>' }, 'r_9')?.rk).toBe('');
  });
  it('clamps a bad extra to zero', () => {
    expect(readMushafState({ ...base, rx: -4 }, 'r_9')?.rx).toBe(0);
    expect(readMushafState({ ...base, rx: 'x' }, 'r_9')?.rx).toBe(0);
  });
});
