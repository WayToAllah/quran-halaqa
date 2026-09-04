import { useState } from 'preact/hooks';
import { createMosque } from '../../data/mosqueSetup.repo';
import { validateMosqueSetup } from '../../domain/mosqueSetup';
import type { Tenant } from '../../domain/tenant';

interface Props {
  ownerUid: string;
  onClose: () => void;
  onCreated: (tenant: Tenant) => void;
}

export function CreateMosqueModal({ ownerUid, onClose, onCreated }: Props) {
  const [mosqueName, setMosqueName] = useState('');
  // One row from the start: a mosque with no halaqa can never be opened, so an
  // empty list would only teach the teacher to hunt for the "add" button.
  const [halaqaNames, setHalaqaNames] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setHalaqa(i: number, value: string) {
    setHalaqaNames((rows) => rows.map((r, j) => (j === i ? value : r)));
  }

  async function submit() {
    const input = { mosqueName, halaqaNames };
    const problem = validateMosqueSetup(input);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      onCreated(await createMosque(input, ownerUid));
    } catch (err) {
      // The rules reject this outright until they are deployed, and an offline
      // write never resolves — either way, say so rather than leaving a spinner
      // that looks like success.
      console.error('createMosque failed:', err);
      setError('تعذّر إنشاء المسجد. اتأكد إنك متصل بالإنترنت وحاول تاني.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div class="bg-cream w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 space-y-4 text-right max-h-[90vh] overflow-y-auto">
        <h2 class="text-base font-bold text-ink-dark">مسجد جديد</h2>

        <div class="space-y-1">
          <label class="text-xs font-semibold text-ink-dark" for="mosque-name">
            اسم المسجد
          </label>
          <input
            id="mosque-name"
            class="w-full rounded-xl border border-hairline px-3 py-2 text-sm bg-white"
            value={mosqueName}
            onInput={(e) => setMosqueName((e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="space-y-2">
          {halaqaNames.map((name, i) => (
            <div key={i} class="space-y-1">
              <label class="text-xs font-semibold text-ink-dark" for={`halaqa-${i}`}>
                {`اسم الحلقة ${i + 1}`}
              </label>
              <div class="flex gap-2">
                <input
                  id={`halaqa-${i}`}
                  class="flex-1 rounded-xl border border-hairline px-3 py-2 text-sm bg-white"
                  value={name}
                  onInput={(e) => setHalaqa(i, (e.target as HTMLInputElement).value)}
                />
                {halaqaNames.length > 1 && (
                  <button
                    type="button"
                    aria-label="حذف الحلقة"
                    class="px-3 rounded-xl border border-hairline text-taupe"
                    onClick={() => setHalaqaNames((rows) => rows.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            class="text-xs text-forest font-semibold underline"
            onClick={() => setHalaqaNames((rows) => [...rows, ''])}
          >
            إضافة حلقة
          </button>
        </div>

        {error && <p class="text-xs text-red-700 font-semibold">{error}</p>}

        <div class="flex gap-2 pt-1">
          <button
            type="button"
            class="flex-1 rounded-xl bg-forest text-white py-2.5 text-sm font-bold disabled:opacity-50"
            disabled={saving}
            onClick={submit}
          >
            إنشاء المسجد
          </button>
          <button
            type="button"
            class="px-4 rounded-xl border border-hairline text-sm text-taupe"
            onClick={onClose}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
