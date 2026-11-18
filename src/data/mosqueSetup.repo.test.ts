import { describe, it, expect, vi, beforeEach } from 'vitest';

// firestore.rules requires `id` IN the mosque document (and equal to the path).
// The generic converters strip `id` before writing, so a mosque written through
// mosqueConverter was rejected every time — «تعذّر إنشاء المسجد». This pins the
// exact body that reaches Firestore.

const setDocMock = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => {
    const ref = { path: path.join('/'), converter: null as unknown };
    return { ...ref, withConverter: (c: unknown) => ({ ...ref, converter: c }) };
  },
  setDoc: (...a: unknown[]) => setDocMock(...a),
  arrayUnion: (...v: unknown[]) => ({ arrayUnion: v }),
}));
vi.mock('./firebase', () => ({ db: {} }));

import { createMosque } from './mosqueSetup.repo';

type Ref = { path: string; converter: { toFirestore(d: unknown): unknown } | null };
/** What Firestore would actually store for each write, converter applied. */
function storedBodies() {
  return setDocMock.mock.calls.map(([ref, data]) => {
    const r = ref as Ref;
    return { path: r.path, body: r.converter ? r.converter.toFirestore(data) : data };
  });
}

beforeEach(() => setDocMock.mockClear());

describe('createMosque', () => {
  it('stores the mosque with exactly the fields the rules demand, id included', async () => {
    const tenant = await createMosque({ mosqueName: 'مسجد النور', halaqaNames: ['الحفظة'] }, 'u1');
    const mosque = storedBodies().find((w) => w.path === `mosques/${tenant.mosqueId}`)!;

    expect(mosque.body).toMatchObject({ id: tenant.mosqueId, name: 'مسجد النور', ownerUid: 'u1' });
    expect(Object.keys(mosque.body as object).sort()).toEqual(
      ['createdAt', 'id', 'name', 'ownerUid'].sort(),
    );
  });

  it('writes in the order the rules authorise: mosque, member, halaqat, user index', async () => {
    const tenant = await createMosque({ mosqueName: 'م', halaqaNames: ['أ', 'ب'] }, 'u1');
    const paths = storedBodies().map((w) => w.path);
    expect(paths[0]).toBe(`mosques/${tenant.mosqueId}`);
    expect(paths[1]).toBe(`mosques/${tenant.mosqueId}/members/u1`);
    expect(paths.slice(2, 4).every((p) => p.includes('/halaqat/'))).toBe(true);
    expect(paths[4]).toBe('users/u1');
  });
});
