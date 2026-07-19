import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SURAS, suraNumber, suraPageLabel, findSuraByName, type SuraInfo } from '../../domain/suras';
import { validateAyahRange } from '../../domain/record';
import { normAr } from '../../domain/text';
import type { SuraAssignment } from '../../types';

interface Props {
  value: SuraAssignment;
  onChange: (v: SuraAssignment) => void;
  onRemove?: () => void;
  label: string;
}

export function SuraRow({ value, onChange, onRemove, label }: Props) {
  const isRange = !!value.range;
  const errors = isRange
    ? {}
    : validateAyahRange(value.sura || '', value.from || '', value.to || '');

  function toggleRange() {
    if (isRange) {
      // Leaving range mode: drop the end sura so it can't linger in a saved
      // per-sura row.
      const { toSura: _drop, range: _r, ...rest } = value;
      void _drop;
      void _r;
      onChange({ ...rest });
    } else {
      // Entering range mode: clear ayah numbers (a whole-sura range has none).
      const { from: _f, to: _t, ...rest } = value;
      void _f;
      void _t;
      onChange({ ...rest, range: true });
    }
  }

  return (
    <div class="pb-4 mb-4 border-b border-dashed border-hairline last:border-b-0 last:mb-0 last:pb-0">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-taupe">{label}</span>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1.5 text-[12px] font-semibold text-taupe cursor-pointer select-none">
            <input
              type="checkbox"
              class="w-[15px] h-[15px] accent-[#0F3D2E] cursor-pointer m-0"
              checked={isRange}
              onChange={toggleRange}
            />
            🔗 نطاق سور
          </label>
          {onRemove && (
            <button
              type="button"
              class="w-[38px] h-[38px] shrink-0 border border-hairline bg-white rounded-[10px] flex items-center justify-center"
              onClick={onRemove}
              aria-label="حذف"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#B24A3A" stroke-width="1.8" stroke-linecap="round">
                <path d="M5 6.5h14M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M7 6.5l.8 12.7a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div class="flex items-center gap-2 mb-3">
        {/* Start sura (in range mode this is the "من سورة") */}
        <SuraCombobox
          value={value.sura || ''}
          placeholder="اكتب اسم السورة…"
          onCommit={(name) => onChange({ ...value, sura: name })}
        />
      </div>

      {isRange ? (
        <div>
          <label class="block text-[11px] text-taupe mb-1.5">إلى سورة</label>
          <SuraCombobox
            value={value.toSura || ''}
            placeholder="اكتب سورة النهاية…"
            onCommit={(name) => onChange({ ...value, toSura: name })}
          />
        </div>
      ) : (
        <>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <input
                type="number"
                min={1}
                max={selectedInfoOf(value.sura)?.count}
                placeholder="من آية"
                class={
                  'w-full border rounded-[11px] px-2.5 py-2.5 text-sm text-ink-dark ' +
                  (errors.fromError ? 'border-red-400' : 'border-hairline')
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
                max={selectedInfoOf(value.sura)?.count}
                placeholder="إلى آية"
                class={
                  'w-full border rounded-[11px] px-2.5 py-2.5 text-sm text-ink-dark ' +
                  (errors.toError ? 'border-red-400' : 'border-hairline')
                }
                value={value.to || ''}
                onInput={(e) => onChange({ ...value, to: (e.target as HTMLInputElement).value })}
              />
              {errors.toError && <div class="text-[10px] text-red-500 mt-0.5">{errors.toError}</div>}
            </div>
          </div>

          {selectedInfoOf(value.sura) && (
            <div class="text-[11px] text-taupe mt-2">
              عدد آيات السورة: {selectedInfoOf(value.sura)!.count} ·{' '}
              {suraPageLabel(selectedInfoOf(value.sura)!)} (مصحف المدينة)
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Resolves a committed sura name to its reference info (or undefined). */
function selectedInfoOf(sura?: string): SuraInfo | undefined {
  return sura ? findSuraByName(sura) : undefined;
}

interface ComboProps {
  value: string;
  placeholder: string;
  onCommit: (name: string) => void;
}

/** A searchable sura combobox. Emits the committed sura name (empty string
 * while the typed text has no exact match). Factored out so the range mode's
 * "إلى سورة" picker reuses the exact same search/normalization behavior as the
 * primary picker. */
function SuraCombobox({ value, placeholder, onCommit }: ComboProps) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const matches = useMemo(() => {
    const q = normAr(query.trim());
    if (!q) return SURAS;
    return SURAS.filter((s) => normAr(s.name).includes(q));
  }, [query]);

  function commitSura(name: string) {
    setQuery(name);
    setOpen(false);
    onCommit(name);
  }

  function handleInput(text: string) {
    setQuery(text);
    setOpen(true);
    const exact = findSuraByName(text);
    onCommit(exact ? exact.name : '');
  }

  return (
    <div class="flex-1 min-w-0 relative">
      <input
        type="text"
        placeholder={placeholder}
        class={
          'w-full border rounded-[11px] px-3.5 py-3 text-sm text-ink-dark ' +
          (query && !value ? 'border-amber-400' : 'border-hairline')
        }
        value={query}
        onFocus={() => setOpen(true)}
        onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
      />
      {open && (
        <div class="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-hairline rounded-[11px] shadow-lg">
          {matches.length === 0 ? (
            <div class="px-3 py-2 text-xs text-taupe">لا توجد نتائج</div>
          ) : (
            matches.map((s) => (
              <button
                type="button"
                key={s.name}
                class="w-full text-right px-3 py-2 text-sm hover:bg-parchment flex items-center justify-between gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  commitSura(s.name);
                }}
              >
                <span>
                  {suraNumber(s.name)}. {s.name}
                </span>
                <span class="text-[11px] text-taupe whitespace-nowrap">
                  {s.count} آية · {suraPageLabel(s)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
