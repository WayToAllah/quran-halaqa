import { describe, it, expect } from 'vitest';
import { buildWhatsAppMessage, normalizeWhatsAppPhone } from './whatsapp';
import type { SessionRecord } from '../types';

describe('buildWhatsAppMessage', () => {
  const prevSession: SessionRecord = {
    id: 'r_prev',
    studentId: 's_1',
    student: 'زيد احمد',
    date: '2026-07-01',
    newLoh: [{ sura: 'البقرة', from: '1', to: '10' }],
  };

  it('includes the student first name in the header', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
    };
    const msg = buildWhatsAppMessage(rec, null);
    expect(msg).toContain('زيد');
  });

  it('shows a genuine zero score as إعادة, not blank (scoreName(0) regression)', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      loh: { score: 0 },
    };
    const msg = buildWhatsAppMessage(rec, prevSession);
    expect(msg).toContain('إعادة');
    expect(msg).toContain('0/100');
  });

  it("includes what was recited today (previous session's assignment) with today's score", () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      loh: { score: 90 },
    };
    const msg = buildWhatsAppMessage(rec, prevSession);
    expect(msg).toContain('البقرة');
    expect(msg).toContain('90/100');
    expect(msg).toContain('ممتاز');
  });

  it('includes the new assignment for the next session', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      newLoh: [{ sura: 'آل عمران', from: '1', to: '5' }],
    };
    const msg = buildWhatsAppMessage(rec, null);
    expect(msg).toContain('المهمة الجديدة');
    expect(msg).toContain('آل عمران');
  });

  it('includes tajweed with its own score when present', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      tajweed: { sura: 'النساء', from: '1', to: '3', score: 85, stars: 4 },
    };
    const msg = buildWhatsAppMessage(rec, null);
    expect(msg).toContain('التجويد');
    expect(msg).toContain('النساء');
    expect(msg).toContain('85/100');
  });

  it('falls back to raw star count for tajweed when no score was given', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      tajweed: { sura: 'النساء', from: '1', to: '3', stars: 3 },
    };
    const msg = buildWhatsAppMessage(rec, null);
    expect(msg).toContain('⭐⭐⭐');
    // Filled stars only — no hollow padding, and nothing left over from the
    // old ★/☆ pair (⭐ has no hollow counterpart to pad with).
    expect(msg).not.toContain('☆');
    expect(msg).not.toContain('★');
  });

  it.each([
    [90, 5],
    [85, 4],
    [75, 3],
    [65, 2],
  ])('draws %i as %i filled stars, matching its grade band', (score, expected) => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      loh: { score, stars: 0 },
    };
    const msg = buildWhatsAppMessage(rec, null);
    expect(msg).toContain('⭐'.repeat(expected));
    expect(msg).not.toContain('⭐'.repeat(expected + 1));
  });

  it('leaves no stray gap on the line when a score earns no stars', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      loh: { score: 55, stars: 0 },
    };
    const line = buildWhatsAppMessage(rec, null)
      .split('\n')
      .find((l) => l.includes('55/100'));
    expect(line).toBe('• اللوح: 55/100 إعادة');
  });

  it('draws no stars at all for an إعادة score', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      loh: { score: 55, stars: 0 },
    };
    const msg = buildWhatsAppMessage(rec, null);
    expect(msg).toContain('إعادة');
    expect(msg).not.toContain('⭐');
  });

  it('includes the note when present', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
      note: 'ملحوظة تجريبية',
    };
    const msg = buildWhatsAppMessage(rec, null);
    expect(msg).toContain('ملحوظة تجريبية');
  });

  it('includes the child-portal link only when a parentToken is given', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
    };
    const withToken = buildWhatsAppMessage(rec, null, 'TOKEN123');
    const withoutToken = buildWhatsAppMessage(rec, null);
    expect(withToken).toContain('child.html?t=TOKEN123');
    expect(withoutToken).not.toContain('child.html');
  });

  it('never crashes on a bare-minimum record with nothing filled in', () => {
    const rec: SessionRecord = {
      id: 'r1',
      studentId: 's_1',
      student: 'زيد احمد',
      date: '2026-07-03',
    };
    expect(() => buildWhatsAppMessage(rec, null)).not.toThrow();
  });
});

describe('normalizeWhatsAppPhone', () => {
  it('converts a leading 0 to Egypt country code 2', () => {
    expect(normalizeWhatsAppPhone('01012345678')).toBe('201012345678');
  });
  it('strips non-digit characters', () => {
    expect(normalizeWhatsAppPhone('010-1234 5678')).toBe('201012345678');
  });
  it('returns empty string for missing/empty input', () => {
    expect(normalizeWhatsAppPhone(undefined)).toBe('');
    expect(normalizeWhatsAppPhone('')).toBe('');
  });
});

describe('buildWhatsAppMessage — tajweed without ayah numbers', () => {
  it('omits the parentheses instead of sending the parent a bare "(–)"', () => {
    const msg = buildWhatsAppMessage(
      {
        id: 'r1',
        studentId: 's_1',
        student: 'زيد احمد',
        date: '2026-07-20',
        tajweed: { sura: 'الناس', from: '', to: '', stars: 4 },
      },
      null,
      undefined,
    );
    expect(msg).toContain('• الناس');
    expect(msg).not.toContain('(–)');
    expect(msg).not.toContain('(');
  });
});

describe('normalizeWhatsAppPhone', () => {
  it('accepts a number typed in Arabic-Indic digits', () => {
    // Stripping non-[0-9] before converting used to erase the whole number,
    // and the send button then silently did nothing.
    expect(normalizeWhatsAppPhone('٠١٠١٢٣٤٥٦٧٨')).toBe('201012345678');
  });

  it('still handles ASCII input and separators', () => {
    expect(normalizeWhatsAppPhone('010 1234 5678')).toBe('201012345678');
    expect(normalizeWhatsAppPhone('')).toBe('');
    expect(normalizeWhatsAppPhone(undefined)).toBe('');
  });
});
