import { SURAS } from '../../domain/suras';
import { validateAyahRange } from '../../domain/record';
import type { SuraAssignment } from '../../types';

interface Props {
  value: SuraAssignment;
  onChange: (v: SuraAssignment) => void;
  onRemove?: () => void;
  label: string;
}

export function SuraRow({ value, onChange, onRemove, label }: Props) {
  const errors = validateAyahRange(value.sura || '', value.from || '', value.to || '');

  return (
    <div class="p-3 rounded-xl border border-neutral-100 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-neutral-500">{label}</span>
        {onRemove && (
          <button type="button" class="text-xs text-red-500" onClick={onRemove}>
            ✕ حذف
          </button>
        )}
      </div>
      <div class="grid grid-cols-3 gap-2">
        <select
          class="col-span-3 sm:col-span-1 border border-neutral-300 rounded-lg px-2 py-2 text-sm bg-white"
          value={value.sura || ''}
          onChange={(e) => onChange({ ...value, sura: (e.target as HTMLSelectElement).value })}
        >
          <option value="">— السورة —</option>
          {SURAS.map(([name]) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div>
          <input
            type="number"
            min={1}
            placeholder="من آية"
            class={
              'w-full border rounded-lg px-2 py-2 text-sm ' +
              (errors.fromError ? 'border-red-400' : 'border-neutral-300')
            }
            value={value.from || ''}
            onInput={(e) => onChange({ ...value, from: (e.target as HTMLInputElement).value })}
          />
          {errors.fromError && <div class="text-[10px] text-red-500 mt-0.5">{errors.fromError}</div>}
        </div>
        <div>
          <input
            type="number"
            min={1}
            placeholder="إلى آية"
            class={
              'w-full border rounded-lg px-2 py-2 text-sm ' + (errors.toError ? 'border-red-400' : 'border-neutral-300')
            }
            value={value.to || ''}
            onInput={(e) => onChange({ ...value, to: (e.target as HTMLInputElement).value })}
          />
          {errors.toError && <div class="text-[10px] text-red-500 mt-0.5">{errors.toError}</div>}
        </div>
      </div>
    </div>
  );
}
