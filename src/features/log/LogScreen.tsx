import { useMemo, useState } from 'preact/hooks';
import { useRecentRecords } from '../../hooks/useRecentRecords';
import { useRecordSearch } from '../../hooks/useRecordSearch';
import { useStudents } from '../../hooks/useStudents';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { deleteRecord as deleteRecordDoc } from '../../data/records.repo';
import { republishPublicStatsFor } from '../../data/publishStats';
import { esc, toArabicDigits } from '../../domain/text';
import { displayStudentName } from '../../domain/students';
import { hasScore, scoreName } from '../../domain/scoring';
import { ayahRange, joinSuraNames } from '../../domain/suras';
import { hijriShort } from '../../domain/hijri';
import { PlainStars } from '../../ui/StarRating';
import { useToast } from '../../ui/ToastProvider';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import type { SessionRecord } from '../../types';

function formatDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  try {
    return new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

/** Tier badge colors ported from the mockup, keyed by the real scoreName()
 * bands (85/75/65/50) — same lookup used on the Record screen. */
const TIER_COLORS: Record<string, { bg: string; color: string }> = {
  'ممتاز': { bg: '#E7F2EC', color: '#0F3D2E' },
  'جيد جداً': { bg: '#EFF6E8', color: '#3E6B22' },
  'جيد': { bg: '#FFF8E6', color: '#8A6A15' },
  'مقبول': { bg: '#FBEEE3', color: '#9A5A24' },
  'إعادة': { bg: '#FBEAE7', color: '#B24A3A' },
};

function ScoreBar({ label, score, barColor }: { label: string; score: number; barColor: string }) {
  const tier = scoreName(score);
  const tc = TIER_COLORS[tier] ?? { bg: '#F1ECDD', color: '#5B5646' };
  return (
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[11.5px] text-taupe font-semibold">{label}</span>
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>
          {tier}
        </span>
      </div>
      <div class="flex items-center gap-2.5">
        <div class="flex-1 h-1.5 rounded-full bg-[#F1ECDD] overflow-hidden">
          <div class="h-full rounded-full" style={{ width: score + '%', background: barColor }} />
        </div>
        <span class="text-[12.5px] font-extrabold shrink-0 w-9 text-left" style={{ color: barColor }}>
          {toArabicDigits(score)}
        </span>
      </div>
    </div>
  );
}

function LogEntry({
  record,
  studentName,
  onEdit,
  onDelete,
}: {
  record: SessionRecord;
  studentName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const r = record;
  const lohArr = (r.newLoh ?? []).filter((l) => l?.sura);
  const madiArr = (r.newMadi ?? []).filter((m) => m?.sura);

  return (
    <div class="bg-white border border-hairline rounded-2xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="min-w-0">
          <div class="text-sm font-extrabold text-ink-dark truncate">{studentName}</div>
          {hijriShort(r.date) ? (
            <div class="mt-0.5 leading-tight">
              <div class="text-[11.5px] text-[#0F3D2E] font-semibold">{hijriShort(r.date)}</div>
              <div class="text-[10px] text-taupe">{formatDate(r.date)}</div>
            </div>
          ) : (
            <div class="text-[11.5px] text-taupe mt-0.5">{formatDate(r.date)}</div>
          )}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {!r.attendance_only && (
            <button
              class="w-[30px] h-[30px] rounded-[9px] border border-hairline bg-white flex items-center justify-center"
              aria-label="تعديل"
              onClick={onEdit}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#5B5646" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 4.5l5 5L8 21H3v-5z" />
              </svg>
            </button>
          )}
          <button
            class="w-[30px] h-[30px] rounded-[9px] border border-hairline bg-white flex items-center justify-center"
            aria-label="حذف"
            onClick={onDelete}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#B24A3A" stroke-width="1.8" stroke-linecap="round">
              <path d="M5 6.5h14M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M7 6.5l.8 12.7a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.7" />
            </svg>
          </button>
        </div>
      </div>

      {r.attendance_only ? (
        <div class="text-xs text-taupe">✅ حضور فقط</div>
      ) : (
        <>
          {hasScore(r.loh) && <ScoreBar label="تقييم اللوح" score={r.loh!.score!} barColor="#0F3D2E" />}
          {lohArr.length > 0 && <div class="text-[12px] text-[#5B5646]">📝 لوح جديد: {joinSuraNames(lohArr)}</div>}

          {hasScore(r.madi) && <ScoreBar label="تقييم الماضي" score={r.madi!.score!} barColor="#C9A227" />}
          {madiArr.length > 0 && <div class="text-[12px] text-[#5B5646]">🔄 ماضي جديد: {joinSuraNames(madiArr)}</div>}

          {r.tajweed?.sura && (
            <div class="text-[12px] text-[#5B5646] flex items-center gap-1.5 flex-wrap">
              <span>
                📐 تجويد: {r.tajweed.sura}
                {ayahRange(r.tajweed.from, r.tajweed.to)}
              </span>
              <PlainStars count={r.tajweed.stars ?? 0} />
              {r.tajweed.note && <span>· {r.tajweed.note}</span>}
            </div>
          )}

          {r.note && (
            <div class="text-[12.5px] text-taupe italic pt-2.5 border-t border-dashed border-hairline">💬 {r.note}</div>
          )}
        </>
      )}
    </div>
  );
}

interface LogScreenProps {
  /** Hands a session up to the record screen for editing. */
  onEditRecord?: (record: SessionRecord) => void;
}

export function LogScreen({ onEditRecord }: LogScreenProps = {}) {
  const { records, loaded, loadMore, loadingMore, hasMore } = useRecentRecords(MOSQUE_ID, HALAQA_ID);
  const { students } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { pendingIds, requestDelete } = useUndoableDelete();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');

  const isSearching = query.trim().length > 0;
  // When searching, results come from Firestore (every matching student's full
  // history), not just the paginated slice already in memory.
  const search = useRecordSearch(MOSQUE_ID, HALAQA_ID, query, students);

  const visibleRecords = useMemo(() => {
    const source = isSearching ? search.results : records;
    return source.filter((r) => !pendingIds.has(r.id));
  }, [isSearching, search.results, records, pendingIds]);

  // Skeleton shows for the initial paginated load, or while a search resolves.
  const showSkeleton = isSearching ? search.searching : !loaded;
  // "No results" only after the relevant load has actually finished.
  const showEmpty = isSearching ? search.resolved && visibleRecords.length === 0 : loaded && visibleRecords.length === 0;

  function handleDelete(r: SessionRecord) {
    const name = displayStudentName(r, students);
    const label = r.attendance_only ? `حضور ${name}` : `جلسة ${name}`;
    if (!confirm(`حذف \"${label}\"؟`)) return;
    requestDelete(r.id, `🗑 تم حذف ${label}`, async (id) => {
      await deleteRecordDoc(MOSQUE_ID, HALAQA_ID, id);
      // Refresh the parent projection now that this session is gone.
      if (r.studentId) void republishPublicStatsFor([r.studentId]);
    });
  }

  function handleEdit(r: SessionRecord) {
    if (onEditRecord) {
      onEditRecord(r);
    } else {
      // No handler wired (shouldn't happen in the app shell) — fail gracefully.
      showToast('تعذّر فتح شاشة التعديل');
    }
  }

  return (
    <div class="p-[18px] pb-[100px]" dir="rtl">
      <div class="text-[19px] font-extrabold text-ink-dark mb-4">السجل</div>

      <div class="relative mb-4">
        <input
          type="text"
          class="w-full border border-hairline rounded-xl px-3.5 py-3 pr-10 text-sm text-ink-dark bg-white"
          placeholder="ابحث باسم الطالب…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="#8A8372"
          stroke-width="2"
          class="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </div>

      {showSkeleton && (
        <div class="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} class="h-24 rounded-2xl bg-[#F1ECDD] animate-pulse" />
          ))}
        </div>
      )}

      {showEmpty && (
        <div class="text-center text-sm text-taupe py-8">
          {query ? `لا يوجد نتائج لـ "${esc(query)}"` : 'لا يوجد جلسات مسجلة بعد'}
        </div>
      )}

      <div class="space-y-3">
        {visibleRecords.map((r) => (
          <LogEntry
            key={r.id}
            record={r}
            studentName={displayStudentName(r, students)}
            onEdit={() => handleEdit(r)}
            onDelete={() => handleDelete(r)}
          />
        ))}
      </div>

      {loaded && hasMore && !isSearching && (
        <button
          class="w-full mt-3.5 py-3 rounded-xl border border-hairline bg-white text-sm font-semibold text-[#5B5646] disabled:opacity-60"
          disabled={loadingMore}
          onClick={loadMore}
        >
          {loadingMore ? 'جاري التحميل…' : 'تحميل المزيد'}
        </button>
      )}
    </div>
  );
}
