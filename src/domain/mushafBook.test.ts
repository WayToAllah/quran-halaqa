import { describe, it, expect } from 'vitest';
import { buildMushafBook, decodeShortMarks, encodeShortMarks, mushafBookLink } from './mushafBook';
import type { SessionRecord, Student } from '../types';

const student = { id: 's1', name: 'أحمد' } as unknown as Student;

function rec(
  id: string,
  date: string,
  loh?: { rk?: string; ok?: string },
  madi?: { rk?: string; ok?: string },
): SessionRecord {
  const ev = (m?: { rk?: string; ok?: string }) =>
    m
      ? { score: 90, mushaf: { rk: m.rk ?? '', rx: 0, total: 0, ...(m.ok ? { ok: m.ok } : {}) } }
      : null;
  return {
    id,
    date,
    studentId: 's1',
    student: 'أحمد',
    loh: ev(loh),
    madi: ev(madi),
  } as unknown as SessionRecord;
}

describe('short marks format', () => {
  it('round-trips and groups words of one ayah', () => {
    const ids = ['3:2:4', '3:2:3', '78:1:2'];
    expect(encodeShortMarks(ids)).toBe('3.2.3.4_78.1.2');
    expect(decodeShortMarks('3.2.3.4_78.1.2')).toEqual(['3:2:3', '3:2:4', '78:1:2']);
  });
  it('drops malformed groups', () => {
    expect(decodeShortMarks('3.2_x.1.1_5.5.5')).toEqual(['5:5:5']);
    expect(decodeShortMarks('')).toEqual([]);
  });
});

describe('buildMushafBook', () => {
  it('accumulates red words across sessions and ayahs', () => {
    const book = buildMushafBook(student, [
      rec('a', '2026-11-01', { rk: '78.1.2' }),
      rec('b', '2026-11-03', { rk: '78.2.1' }, { rk: '2.5.1' }),
    ]);
    expect(book).toEqual({ red: '2.5.1_78.1.2_78.2.1', green: '' });
  });

  it('a later correction turns a red word green, a later mistake turns it red again', () => {
    const book = buildMushafBook(student, [
      rec('a', '2026-11-01', { rk: '78.1.2.3' }),
      rec('b', '2026-11-03', { ok: '78.1.2' }),
      rec('c', '2026-11-05', { rk: '78.1.3' }),
    ]);
    expect(book).toEqual({ red: '78.1.3', green: '78.1.2' });
  });

  it('replays by date, not by array order', () => {
    const book = buildMushafBook(student, [
      rec('b', '2026-11-03', { ok: '78.1.2' }),
      rec('a', '2026-11-01', { rk: '78.1.2' }),
    ]);
    expect(book).toEqual({ red: '', green: '78.1.2' });
  });

  it('when editing, only sessions before the edited one count', () => {
    const recs = [
      rec('a', '2026-11-01', { rk: '78.1.2' }),
      rec('b', '2026-11-03', { rk: '78.1.3' }),
      rec('c', '2026-11-05', { rk: '78.1.4' }),
    ];
    expect(buildMushafBook(student, recs, 'b')).toEqual({ red: '78.1.2', green: '' });
  });

  it('ignores other students and records without marks', () => {
    const other = { ...rec('x', '2026-11-01', { rk: '1.1.1' }), studentId: 's2', student: 'علي' };
    expect(buildMushafBook(student, [other as SessionRecord, rec('y', '2026-11-02')])).toEqual({
      red: '',
      green: '',
    });
  });
});

describe('mushafBookLink', () => {
  it('builds a read-only book link next to the app', () => {
    expect(
      mushafBookLink(
        { red: '78.1.2', green: '78.1.3' },
        'أحمد',
        'https://x.io/q/v3/child.html?t=1',
      ),
    ).toBe('https://x.io/q/mushaf/?b=1&e=78.1.2&g=78.1.3&n=%D8%A3%D8%AD%D9%85%D8%AF');
  });
  it('with the parent token, a short permanent link the viewer resolves itself', () => {
    expect(
      mushafBookLink(
        { red: '78.1.2', green: '' },
        'أحمد',
        'https://x.io/q/v3/child.html',
        'abcDEF_123-x',
      ),
    ).toBe('https://x.io/q/mushaf/?b=1&t=abcDEF_123-x');
  });
  it('is null with nothing marked or a malformed value', () => {
    expect(mushafBookLink({ red: '', green: '' }, 'a', 'https://x.io/q/v3/')).toBeNull();
    expect(
      mushafBookLink({ red: 'javascript:1', green: '' }, 'a', 'https://x.io/q/v3/'),
    ).toBeNull();
    expect(mushafBookLink(undefined, 'a', 'https://x.io/q/v3/')).toBeNull();
  });
});
