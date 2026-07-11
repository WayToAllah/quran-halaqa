import { useMemo, useState } from 'preact/hooks';
import { useRecentRecords } from '../../hooks/useRecentRecords';
import { useRecordSearch } from '../../hooks/useRecordSearch';
import { useStudents } from '../../hooks/useStudents';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { deleteRecord as deleteRecordDoc } from '../../data/records.repo';
import { republishPublicStatsFor } from '../../data/publishStats';
import { esc } from '../../domain/text';
import { displayStudentName } from '../../domain/students';
import { hasScore, scoreName } from '../../domain/scoring';
import { ayahRange, joinSuraNames } from '../../domain/suras';
import { StarRating, PlainStars } from '../../ui/StarRating';
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

  return (
    <div class="p-3 rounded-xl border border-neutral-100 space-y-1">
      <div class="flex items-center justify-between">
        <span class="font-semibold text-sm text-neutral-900">{studentName}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-neutral-400">{formatDate(r.date)}</span>
          {!r.attendance_only && (
            <button class="text-sm" aria-label="تعديل" onClick={onEdit}>
              ✏️
            </button>
          )}
          <button class="text-sm" aria-label="حذف" onClick={onDelete}>
            🗑
          </button>
        </div>
      </div>

      {r.attendance_only ? (
        <div class="text-xs text-neutral-400">✅ حضور فقط</div>
      ) : (
        <>
          {(() => {
            const lohArr = (r.newLoh ?? []).filter((l) => l?.sura);
            if (lohArr.length) return <div class="text-xs">📝 لوح جديد: {joinSuraNames(lohArr)}</div>;
            return null;
          })()}
          {hasScore(r.loh) && (
            <div class="text-xs flex items-center gap-1.5">
              <span>⭐ تقييم اللوح: {r.loh!.score}/100</span>
              <StarRating score={r.loh!.score!} />
              <span>{scoreName(r.loh!.score)}</span>
            </div>
          )}
          {(() => {
            const madiArr = (r.newMadi ?? []).filter((m) => m?.sura);
            if (madiArr.length) return <div class="text-xs">🔄 ماضي جديد: {joinSuraNames(madiArr)}</div>;
            return null;
          })()}
          {hasScore(r.madi) && (
            <div class="text-xs flex items-center gap-1.5">
              <span>⭐ تقييم الماضي: {r.madi!.score}/100</span>
              <StarRating score={r.madi!.score!} />
              <span>{scoreName(r.madi!.score)}</span>
            </div>
          )}
          {r.tajweed?.sura && (
            <div class="text-xs flex items-center gap-1.5">
              <span>
                📐 تجويد: {r.tajweed.sura}
                {ayahRange(r.tajweed.from, r.tajweed.to)}
              </span>
              <PlainStars count={r.tajweed.stars ?? 0} />
              {r.tajweed.note && <span>· {r.tajweed.note}</span>}
            </div>
          )}
          {r.note && <div class="text-xs text-neutral-400 italic">💬 {r.note}</div>}
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
    if (!confirm(`حذف "${label}"؟`)) return;
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
    <div class="p-4 space-y-4" dir="rtl">
      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <div class="font-bold text-neutral-900 mb-3">آخر الجلسات</div>
        <input
          type="text"
          class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm mb-3"
          placeholder="🔍 ابحث باسم الطالب..."
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />

        {showSkeleton && (
          <div class="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} class="h-16 rounded-lg bg-neutral-100 animate-pulse" />
            ))}
          </div>
        )}

        {showEmpty && (
          <div class="text-center text-sm text-neutral-400 py-8">
            {query ? `لا يوجد نتائج لـ "${esc(query)}"` : 'لا يوجد جلسات مسجلة بعد'}
          </div>
        )}

        <div class="space-y-2">
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
            class="w-full mt-3 py-2.5 rounded-lg border border-neutral-200 text-sm text-neutral-600 disabled:opacity-60"
            disabled={loadingMore}
            onClick={loadMore}
          >
            {loadingMore ? 'جاري التحميل…' : 'تحميل المزيد'}
          </button>
        )}
      </div>
    </div>
  );
}
