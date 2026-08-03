import { useMemo, useState } from 'preact/hooks';
import { useRecentRecords } from '../../hooks/useRecentRecords';
import { useRecordSearch } from '../../hooks/useRecordSearch';
import { useStudents } from '../../hooks/useStudents';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { deleteRecord as deleteRecordDoc, saveRecord } from '../../data/records.repo';
import { republishPublicStatsFor } from '../../data/publishStats';
import { displayStudentName } from '../../domain/students';
import { hasScore, scoreName } from '../../domain/scoring';
import { sessionGrading } from '../../domain/record';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { SearchInput } from '../../ui/SearchInput';
import { ayahRange, joinSuraNames } from '../../domain/suras';
import { hijriShort } from '../../domain/hijri';
import { groupRecordsByDay, matchesLogFilter } from '../../domain/logGrouping';
import type { LogFilter } from '../../domain/logGrouping';
import { toArabicDigits } from '../../domain/text';
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
  ممتاز: { bg: '#E7F2EC', color: '#0F3D2E' },
  'جيد جداً': { bg: '#EFF6E8', color: '#3E6B22' },
  جيد: { bg: '#FFF8E6', color: '#8A6A15' },
  مقبول: { bg: '#FBEEE3', color: '#9A5A24' },
  إعادة: { bg: '#FBEAE7', color: '#B24A3A' },
};

function ScoreBar({ label, score, barColor }: { label: string; score: number; barColor: string }) {
  const tier = scoreName(score);
  const tc = TIER_COLORS[tier] ?? { bg: '#F1ECDD', color: '#5B5646' };
  return (
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[11.5px] text-taupe font-semibold">{label}</span>
        <span
          class="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: tc.bg, color: tc.color }}
        >
          {tier}
        </span>
      </div>
      <div class="flex items-center gap-2.5">
        <div class="flex-1 h-1.5 rounded-full bg-[#F1ECDD] overflow-hidden">
          <div class="h-full rounded-full" style={{ width: score + '%', background: barColor }} />
        </div>
        <span
          class="text-[12.5px] font-extrabold shrink-0 w-9 text-left"
          style={{ color: barColor }}
        >
          {toArabicDigits(score)}
        </span>
      </div>
    </div>
  );
}

const FILTER_TABS: { id: LogFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'repeat', label: 'إعادة' },
  { id: 'attendance', label: 'حضور فقط' },
  { id: 'tajweed', label: 'فيها تجويد' },
];

/** Weekday + Gregorian date, e.g. "الأحد ٢٥ يوليو". The weekday is what the
 * teacher actually navigates by — the halaqa meets on fixed days. */
function formatDayHeading(dateStr: string): string {
  if (!dateStr) return 'بدون تاريخ';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Sticky separator between halaqa days.
 *
 * ~50 students means one day fills more than the log's 40-record page, so a
 * flat list gave no clue where one halaqa ended and the previous began. The
 * count answers the question the teacher actually has at a glance — how many
 * were recorded that day — and staying stuck to the top keeps the answer
 * visible while scrolling through the day's cards.
 */
function DayHeading({ date, count }: { date: string; count: number }) {
  const hijri = date ? hijriShort(date) : '';
  return (
    <div class="sticky top-0 z-10 -mx-[18px] px-[18px] py-2 bg-parchment/95 backdrop-blur-sm mb-2.5">
      <div class="flex items-baseline justify-between gap-2">
        <div class="min-w-0">
          <span class="text-[13px] font-extrabold text-ink-dark">{formatDayHeading(date)}</span>
          {hijri && <span class="text-[11px] text-[#0F3D2E] font-semibold mr-2">{hijri}</span>}
        </div>
        <span class="shrink-0 text-[11px] font-bold text-[#8A6A15] bg-[#FFF8E6] px-2.5 py-0.5 rounded-full">
          {toArabicDigits(count)} جلسة
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
        {/* No date here: the sticky day heading above the block already
            carries it, and repeating it on all ~50 of a day's cards was pure
            noise competing with the student's name. */}
        <div class="min-w-0">
          <div class="text-sm font-extrabold text-ink-dark truncate">{studentName}</div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {!r.attendance_only && (
            <button
              class="w-[30px] h-[30px] rounded-[9px] border border-hairline bg-white flex items-center justify-center"
              aria-label="تعديل"
              onClick={onEdit}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="#5B5646"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M14.5 4.5l5 5L8 21H3v-5z" />
              </svg>
            </button>
          )}
          <button
            class="w-[30px] h-[30px] rounded-[9px] border border-hairline bg-white flex items-center justify-center"
            aria-label="حذف"
            onClick={onDelete}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="#B24A3A"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <path d="M5 6.5h14M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M7 6.5l.8 12.7a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.7" />
            </svg>
          </button>
        </div>
      </div>

      {r.attendance_only ? (
        <div class="text-xs text-taupe">✅ حضور فقط</div>
      ) : (
        <>
          {hasScore(r.loh) && (
            <ScoreBar label="تقييم اللوح" score={r.loh!.score!} barColor="#0F3D2E" />
          )}
          {lohArr.length > 0 && (
            <div class="text-[12px] text-[#5B5646]">📝 لوح جديد: {joinSuraNames(lohArr)}</div>
          )}

          {hasScore(r.madi) && (
            <ScoreBar label="تقييم الماضي" score={r.madi!.score!} barColor="#C9A227" />
          )}
          {madiArr.length > 0 && (
            <div class="text-[12px] text-[#5B5646]">🔄 ماضي جديد: {joinSuraNames(madiArr)}</div>
          )}

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
            <div class="text-[12.5px] text-taupe italic pt-2.5 border-t border-dashed border-hairline">
              💬 {r.note}
            </div>
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
  const { records, loaded, loadMore, loadingMore, hasMore } = useRecentRecords(
    MOSQUE_ID,
    HALAQA_ID,
  );
  const { students } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { pendingIds, requestDelete } = useUndoableDelete();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');

  const isSearching = query.trim().length > 0;
  // When searching, results come from Firestore (every matching student's full
  // history), not just the paginated slice already in memory.
  const search = useRecordSearch(MOSQUE_ID, HALAQA_ID, query, students);

  const [filter, setFilter] = useState<LogFilter>('all');

  const visibleRecords = useMemo(() => {
    const source = isSearching ? search.results : records;
    return source.filter((r) => !pendingIds.has(r.id) && matchesLogFilter(r, filter));
  }, [isSearching, search.results, records, pendingIds, filter]);

  const days = useMemo(() => groupRecordsByDay(visibleRecords), [visibleRecords]);

  // Skeleton shows for the initial paginated load, or while a search resolves.
  const showSkeleton = isSearching ? search.searching : !loaded;
  // "No results" only after the relevant load has actually finished.
  const showEmpty = isSearching
    ? search.resolved && visibleRecords.length === 0
    : loaded && visibleRecords.length === 0;

  /** Session queued for deletion, waiting on the confirmation dialog. */
  const [pendingDelete, setPendingDelete] = useState<SessionRecord | null>(null);

  function deleteLabel(r: SessionRecord) {
    const name = displayStudentName(r, students);
    return r.attendance_only ? `حضور ${name}` : `جلسة ${name}`;
  }

  function confirmDelete(r: SessionRecord) {
    const label = deleteLabel(r);
    requestDelete(
      r.id,
      `🗑 تم حذف ${label}`,
      async (id) => {
        await deleteRecordDoc(MOSQUE_ID, HALAQA_ID, id);
        // Refresh the parent projection now that this session is gone.
        if (r.studentId) void republishPublicStatsFor([r.studentId]);
      },
      async () => {
        // `r` is the full record as it was listed, so the restore is
        // byte-identical under the same id — the session slots back into the
        // chain exactly where it was.
        await saveRecord(MOSQUE_ID, HALAQA_ID, r);
        if (r.studentId) void republishPublicStatsFor([r.studentId]);
      },
    );
  }

  /** What the teacher stands to break, spelled out before they commit.
   *
   * A session's assignment is marked at the NEXT session. Deleting it leaves
   * that next session holding a score for work that no longer exists, and its
   * evaluation card then re-points at an older session — so the mark shows
   * against an assignment the child was never given. Saying which session is
   * affected, by date, is the difference between an informed delete and the
   * orphaned records this app has had to clean up before. */
  function deleteMessage(r: SessionRecord): string {
    // Search results hold a student's full history; the paginated list is
    // newest-first, so anything newer than `r` is already loaded either way.
    const source = isSearching ? search.results : records;
    const grader = sessionGrading(r, source);
    if (!grader) return 'مش هينفع ترجّعها غير من زرار التراجع.';
    return (
      `التكليف اللي في الجلسة دي متقيّم في جلسة ${formatDate(grader.date)}. ` +
      'لو مسحتها، التقييم ده هيفضل من غير التكليف بتاعه.'
    );
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

      <SearchInput
        class="mb-4"
        value={query}
        onChange={setQuery}
        placeholder="ابحث باسم الطالب…"
        label="ابحث في السجل باسم الطالب"
      />

      <div class="flex gap-1.5 mb-4 overflow-x-auto" role="tablist" aria-label="تصفية السجل">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            class={
              'shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border ' +
              (filter === tab.id
                ? 'bg-forest text-parchment border-forest'
                : 'bg-white text-[#5B5646] border-hairline')
            }
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
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
          {/* Say which of the two things came up empty — a filter that hides
              everything otherwise reads as "no sessions exist". */}
          {query
            ? `لا يوجد نتائج لـ "${query}"`
            : filter === 'all'
              ? 'لا يوجد جلسات مسجلة بعد'
              : `لا يوجد جلسات تحت "${FILTER_TABS.find((t) => t.id === filter)?.label}"`}
        </div>
      )}

      <div class="space-y-4">
        {days.map((day) => (
          <div key={day.date || 'undated'}>
            <DayHeading date={day.date} count={day.records.length} />
            <div class="space-y-3">
              {day.records.map((r) => (
                <LogEntry
                  key={r.id}
                  record={r}
                  studentName={displayStudentName(r, students)}
                  onEdit={() => handleEdit(r)}
                  onDelete={() => setPendingDelete(r)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title={`حذف ${deleteLabel(pendingDelete)}؟`}
          message={deleteMessage(pendingDelete)}
          confirmLabel="احذف"
          destructive
          onConfirm={() => {
            const r = pendingDelete;
            setPendingDelete(null);
            confirmDelete(r);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

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
