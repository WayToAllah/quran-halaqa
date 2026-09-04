import { describe, it, expect } from 'vitest';
import {
  MAX_INDEXED_MOSQUES,
  parseUserIndex,
  buildTenantOptions,
  type MosqueEntry,
} from './memberships';

describe('parseUserIndex', () => {
  it('reads the mosque ids out of the index document', () => {
    expect(parseUserIndex({ mosqueIds: ['altayseer', 'alnour'] })).toEqual(['altayseer', 'alnour']);
  });

  it('treats an absent or empty document as no index at all', () => {
    expect(parseUserIndex(null)).toEqual([]);
    expect(parseUserIndex(undefined)).toEqual([]);
    expect(parseUserIndex({})).toEqual([]);
    expect(parseUserIndex({ mosqueIds: [] })).toEqual([]);
  });

  /**
   * This document is written by the client (a teacher creating their own
   * mosque writes their own index entry), so every value in it is hostile
   * input. It is an *index*, never a grant: Firestore's rules still decide
   * what can be read, so a forged entry buys nothing but a failed read.
   */
  it('drops entries that are not usable document ids', () => {
    expect(parseUserIndex({ mosqueIds: ['ok', 'a/b', '', '..', 42, null, '__x__'] })).toEqual([
      'ok',
    ]);
  });

  it('ignores a document whose field is the wrong shape entirely', () => {
    expect(parseUserIndex({ mosqueIds: 'altayseer' })).toEqual([]);
    expect(parseUserIndex('altayseer')).toEqual([]);
    expect(parseUserIndex([])).toEqual([]);
  });

  it('de-duplicates, keeping first appearance', () => {
    expect(parseUserIndex({ mosqueIds: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
  });

  // Each id costs one mosque read plus one halaqat query, so an oversized
  // document must not be able to fan out into hundreds of reads.
  it('caps the list', () => {
    const many = Array.from({ length: MAX_INDEXED_MOSQUES + 20 }, (_, i) => `m${i}`);
    expect(parseUserIndex({ mosqueIds: many })).toHaveLength(MAX_INDEXED_MOSQUES);
  });
});

describe('buildTenantOptions', () => {
  const entry = (
    mosqueId: string,
    mosqueName: string | null,
    halaqat: { id: string; name?: string }[],
  ): MosqueEntry => ({
    mosqueId,
    mosque: mosqueName === null ? null : { id: mosqueId, name: mosqueName, createdAt: 0 },
    halaqat: halaqat.map((h) => ({
      id: h.id,
      name: h.name ?? '',
      excludedDates: [],
      attendanceBadgeThreshold: 70,
    })),
  });

  it('produces one option per halaqa', () => {
    expect(
      buildTenantOptions([
        entry('altayseer', 'مسجد التيسير', [{ id: 'main', name: 'الحلقة الكبرى' }]),
      ]),
    ).toEqual([
      {
        mosqueId: 'altayseer',
        mosqueName: 'مسجد التيسير',
        halaqaId: 'main',
        halaqaName: 'الحلقة الكبرى',
      },
    ]);
  });

  // A mosque the rules refused to read comes back null. Dropping it is the
  // whole point of treating the index as a hint rather than a permission.
  it('drops a mosque it could not read', () => {
    expect(buildTenantOptions([entry('ghost', null, [{ id: 'main' }])])).toEqual([]);
  });

  it('drops a mosque with no halaqat — there is nothing to open', () => {
    expect(buildTenantOptions([entry('empty', 'مسجد فاضي', [])])).toEqual([]);
  });

  // Names are display-only and the documents predate the field, so a blank one
  // must never render as an empty row.
  it('falls back to the id when a name is missing', () => {
    const [opt] = buildTenantOptions([entry('altayseer', '', [{ id: 'main', name: '' }])]);
    expect(opt.mosqueName).toBe('altayseer');
    expect(opt.halaqaName).toBe('main');
  });

  it('orders mosques as indexed, and halaqat by Arabic name inside each', () => {
    const opts = buildTenantOptions([
      entry('b_mosque', 'مسجد النور', [
        { id: 'h2', name: 'الناشئين' },
        { id: 'h1', name: 'الحفظة' },
      ]),
      entry('a_mosque', 'مسجد التيسير', [{ id: 'main', name: 'الحلقة' }]),
    ]);
    expect(opts.map((o) => `${o.mosqueId}/${o.halaqaId}`)).toEqual([
      'b_mosque/h1',
      'b_mosque/h2',
      'a_mosque/main',
    ]);
  });
});
