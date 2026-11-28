import { createPortal } from 'preact/compat';
import { useState } from 'preact/hooks';
import { CreateMosqueModal } from './CreateMosqueModal';
import { PlaceNameModal } from './PlaceNameModal';
import { addHalaqa, renameHalaqa, renameMosque } from '../../data/mosques.repo';
import { useToast } from '../../ui/ToastProvider';
import { useTenantControls } from './TenantContext';
import { useDraftGuard } from './DraftGuard';
import { useMemberships } from '../../hooks/useMemberships';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { sameTenant } from '../../domain/tenant';
import type { TenantOption } from '../../domain/memberships';

/**
 * Header control for moving between mosques and halaqat.
 *
 * Renders nothing at all when there is only one place to go — which is every
 * teacher today. A control that can't do anything is dead chrome in a header
 * that is already tight on a phone, and it would make the app look like it
 * has a mode nobody asked for.
 */
export function TenantSwitcher({ uid }: { uid: string | null }) {
  const { tenant, setTenant } = useTenantControls();
  const { hasDraft } = useDraftGuard();
  const { options, loading, reload } = useMemberships(uid, tenant);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TenantOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TenantOption | null>(null);
  const [addingHalaqa, setAddingHalaqa] = useState(false);
  const { showToast } = useToast();

  // Adding a mosque has to live somewhere reachable, and this is its only
  // natural home — so the chip now appears for any signed-in teacher, not just
  // one who already has two halaqat. A teacher with a single halaqa sees their
  // mosque name and one extra action, nothing more.
  if (loading || !uid || options.length === 0) return null;

  const current =
    options.find((o) => o.mosqueId === tenant.mosqueId && o.halaqaId === tenant.halaqaId) ?? null;

  function choose(o: TenantOption) {
    setOpen(false);
    const next = { mosqueId: o.mosqueId, halaqaId: o.halaqaId };
    // Re-picking what is already open is not a switch — warning about it would
    // train the teacher to dismiss the warning without reading it.
    if (sameTenant(tenant, next)) return;
    // Every screen stays mounted, so a half-typed session is still holding a
    // studentId from this mosque. Saving it after the switch would file it
    // under a halaqa that student doesn't belong to.
    if (hasDraft) {
      setPending(o);
      return;
    }
    setTenant(next);
  }

  function afterCreate(next: { mosqueId: string; halaqaId: string }) {
    setCreating(false);
    // Jumping into the new mosque would throw away a half-typed session exactly
    // the way a manual switch would. The mosque is made either way; it just
    // waits in the list until the session is dealt with.
    if (hasDraft) {
      showToast('اتعمل المسجد. بدّل ليه بعد ما تحفظ الجلسة');
      return;
    }
    setTenant(next);
    showToast('✓ اتعمل المسجد');
  }

  // Only the owner may rename a mosque (firestore.rules); any member may
  // rename a halaqa. Only what changed is written.
  async function saveNames(o: TenantOption, values: Record<string, string>) {
    if (values.mosque !== undefined && values.mosque !== o.mosqueName) {
      await renameMosque(o.mosqueId, values.mosque);
    }
    if (values.halaqa !== o.halaqaName) {
      await renameHalaqa(o.mosqueId, o.halaqaId, values.halaqa);
    }
    setEditing(null);
    reload();
    showToast('✓ اتغيّر الاسم');
  }

  async function saveNewHalaqa(values: Record<string, string>) {
    const halaqaId = await addHalaqa(tenant.mosqueId, values.halaqa);
    setAddingHalaqa(false);
    reload();
    // Same rule as a new mosque: never throw away a half-typed session.
    if (hasDraft) {
      showToast('اتعملت الحلقة. بدّل ليها بعد ما تحفظ الجلسة');
      return;
    }
    setTenant({ mosqueId: tenant.mosqueId, halaqaId });
    showToast('✓ اتعملت الحلقة');
  }

  function confirmSwitch() {
    if (!pending) return;
    setTenant({ mosqueId: pending.mosqueId, halaqaId: pending.halaqaId });
    setPending(null);
  }

  return (
    <>
      <button
        type="button"
        class="self-start max-w-full min-w-0 flex items-center gap-1 text-right"
        onClick={() => setOpen((v) => !v)}
      >
        <span class="min-w-0 text-[11.5px] font-bold text-taupe truncate">
          {current ? current.mosqueName : tenant.mosqueId}
        </span>
        <span class="text-[9px] text-taupe">▾</span>
      </button>

      {open && (
        <div class="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            class="absolute top-[calc(var(--app-bar-h,69px)-4px)] right-3 left-3 sm:left-auto sm:w-72 bg-white rounded-2xl border border-hairline shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((o) => {
              const active = o.mosqueId === tenant.mosqueId && o.halaqaId === tenant.halaqaId;
              return (
                <div
                  key={`${o.mosqueId}/${o.halaqaId}`}
                  class="flex items-stretch border-b border-hairline last:border-b-0"
                  style={{ background: active ? '#F6F3EA' : 'white' }}
                >
                  <button
                    type="button"
                    class="flex-1 min-w-0 text-right px-4 py-3 flex flex-col gap-0.5"
                    onClick={() => choose(o)}
                  >
                    <span class="text-[13px] font-bold text-ink-dark">{o.mosqueName}</span>
                    <span class="text-[11px] text-taupe">{o.halaqaName}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`تعديل ${o.mosqueName} — ${o.halaqaName}`}
                    class="px-4 text-[14px] text-taupe"
                    onClick={() => {
                      setOpen(false);
                      setEditing(o);
                    }}
                  >
                    ✏️
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              class="w-full text-right px-4 py-3 text-[12.5px] font-bold text-forest border-t border-hairline"
              onClick={() => {
                setOpen(false);
                setAddingHalaqa(true);
              }}
            >
              {`＋ حلقة جديدة في ${current ? current.mosqueName : tenant.mosqueId}`}
            </button>
            <button
              type="button"
              class="w-full text-right px-4 py-3 text-[12.5px] font-bold text-forest border-t border-hairline"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
            >
              ＋ مسجد جديد
            </button>
          </div>
        </div>
      )}

      {/* Rendered at the page root: this component sits inside the sticky app
          bar (z-10), a stacking context of its own, so a modal mounted here was
          painted UNDER the bottom nav (z-20) — which covered «إنشاء المسجد». */}
      {createPortal(
        <>
          {creating && uid && (
            <CreateMosqueModal
              ownerUid={uid}
              onClose={() => setCreating(false)}
              onCreated={afterCreate}
            />
          )}

          {editing && (
            <PlaceNameModal
              title="تعديل الاسم"
              saveLabel="حفظ"
              fields={[
                ...(editing.ownerUid && editing.ownerUid === uid
                  ? [{ id: 'mosque', what: 'المسجد', initial: editing.mosqueName }]
                  : []),
                { id: 'halaqa', what: 'الحلقة', initial: editing.halaqaName },
              ]}
              onSave={(values) => saveNames(editing, values)}
              onClose={() => setEditing(null)}
            />
          )}

          {addingHalaqa && (
            <PlaceNameModal
              title={`حلقة جديدة في ${current ? current.mosqueName : tenant.mosqueId}`}
              saveLabel="إضافة الحلقة"
              fields={[{ id: 'halaqa', what: 'الحلقة', initial: '' }]}
              onSave={saveNewHalaqa}
              onClose={() => setAddingHalaqa(false)}
            />
          )}

          {pending && (
            <ConfirmDialog
              title="فيه جلسة مش محفوظة"
              message={`لو بدّلت لـ${pending.mosqueName} دلوقتي، اللي كتبته في شاشة التسجيل هيتمسح. تحب تحفظه الأول؟`}
              confirmLabel="بدّل وامسح"
              cancelLabel="إلغاء"
              destructive
              onConfirm={confirmSwitch}
              onCancel={() => setPending(null)}
            />
          )}
        </>,
        document.body,
      )}
    </>
  );
}
