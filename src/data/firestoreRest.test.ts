import { describe, it, expect, vi } from 'vitest';
import {
  decodeFirestoreValue,
  decodeFirestoreDocument,
  fetchPublicStatsRest,
} from './firestoreRest';

describe('decodeFirestoreValue', () => {
  it('decodes scalar types', () => {
    expect(decodeFirestoreValue({ stringValue: 'زيد' })).toBe('زيد');
    expect(decodeFirestoreValue({ integerValue: '92' })).toBe(92);
    expect(decodeFirestoreValue({ doubleValue: 3.5 })).toBe(3.5);
    expect(decodeFirestoreValue({ booleanValue: true })).toBe(true);
    expect(decodeFirestoreValue({ nullValue: null })).toBeNull();
    expect(decodeFirestoreValue(null)).toBeNull();
  });

  it('decodes large integers (like updatedAt) without precision loss', () => {
    expect(decodeFirestoreValue({ integerValue: '1700000000000' })).toBe(1_700_000_000_000);
  });

  it('decodes arrays and nested maps', () => {
    const v = {
      arrayValue: {
        values: [
          { mapValue: { fields: { sura: { stringValue: 'البقرة' }, from: { stringValue: '1' } } } },
          { integerValue: '7' },
        ],
      },
    };
    expect(decodeFirestoreValue(v)).toEqual([{ sura: 'البقرة', from: '1' }, 7]);
  });

  it('treats an empty arrayValue as []', () => {
    expect(decodeFirestoreValue({ arrayValue: {} })).toEqual([]);
  });
});

describe('decodeFirestoreDocument', () => {
  it('reconstructs a publicStats-shaped object from a REST document', () => {
    const doc = {
      name: 'projects/x/databases/(default)/documents/publicStats/tok',
      fields: {
        name: { stringValue: 'زيد أحمد' },
        rank: { nullValue: null },
        attendPct: { integerValue: '88' },
        avgLoh: { integerValue: '86' },
        badges: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: {
                    key: { stringValue: 'streak' },
                    icon: { stringValue: '🔥' },
                    label: { stringValue: 'استمرارية' },
                  },
                },
              },
            ],
          },
        },
        scoreHistory: {
          arrayValue: {
            values: [
              {
                mapValue: {
                  fields: {
                    date: { stringValue: '2026-07-09' },
                    loh: { integerValue: '92' },
                    madi: { nullValue: null },
                  },
                },
              },
            ],
          },
        },
      },
    };
    const decoded = decodeFirestoreDocument(doc) as any;
    expect(decoded.name).toBe('زيد أحمد');
    expect(decoded.rank).toBeNull();
    expect(decoded.attendPct).toBe(88);
    expect(decoded.badges[0]).toEqual({ key: 'streak', icon: '🔥', label: 'استمرارية' });
    expect(decoded.scoreHistory[0]).toEqual({ date: '2026-07-09', loh: 92, madi: null });
  });
});

describe('fetchPublicStatsRest', () => {
  it('builds the public REST url with the token and returns the decoded doc', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ fields: { name: { stringValue: 'زيد' } } }),
    });
    const result = await fetchPublicStatsRest('tok abc', { fetchImpl: fetchImpl as any });
    expect((result as any).name).toBe('زيد');
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/documents/publicStats/tok%20abc');
    expect(calledUrl).toContain('databases/(default)');
    expect(calledUrl).toContain('key=');
  });

  it('returns null on 404 (missing/expired token)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await fetchPublicStatsRest('missing', { fetchImpl: fetchImpl as any })).toBeNull();
  });

  it('throws on other HTTP errors so the page can show a retry state', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchPublicStatsRest('x', { fetchImpl: fetchImpl as any })).rejects.toThrow(/500/);
  });
});
