import { describe, it, expect } from 'vitest';
import { validateMosqueSetup, buildMosqueSetup, MAX_NAME_LEN } from './mosqueSetup';

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

describe('validateMosqueSetup', () => {
  it('accepts a mosque with at least one halaqa', () => {
    expect(validateMosqueSetup({ mosqueName: 'مسجد النور', halaqaNames: ['الحفظة'] })).toBeNull();
  });

  it('requires a mosque name', () => {
    expect(validateMosqueSetup({ mosqueName: '   ', halaqaNames: ['الحفظة'] })).toMatch(/المسجد/);
  });

  // A mosque with no halaqa can never be opened — buildTenantOptions drops it,
  // so the teacher would create it and then not find it in the switcher.
  it('requires at least one non-blank halaqa', () => {
    expect(validateMosqueSetup({ mosqueName: 'مسجد النور', halaqaNames: [] })).toMatch(/حلقة/);
    expect(validateMosqueSetup({ mosqueName: 'مسجد النور', halaqaNames: ['  '] })).toMatch(/حلقة/);
  });

  it('rejects names longer than the rules will accept', () => {
    expect(
      validateMosqueSetup({ mosqueName: 'ح'.repeat(MAX_NAME_LEN + 1), halaqaNames: ['الحفظة'] }),
    ).toMatch(/طويل/);
    expect(
      validateMosqueSetup({ mosqueName: 'مسجد', halaqaNames: ['ح'.repeat(MAX_NAME_LEN + 1)] }),
    ).toMatch(/طويل/);
  });

  it('rejects two halaqat with the same name', () => {
    expect(
      validateMosqueSetup({ mosqueName: 'مسجد النور', halaqaNames: ['الحفظة', ' الحفظة '] }),
    ).toMatch(/مكرر/);
  });
});

describe('buildMosqueSetup', () => {
  it('builds the mosque, the owner membership and every halaqa', () => {
    const plan = buildMosqueSetup(
      { mosqueName: '  مسجد النور  ', halaqaNames: ['الحفظة', ' الناشئين '] },
      'uid_1',
      ids(),
      1000,
    );

    expect(plan.mosque).toEqual({
      id: 'id1',
      name: 'مسجد النور',
      createdAt: 1000,
      ownerUid: 'uid_1',
    });
    expect(plan.ownerUid).toBe('uid_1');
    expect(plan.member).toEqual({ role: 'owner' });
    expect(plan.halaqat).toEqual([
      { id: 'id2', name: 'الحفظة', excludedDates: [], attendanceBadgeThreshold: 70 },
      { id: 'id3', name: 'الناشئين', excludedDates: [], attendanceBadgeThreshold: 70 },
    ]);
  });

  /**
   * The mosque document carries ownerUid, and the rules read it to decide who
   * may write members/{uid}. That is what lets the whole thing be created by a
   * plain signed-in client with no Cloud Function: the mosque is one
   * self-authorising write, and every later write is authorised by it.
   */
  it('names the creator as owner on the mosque document itself', () => {
    const plan = buildMosqueSetup({ mosqueName: 'مسجد', halaqaNames: ['حلقة'] }, 'uid_9', ids(), 0);
    expect(plan.mosque.ownerUid).toBe('uid_9');
  });

  it('drops blank halaqa entries left behind by the form', () => {
    const plan = buildMosqueSetup(
      { mosqueName: 'مسجد', halaqaNames: ['حلقة', '   ', ''] },
      'uid_1',
      ids(),
      0,
    );
    expect(plan.halaqat).toHaveLength(1);
  });

  it('refuses to build something the validator rejected', () => {
    expect(() =>
      buildMosqueSetup({ mosqueName: '', halaqaNames: ['حلقة'] }, 'u', ids(), 0),
    ).toThrow();
    expect(() =>
      buildMosqueSetup({ mosqueName: 'مسجد', halaqaNames: [] }, 'u', ids(), 0),
    ).toThrow();
  });

  // The switcher only appears once the index lists the mosque, so the new id
  // has to be part of the plan rather than an afterthought at the call site.
  it('reports the id that must be appended to the user index', () => {
    const plan = buildMosqueSetup({ mosqueName: 'مسجد', halaqaNames: ['حلقة'] }, 'u', ids(), 0);
    expect(plan.mosque.id).toBe('id1');
  });
});
