import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firestore SDK surface used by mosques.repo. `getDoc` is the one we
// drive per-test; the rest just need to exist.
const getDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  doc: () => ({}),
  collection: () => ({}),
  getDocs: vi.fn(),
}));
vi.mock('./firebase', () => ({ db: {}, auth: {} }));
vi.mock('./converters', () => ({ halaqaConverter: {}, mosqueConverter: {} }));

import { getUserMosques } from './mosques.repo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getUserMosques resilience', () => {
  // The regression this guards: `admins/{uid}` has no rule in firestore.rules,
  // and Firestore denies anything not explicitly allowed. If this read threw,
  // useAuth's catch would set status='denied' and lock the teacher out of a
  // halaqa they legitimately own. It must degrade to single-mosque instead.
  it('returns null (single-mosque fallback) when the read is denied by rules', async () => {
    getDoc.mockRejectedValueOnce(Object.assign(new Error('Missing or insufficient permissions.'), {
      code: 'permission-denied',
    }));
    await expect(getUserMosques('uid_1')).resolves.toBeNull();
  });

  it('returns null when the admins doc simply does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(getUserMosques('uid_1')).resolves.toBeNull();
  });

  it('returns the mosque list when the doc exists', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ mosques: [{ mosqueId: 'altayseer', label: 'مسجد التيسير' }] }),
    });
    const res = await getUserMosques('uid_1');
    expect(res?.mosques).toHaveLength(1);
    expect(res?.mosques[0].mosqueId).toBe('altayseer');
  });

  it('drops malformed entries that have no mosqueId', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ mosques: [{ label: 'بدون معرف' }, { mosqueId: 'noor', label: 'النور' }] }),
    });
    const res = await getUserMosques('uid_1');
    expect(res?.mosques.map((m) => m.mosqueId)).toEqual(['noor']);
  });

  it('tolerates a doc whose mosques field is not an array', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ mosques: 'nope' }) });
    const res = await getUserMosques('uid_1');
    expect(res?.mosques).toEqual([]);
  });
});
