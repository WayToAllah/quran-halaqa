import { useState } from 'preact/hooks';
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
  const { options, loading } = useMemberships(uid, tenant);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<TenantOption | null>(null);

  if (loading || options.length < 2) return null;

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

  function confirmSwitch() {
    if (!pending) return;
    setTenant({ mosqueId: pending.mosqueId, halaqaId: pending.halaqaId });
    setPending(null);
  }

  return (
    <>
      <button
        type="button"
        class="shrink-0 max-w-[42%] px-2.5 py-1.5 rounded-full border border-hairline bg-white flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
      >
        <span class="text-[11.5px] font-bold text-ink-dark truncate">
          {current ? current.mosqueName : tenant.mosqueId}
        </span>
        <span class="text-[9px] text-taupe">▾</span>
      </button>

      {open && (
        <div class="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            class="absolute top-[62px] right-3 left-3 sm:left-auto sm:w-72 bg-white rounded-2xl border border-hairline shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((o) => {
              const active = o.mosqueId === tenant.mosqueId && o.halaqaId === tenant.halaqaId;
              return (
                <button
                  key={`${o.mosqueId}/${o.halaqaId}`}
                  type="button"
                  class="w-full text-right px-4 py-3 border-b border-hairline last:border-b-0 flex flex-col gap-0.5"
                  style={{ background: active ? '#F6F3EA' : 'white' }}
                  onClick={() => choose(o)}
                >
                  <span class="text-[13px] font-bold text-ink-dark">{o.mosqueName}</span>
                  <span class="text-[11px] text-taupe">{o.halaqaName}</span>
                </button>
              );
            })}
          </div>
        </div>
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
    </>
  );
}
