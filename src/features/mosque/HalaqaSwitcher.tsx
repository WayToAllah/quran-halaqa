import { useMosque } from './MosqueContext';

/**
 * Halaqa picker for the active mosque, shown next to the mosque switcher.
 * Hidden when the mosque has only one halaqa, so the common single-circle
 * setup looks exactly as it did before.
 *
 * Every halaqa listed here is fully usable: mosque membership — not halaqa
 * ownership — grants access, which is what lets a teacher stand in for an
 * absent colleague and record in their circle.
 */
export function HalaqaSwitcher() {
  const { halaqaId, halaqat, switchHalaqa } = useMosque();

  if (halaqat.length <= 1) return null;

  return (
    <div class="flex items-center gap-2 min-w-0">
      <label class="text-[11px] text-taupe shrink-0">الحلقة:</label>
      <select
        class="flex-1 min-w-0 bg-white border border-hairline rounded-lg px-2 py-1.5 text-[13px] font-bold text-forest"
        value={halaqaId}
        onChange={(e) => switchHalaqa((e.target as HTMLSelectElement).value)}
      >
        {halaqat.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name || h.id}
          </option>
        ))}
      </select>
    </div>
  );
}
