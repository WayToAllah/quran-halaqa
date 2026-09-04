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
import { groupRecordsByDay, matchesLogFilter, markedAssignments } from '../../domain/logGrouping';
import type { LogFilter } from '../../domain/logGrouping';
import { toArabicDigits } from '../../domain/text';
import { PlainStars } from '../../ui/StarRating';
import { useToast } from '../../ui/ToastProvider';
import { useTenant } from '../tenant/TenantContext';
import type { SessionRecord, SuraAssignment } from '../../types';

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
/**
 * One mark on one line: what was recited, how it went, out of a hundred.
 *
 * The bar used to sit under a label row of its own, costing two rows per mark
 * — four rows before a card said anything about suras. Putting the sura, the
 * bar and the number on a single line keeps the bar's at-a-glance comparison
 * while giving the number something to be about: "لوح ٩٠" alone is a score
 * with nothing attached to it.
 *
 * The bar is a fixed width rather than flexible so the bars down a day's cards
 * line up and can be read against each other; the sura takes the slack and
 * truncates, since its start is the part that identifies it. 96px was measured
 * against the longest realistic label ("ماضي: آل عمران (١٢٠–١٥٠)") at 430px
 * wide — it still fits uncut, so the width goes to the bar, which needs the
 * length to be worth reading at all.
 */
function ScoreRow({
  label,
  score,
  suras,
  barColor,
}: {
  label: string;
  score: number;
  suras: SuraAssignment[];
  barColor: string;
}) {
  const tier = scoreName(score);
  const what = suras.length > 0 ? `${label}: ${joinSuraNames(suras)}` : label;
  return (
    <div class="flex items-center gap-2">
      <span class="text-[11.5px] text-[#5B5646] truncate min-w-0 flex-1" title={what}>
        {what}
      </span>
      <div
        class="w-24 h-1.5 rounded-full bg-[#F1ECDD] overflow-hidden shrink-0"
        role="img"
        aria-label={`${tier} — ${toArabicDigits(score)} من ١٠٠`}
      >
        <div class="h-full rounded-full" style={{ width: score + '%', background: barColor }} />
      </div>
      <span class="text-[12.5px] font-extrabold shrink-0 w-7 text-left" style={{ color: barColor }}>
        {toArabicDigits(score)}
      </span>
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
    <div class="sticky top-0 z-10 -mx-[18px] px-[18px] py-2 bg-parchment/95 backdrop-blur-sm mb-2">
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
  marked,
  onEdit,
  onDelete,
}: {
  record: SessionRecord;
  studentName: string;
  /** The assignment this session's marks were given for — it lives on the
   * PREVIOUS session, so the screen resolves it and passes it down. */
  marked?: { loh: SuraAssignment[]; madi: SuraAssignment[] };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const r = record;
  const lohArr = (r.newLoh ?? []).filter((l) => l?.sura);
  const madiArr = (r.newMadi ?? []).filter((m) => m?.sura);

  // One line per fact: who, each mark with what it was for, then what was
  // handed out for next time. Marks come from the PREVIOUS session's
  // assignment (passed in), the "جديد" line from this one's.
  const assignments: string[] = [];
  if (lohArr.length > 0) assignments.push(`لوح: ${joinSuraNames(lohArr)}`);
  if (madiArr.length > 0) assignments.push(`ماضي: ${joinSuraNames(madiArr)}`);

  return (
    <div class="bg-white border border-hairline rounded-xl px-3 py-2.5 space-y-1.5">
      <div class="flex items-center gap-2">
        <div class="text-[13px] font-extrabold text-ink-dark truncate min-w-0 flex-1">
          {studentName}
        </div>
        {r.attendance_only && (
          <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E7F2EC] text-[#0F3D2E] shrink-0">
            حضور فقط
          </span>
        )}
        <div class="flex items-center gap-1 shrink-0">
          {!r.attendance_only && (
            <button
              class="w-9 h-9 rounded-[10px] flex items-center justify-center"
              aria-label={`تعديل ${studentName}`}
              onClick={onEdit}
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
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
            class="w-9 h-9 rounded-[10px] flex items-center justify-center"
            aria-label={`حذف ${studentName}`}
            onClick={onDelete}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
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

      {hasScore(r.loh) && (
        <ScoreRow label="لوح" score={r.loh!.score!} suras={marked?.loh ?? []} barColor="#0F3D2E" />
      )}
      {hasScore(r.madi) && (
        <ScoreRow
          label="ماضي"
          score={r.madi!.score!}
          suras={marked?.madi ?? []}
          barColor="#C9A227"
        />
      )}

      {assignments.length > 0 && (
        <div class="text-[12px] text-[#5B5646] leading-snug">
          <span class="text-taupe">جديد — </span>
          {assignments.join(' · ')}
        </div>
      )}

      {r.tajweed?.sura && (
        <div class="text-[12px] text-[#5B5646] flex items-center gap-1.5 flex-wrap leading-snug">
          <span>
            تجويد: {r.tajweed.sura}
            {ayahRange(r.tajweed.from, r.tajweed.to)}
          </span>
          <PlainStars count={r.tajweed.stars ?? 0} />
          {r.tajweed.note && <span>· {r.tajweed.note}</span>}
        </div>
      )}

      {r.note && <div class="text-[12px] text-taupe italic leading-snug">💬 {r.note}</div>}
    </div>
  );
}

interface LogScreenProps {
  /** Hands a session up to the record screen for editing. */
  onEditRecord?: (record: SessionRecord) => void;
}

export function LogScreen({ onEditRecord }: LogScreenProps = {}) {
  const tenant = useTenant();
  const { mosqueId, halaqaId } = tenant;
  const { records, loaded, loadMore, loadingMore, hasMore } = useRecentRecords(mosqueId, halaqaId);
  const { students } = useStudents(mosqueId, halaqaId);
  const { pendingIds, requestDelete } = useUndoableDelete();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');

  const isSearching = query.trim().length > 0;
  // When searching, results come from Firestore (every matching student's full
  // history), not just the paginated slice already in memory.
  const search = useRecordSearch(mosqueId, halaqaId, query, students);

  const [filter, setFilter] = useState<LogFilter>('all');

  const visibleRecords = useMemo(() => {
    const source = isSearching ? search.results : records;
    return source.filter((r) => !pendingIds.has(r.id) && matchesLogFilter(r, filter));
  }, [isSearching, search.results, records, pendingIds, filter]);

  const days = useMemo(() => groupRecordsByDay(visibleRecords), [visibleRecords]);
  // Resolved over the FULL loaded list, not the filtered view: a filter that
  // hides the previous session must not blank out the sura behind a mark.
  const marks = useMemo(
    () => markedAssignments(isSearching ? search.results : records),
    [isSearching, search.results, records],
  );

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
        await deleteRecordDoc(mosqueId, halaqaId, id);
        // Refresh the parent projection now that this session is gone.
        if (r.studentId) void republishPublicStatsFor(tenant, [r.studentId]);
      },
      async () => {
        // `r` is the full record as it was listed, so the restore is
        // byte-identical under the same id — the session slots back into the
        // chain exactly where it was.
        await saveRecord(mosqueId, halaqaId, r);
        if (r.studentId) void republishPublicStatsFor(tenant, [r.studentId]);
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
                  marked={marks.get(r.id)}
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
