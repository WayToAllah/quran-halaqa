import { describe, it, expect } from 'vitest';
import { buildAdminRecords, validateProvisionConfig, type ProvisionConfig } from './provisioning';

const valid: ProvisionConfig = {
  mosques: [
    {
      mosqueId: 'altayseer',
      name: 'مسجد التيسير',
      members: [{ uid: 'uid_ahmed', role: 'owner' }, { uid: 'uid_mahmoud' }],
      halaqat: [
        { halaqaId: 'main', name: 'الحلقة الرئيسية', primaryTeacherUid: 'uid_ahmed' },
        { halaqaId: 'asr', name: 'حلقة العصر', primaryTeacherUid: 'uid_mahmoud' },
      ],
    },
  ],
};

describe('validateProvisionConfig', () => {
  it('accepts a well-formed config', () => {
    expect(validateProvisionConfig(valid)).toEqual([]);
  });

  it('rejects an empty config', () => {
    expect(validateProvisionConfig({ mosques: [] })).toHaveLength(1);
  });

  it('rejects a mosque with no members — nobody could ever open it', () => {
    const cfg: ProvisionConfig = {
      mosques: [{ mosqueId: 'x', name: 'م', members: [], halaqat: [{ halaqaId: 'h', name: 'ح' }] }],
    };
    expect(validateProvisionConfig(cfg).some((e) => e.includes('at least one member'))).toBe(true);
  });

  it('rejects a mosque with no halaqat', () => {
    const cfg: ProvisionConfig = {
      mosques: [{ mosqueId: 'x', name: 'م', members: [{ uid: 'u' }], halaqat: [] }],
    };
    expect(validateProvisionConfig(cfg).some((e) => e.includes('at least one halaqa'))).toBe(true);
  });

  it('catches a primary teacher who is not a member of that mosque', () => {
    const cfg: ProvisionConfig = {
      mosques: [
        {
          mosqueId: 'x',
          name: 'م',
          members: [{ uid: 'u1' }],
          halaqat: [{ halaqaId: 'h', name: 'ح', primaryTeacherUid: 'stranger' }],
        },
      ],
    };
    expect(validateProvisionConfig(cfg).some((e) => e.includes('not a member'))).toBe(true);
  });

  it('catches duplicate mosque and halaqa ids', () => {
    const cfg: ProvisionConfig = {
      mosques: [
        { mosqueId: 'x', name: 'م', members: [{ uid: 'u' }], halaqat: [{ halaqaId: 'h', name: 'ح' }] },
        {
          mosqueId: 'x',
          name: 'م٢',
          members: [{ uid: 'u' }],
          halaqat: [
            { halaqaId: 'h', name: 'ح' },
            { halaqaId: 'h', name: 'ح مكرر' },
          ],
        },
      ],
    };
    const errs = validateProvisionConfig(cfg);
    expect(errs.some((e) => e.includes('duplicate mosqueId'))).toBe(true);
    expect(errs.some((e) => e.includes('duplicate halaqaId'))).toBe(true);
  });
});

describe('buildAdminRecords', () => {
  it('gives every member an admins record naming their mosque', () => {
    const recs = buildAdminRecords(valid);
    expect(recs.get('uid_ahmed')).toEqual([{ mosqueId: 'altayseer', label: 'مسجد التيسير' }]);
    expect(recs.get('uid_mahmoud')).toEqual([{ mosqueId: 'altayseer', label: 'مسجد التيسير' }]);
  });

  it('lists both mosques for a teacher who works in two', () => {
    const cfg: ProvisionConfig = {
      mosques: [
        { mosqueId: 'a', name: 'أ', members: [{ uid: 'u' }], halaqat: [{ halaqaId: 'h', name: 'ح' }] },
        { mosqueId: 'b', name: 'ب', members: [{ uid: 'u' }], halaqat: [{ halaqaId: 'h', name: 'ح' }] },
      ],
    };
    expect(buildAdminRecords(cfg).get('u')?.map((m) => m.mosqueId)).toEqual(['a', 'b']);
  });

  it('never lists a mosque the user is not a member of', () => {
    const cfg: ProvisionConfig = {
      mosques: [
        { mosqueId: 'a', name: 'أ', members: [{ uid: 'u1' }], halaqat: [{ halaqaId: 'h', name: 'ح' }] },
        { mosqueId: 'b', name: 'ب', members: [{ uid: 'u2' }], halaqat: [{ halaqaId: 'h', name: 'ح' }] },
      ],
    };
    const recs = buildAdminRecords(cfg);
    expect(recs.get('u1')?.map((m) => m.mosqueId)).toEqual(['a']);
    expect(recs.get('u2')?.map((m) => m.mosqueId)).toEqual(['b']);
  });
});
