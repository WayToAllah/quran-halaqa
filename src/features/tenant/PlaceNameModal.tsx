import { useState } from 'preact/hooks';
import { validatePlaceName } from '../../domain/mosqueSetup';

export interface PlaceNameField {
  id: string;
  /** «المسجد» or «الحلقة» — used in the label and the error text. */
  what: string;
  initial: string;
  placeholder?: string;
}

interface Props {
  title: string;
  fields: PlaceNameField[];
  saveLabel: string;
  /** Receives every field's trimmed value, keyed by id. */
  onSave: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

/**
 * Small sheet for naming a mosque or halaqa: renaming either, or adding a
 * halaqa. Same name rule as mosque creation (validatePlaceName).
 */
export function PlaceNameModal({ title, fields, saveLabel, onSave, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, f.initial])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    for (const f of fields) {
      const problem = validatePlaceName(values[f.id] ?? '', f.what);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(Object.fromEntries(fields.map((f) => [f.id, (values[f.id] ?? '').trim()])));
    } catch (err) {
      console.error('place name save failed:', err);
      setError('تعذّر الحفظ. اتأكد إنك متصل بالإنترنت وحاول تاني.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
      <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 text-right">
        <h2 class="text-base font-bold text-ink-dark">{title}</h2>
        {fields.map((f) => (
          <div key={f.id} class="space-y-1">
            <label class="text-xs font-semibold text-ink-dark" for={`place-${f.id}`}>
              {`اسم ${f.what}`}
            </label>
            <input
              id={`place-${f.id}`}
              class="w-full rounded-xl border border-hairline px-3 py-2 text-sm bg-white"
              value={values[f.id] ?? ''}
              placeholder={f.placeholder}
              onInput={(e) =>
                setValues((v) => ({ ...v, [f.id]: (e.target as HTMLInputElement).value }))
              }
            />
          </div>
        ))}
        {error && <p class="text-xs text-red-700 font-semibold">{error}</p>}
        <div class="flex gap-2 pt-1">
          <button
            type="button"
            class="flex-1 rounded-xl bg-forest text-white py-2.5 text-sm font-bold disabled:opacity-50"
            disabled={saving}
            onClick={submit}
          >
            {saveLabel}
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
