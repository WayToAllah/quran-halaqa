/**
 * Pure helpers for the provisioning script (scripts/provision-mosque.ts).
 * Kept free of firebase-admin so the rules that decide what a valid mosque
 * setup looks like can be unit-tested without any network or credentials.
 */

export interface HalaqaSpec {
  halaqaId: string;
  name: string;
  primaryTeacherUid?: string;
  excludedDates?: string[];
  attendanceBadgeThreshold?: number;
}

export interface MemberSpec {
  uid: string;
  role?: 'owner' | 'admin';
}

export interface MosqueSpec {
  mosqueId: string;
  name: string;
  members: MemberSpec[];
  halaqat: HalaqaSpec[];
}

export interface ProvisionConfig {
  mosques: MosqueSpec[];
}

/**
 * Validates a provisioning config up front, so a typo can never half-create a
 * mosque. Returns a list of human-readable problems; empty means valid.
 */
export function validateProvisionConfig(cfg: ProvisionConfig): string[] {
  const errors: string[] = [];
  if (!Array.isArray(cfg?.mosques) || cfg.mosques.length === 0) {
    return ['config.mosques must be a non-empty array'];
  }

  const seenMosques = new Set<string>();
  for (const m of cfg.mosques) {
    if (!m.mosqueId) errors.push('a mosque is missing mosqueId');
    if (!m.name) errors.push(`mosque ${m.mosqueId}: missing name`);
    if (seenMosques.has(m.mosqueId)) errors.push(`duplicate mosqueId: ${m.mosqueId}`);
    seenMosques.add(m.mosqueId);

    // Without a member, nobody could ever open the mosque — the rules gate
    // every read on mosques/{id}/members/{uid}.
    if (!Array.isArray(m.members) || m.members.length === 0) {
      errors.push(`mosque ${m.mosqueId}: needs at least one member, or nobody can open it`);
    }
    for (const mem of m.members ?? []) {
      if (!mem.uid) errors.push(`mosque ${m.mosqueId}: a member is missing uid`);
    }

    if (!Array.isArray(m.halaqat) || m.halaqat.length === 0) {
      errors.push(`mosque ${m.mosqueId}: needs at least one halaqa`);
    }

    const seenHalaqat = new Set<string>();
    const memberUids = new Set((m.members ?? []).map((x) => x.uid));
    for (const h of m.halaqat ?? []) {
      if (!h.halaqaId) errors.push(`mosque ${m.mosqueId}: a halaqa is missing halaqaId`);
      if (!h.name) errors.push(`mosque ${m.mosqueId}/${h.halaqaId}: missing name`);
      if (seenHalaqat.has(h.halaqaId)) errors.push(`mosque ${m.mosqueId}: duplicate halaqaId ${h.halaqaId}`);
      seenHalaqat.add(h.halaqaId);
      // A primary teacher who isn't a member couldn't actually open the halaqa.
      if (h.primaryTeacherUid && !memberUids.has(h.primaryTeacherUid)) {
        errors.push(
          `mosque ${m.mosqueId}/${h.halaqaId}: primaryTeacherUid ${h.primaryTeacherUid} is not a member of this mosque`,
        );
      }
    }
  }
  return errors;
}

/**
 * Derives the `admins/{uid}` records from the memberships, so the login
 * lookup and the actual access grants can never drift apart: every uid that
 * is a member of a mosque gets that mosque listed, and nothing else.
 */
export function buildAdminRecords(cfg: ProvisionConfig): Map<string, { mosqueId: string; label: string }[]> {
  const byUid = new Map<string, { mosqueId: string; label: string }[]>();
  for (const m of cfg.mosques) {
    for (const mem of m.members ?? []) {
      const list = byUid.get(mem.uid) ?? [];
      if (!list.some((x) => x.mosqueId === m.mosqueId)) {
        list.push({ mosqueId: m.mosqueId, label: m.name });
      }
      byUid.set(mem.uid, list);
    }
  }
  return byUid;
}
