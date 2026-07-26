import { useMosque } from './MosqueContext';

/**
 * A compact mosque switcher shown directly under the header, above the tabs.
 * Renders nothing when the admin belongs to a single mosque (the common case),
 * so the single-tenant experience is completely unchanged. When there's more
 * than one, it shows the active mosque's name and lets the teacher switch;
 * the choice is remembered across restarts (handled in useAuth).
 */
export function MosqueSwitcher() {
  const { mosqueId, mosques, switchMosque } = useMosque();

  // Nothing to switch between → don't take up any space.
  if (mosques.length <= 1) return null;

  return (
    <div class="flex items-center gap-2 min-w-0">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" class="shrink-0">
        <path
          d="M6 20.5V11c0-3.3 2.7-6 6-6s6 2.7 6 6v9.5"
          stroke="#0F3D2E"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M4.5 20.5h15" stroke="#0F3D2E" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <label class="text-[11px] text-taupe shrink-0">المسجد الحالي:</label>
      <select
        class="flex-1 min-w-0 bg-white border border-hairline rounded-lg px-2 py-1.5 text-[13px] font-bold text-forest"
        value={mosqueId}
        onChange={(e) => switchMosque((e.target as HTMLSelectElement).value)}
      >
        {mosques.map((m) => (
          <option key={m.mosqueId} value={m.mosqueId}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
