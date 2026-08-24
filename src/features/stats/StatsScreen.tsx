import { useMemo, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { useAllRecords } from '../../hooks/useAllRecords';
import { arabicPlural, esc, toArabicDigits, toArabicOrdinal } from '../../domain/text';
import {
  ATTENDANCE_BADGE_THRESHOLD,
  getAttendanceRanking,
  getPersonalAttendanceRanking,
} from '../../domain/attendance';
import {
  computeSummaryStats,
  computeWeeklyBuckets,
  computeScoreDistribution,
  computeTopPages,
  computeFollowUpList,
  computeStudentStatsRows,
  sortStudentStatsRows,
  countRecentlyActiveStudents,
  type StatsSortKey,
} from '../../domain/statsScreen';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import { buildAttendanceCardData, buildAttendanceCardSvg } from '../../domain/attendanceCard';
import { svgToPngBlob, shareOrDownloadPng } from './shareCard';
import { pagesLabel } from '../../domain/pages';
import { SearchInput } from '../../ui/SearchInput';

/** Tier badge colors ported from the mockup — same lookup reused across the
 * Record/Log/Stats screens so a score tier always looks the same everywhere. */
const TIER_COLORS: Record<string, { bg: string; color: string; bar: string }> = {
  ممتاز: { bg: '#E7F2EC', color: '#0F3D2E', bar: '#0F3D2E' },
  'جيد جداً': { bg: '#EFF6E8', color: '#3E6B22', bar: '#3E6B22' },
  جيد: { bg: '#FFF8E6', color: '#8A6A15', bar: '#C9A227' },
  مقبول: { bg: '#FBEEE3', color: '#9A5A24', bar: '#9A5A24' },
  إعادة: { bg: '#FBEAE7', color: '#B24A3A', bar: '#B24A3A' },
};

/** Rank-circle colors for the top-3 leaderboard spots, ported from the
 * mockup; ranks 4+ fall back to a neutral tint. */
const RANK_COLORS = [
  { bg: '#FFF3D6', color: '#8A6A15' },
  { bg: '#F1ECDD', color: '#5B5646' },
  { bg: '#FBEEE3', color: '#9A5A24' },
];
const RANK_FALLBACK = { bg: '#F5F1E5', color: '#8A8372' };
function rankStyle(rank: number) {
  return RANK_COLORS[rank - 1] ?? RANK_FALLBACK;
}

type AttendBasis = 'halaqa' | 'personal';

/** Row shape shared by both attendance bases; `days`/`ofDays` are the numerator
 * and denominator behind the percentage, whichever basis produced them. */
interface AttendRow {
  id: string;
  name: string;
  rank: number;
  attendPct: number;
  days: number;
  ofDays: number;
}

const ATTEND_BASIS_TABS: { key: AttendBasis; label: string }[] = [
  { key: 'halaqa', label: 'على مستوى الحلقة' },
  { key: 'personal', label: 'منذ انضمامه' },
];

function attendBarColor(pct: number): string {
  if (pct >= 80) return '#0F3D2E';
  if (pct >= 50) return '#C9A227';
  return '#B24A3A';
}

const SORT_TABS: { key: StatsSortKey; label: string }[] = [
  { key: 'attend', label: 'الحضور' },
  { key: 'ayat', label: 'الآيات' },
  { key: 'avg', label: 'التقييم' },
  { key: 'name', label: 'الاسم' },
];

/** Sessions are the secondary line under a leaderboard name, so they read as
 * prose and need the same Arabic count agreement the page total gets. */
const sessionsLabel = (n: number) =>
  arabicPlural(n, { one: 'جلسة واحدة', two: 'جلستين', few: 'جلسات', many: 'جلسة' });

const cardCls = 'bg-white border border-hairline rounded-2xl p-[18px]';
const cardTitleCls = 'text-[13.5px] font-extrabold text-ink-dark mb-3.5';

/** How many rows a leaderboard shows before عرض الكل is tapped. */
const PREVIEW_COUNT = 3;

/** Consecutive missed halaqa days before a student is flagged for follow-up. */
const ABSENCE_ALERT_STREAK = 2;

/** حلقة واحدة / حلقتين / ٣ حلقات / ١٢ حلقة */
const HALAQA_FORMS = {
  one: 'حلقة واحدة',
  two: 'حلقتين',
  few: 'حلقات',
  many: 'حلقة',
} as const;

/**
 * Expand/collapse control for a leaderboard. The visible label stays short for
 * a phone, while the accessible name carries the card it belongs to — without
 * that, every leaderboard on the screen would expose an identically-named
 * button to screen readers and tests.
 */
function ShowAllToggle({
  expanded,
  total,
  cardLabel,
  onToggle,
}: {
  expanded: boolean;
  total: number;
  cardLabel: string;
  onToggle: () => void;
}) {
  if (total <= PREVIEW_COUNT) return null;
  const text = expanded ? 'عرض أقل' : `عرض الكل (${toArabicDigits(total)})`;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${text} — ${cardLabel}`}
      aria-expanded={expanded}
      class="w-full mt-2.5 py-2 rounded-full text-xs font-bold text-forest border border-hairline"
    >
      {text}
    </button>
  );
}

export function StatsScreen() {
  const { students, loaded: studentsLoaded } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { records, loaded: recordsLoaded } = useAllRecords(MOSQUE_ID, HALAQA_ID);

  const [monthFilter, setMonthFilter] = useState('all');
  const [sortKey, setSortKey] = useState<StatsSortKey>('attend');
  const [search, setSearch] = useState('');
  const [cardOpen, setCardOpen] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [pagesExpanded, setPagesExpanded] = useState(false);
  const [attendExpanded, setAttendExpanded] = useState(false);
  const [attendBasis, setAttendBasis] = useState<AttendBasis>('halaqa');
  const [followUpExpanded, setFollowUpExpanded] = useState(false);

  const availableMonths = useMemo(() => {
    const months = new Set(records.map((r) => r.date?.slice(0, 7)).filter(Boolean) as string[]);
    return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (monthFilter === 'all') return records;
    return records.filter((r) => r.date?.slice(0, 7) === monthFilter);
  }, [records, monthFilter]);

  // Second argument is the UNFILTERED set: an assignment given at the end of
  // the selected month is graded in the next one, and that verdict still has
  // to count against it.
  const summary = useMemo(
    () => computeSummaryStats(filteredRecords, records),
    [filteredRecords, records],
  );
  // Recency is about real-world activity, not the selected month view, so this
  // always reads from the full (unfiltered) records regardless of monthFilter.
  const recentlyActive = useMemo(
    () => countRecentlyActiveStudents(students, records, 30),
    [students, records],
  );
  const weeklyBuckets = useMemo(() => computeWeeklyBuckets(filteredRecords), [filteredRecords]);
  const scoreDist = useMemo(() => computeScoreDistribution(filteredRecords), [filteredRecords]);
  // Unfiltered records on purpose: a page is cumulative, so which pages are
  // complete is settled over the whole history and only then narrowed to the
  // month the finishing session fell in (computeTopPages does the narrowing).
  // Full ranked lists, sliced at render time. The leaderboards are a preview
  // by default and expand in place — with ~50 students, showing everything up
  // front would bury تفصيل الطلاب under four long lists.
  const topPages = useMemo(
    () => computeTopPages(students, records, Infinity, monthFilter),
    [students, records, monthFilter],
  );
  // No minPct filter: students below the نجم الحضور line are the ones a
  // teacher most needs to see. The threshold survives as a visual marker in
  // the expanded list instead of as a filter that hides them.
  const topAttend = useMemo(
    () => getAttendanceRanking(students, filteredRecords).list,
    [students, filteredRecords],
  );
  // Second argument is the window, third is the FULL history — the join date
  // has to come from outside the selected month or every veteran restarts at
  // his first day in it and scores a free 100%.
  const topAttendPersonal = useMemo(
    () => getPersonalAttendanceRanking(students, filteredRecords, records).list,
    [students, filteredRecords, records],
  );
  /** Both rankings flattened to one row shape so the card renders once. */
  const attendRows = useMemo<AttendRow[]>(
    () =>
      attendBasis === 'halaqa'
        ? topAttend.map((x) => ({
            id: x.id,
            name: x.name,
            rank: x.rank,
            attendPct: x.attendPct,
            days: x.uniqueDays,
            ofDays: summary.totalHalaqaDays,
          }))
        : topAttendPersonal.map((x) => ({
            id: x.id,
            name: x.name,
            rank: x.rank,
            attendPct: x.attendPct,
            days: x.attendedDays,
            ofDays: x.enrolledDays,
          })),
    [attendBasis, topAttend, topAttendPersonal, summary.totalHalaqaDays],
  );
  const studentRows = useMemo(
    () => computeStudentStatsRows(students, filteredRecords, summary.totalHalaqaDays),
    [students, filteredRecords, summary.totalHalaqaDays],
  );
  const visibleRows = useMemo(() => {
    const q = search.trim();
    const filtered = q ? studentRows.filter((r) => r.name.includes(q)) : studentRows;
    return sortStudentStatsRows(filtered, sortKey);
  }, [studentRows, search, sortKey]);

  const followUp = useMemo(
    () => computeFollowUpList(students, filteredRecords, ABSENCE_ALERT_STREAK),
    [students, filteredRecords],
  );
  const visibleFollowUp = followUpExpanded ? followUp : followUp.slice(0, PREVIEW_COUNT);

  const visiblePages = pagesExpanded ? topPages : topPages.slice(0, PREVIEW_COUNT);
  const visibleAttend = attendExpanded ? attendRows : attendRows.slice(0, PREVIEW_COUNT);
  /** Index of the first student under the نجم الحضور line, or -1. Only ever
   * reached in the expanded list, since the preview is the top of the table. */
  const firstBelowThreshold = visibleAttend.findIndex(
    (x) => x.attendPct < ATTENDANCE_BADGE_THRESHOLD,
  );

  // Share of the currently active roster that turns up on a typical halaqa
  // day. Denominator is the recently-active count, not every registered
  // student, so students who stopped coming months ago don't permanently
  // depress the figure. `null` when nobody is active — a percentage of zero
  // students says nothing, so the card shows the raw average alone.
  const dailyAttendancePct =
    recentlyActive > 0
      ? Math.min(100, Math.round((summary.avgDailyAttendance / recentlyActive) * 100))
      : null;

  const maxWeekly = Math.max(1, ...weeklyBuckets.map((w) => w.count));
  const busiestWeekIdx = weeklyBuckets.reduce(
    (best, w, i) => (w.count > (weeklyBuckets[best]?.count ?? -1) ? i : best),
    0,
  );
  const cardData = useMemo(
    () => buildAttendanceCardData(students, filteredRecords),
    [students, filteredRecords],
  );
  const cardSvg = useMemo(() => buildAttendanceCardSvg(cardData), [cardData]);

  async function handleShareCard() {
    setCardBusy(true);
    try {
      const png = await svgToPngBlob(cardSvg, 1080, 1350);
      await shareOrDownloadPng(png, 'نجوم-الحضور.png');
    } catch (err) {
      console.error('share card failed:', err);
    } finally {
      setCardBusy(false);
    }
  }

  const loaded = studentsLoaded && recordsLoaded;

  if (!loaded) {
    return (
      <div class="p-[18px] space-y-3" dir="rtl">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} class="h-20 rounded-2xl bg-[#F1ECDD] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div class="p-[18px] pb-[100px] space-y-3.5" dir="rtl">
      <div class="text-[19px] font-extrabold text-ink-dark mb-1">إحصائيات</div>

      <div class="relative">
        <select
          class="w-full appearance-none border border-hairline rounded-xl px-4 py-3 pl-10 text-sm font-semibold bg-white text-ink-dark"
          value={monthFilter}
          onChange={(e) => setMonthFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="all">كل الفترة</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-taupe text-[11px] pointer-events-none">
          ▾
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        {[
          { num: toArabicDigits(summary.totalSessions), lbl: 'جلسة مسجلة', color: '#0F3D2E' },
          { num: toArabicDigits(students.length), lbl: 'إجمالي الطلاب', color: '#C9A227' },
          {
            num: toArabicDigits(recentlyActive),
            lbl: 'طالب نشط (آخر شهر)',
            color: '#0F3D2E',
          },
          {
            num: toArabicDigits(Math.round(summary.avgDailyAttendance)),
            lbl: 'متوسط الحضور اليومي',
            color: '#C9A227',
            sub:
              dailyAttendancePct === null
                ? undefined
                : `${toArabicDigits(dailyAttendancePct)}٪ من النشطين`,
          },
          // The two averages sit side by side, and so do the two ayat counts —
          // an odd card count in a 2-column grid would strand one of them
          // alone on the last row, so the total spans the full width.
          { num: toArabicDigits(summary.avgLoh) + '٪', lbl: 'متوسط اللوح', color: '#0F3D2E' },
          { num: toArabicDigits(summary.avgMadi) + '٪', lbl: 'متوسط الماضي', color: '#C9A227' },
          { num: toArabicDigits(summary.lohAyat), lbl: 'آيات لوح', color: '#0F3D2E' },
          { num: toArabicDigits(summary.madiAyat), lbl: 'آيات ماضي', color: '#C9A227' },
          {
            num: toArabicDigits(summary.totalAyat),
            lbl: 'إجمالي الآيات',
            color: '#0F3D2E',
            wide: true,
          },
        ].map((c) => (
          <div
            key={c.lbl}
            class={
              'bg-white border border-hairline rounded-2xl py-4 px-3 text-center' +
              (c.wide ? ' col-span-2' : '')
            }
          >
            <div class="text-[24px] font-black leading-none" style={{ color: c.color }}>
              {c.num}
            </div>
            <div class="text-[11px] text-taupe mt-1.5 font-semibold">{c.lbl}</div>
            {c.sub && <div class="text-[10px] text-taupe/70 mt-0.5 font-semibold">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div class={cardCls}>
        <div class={cardTitleCls}>📈 النشاط الأسبوعي</div>
        {weeklyBuckets.length === 0 ? (
          <div class="text-center text-sm text-taupe py-6">لا يوجد بيانات</div>
        ) : (
          <div class="flex items-end gap-2 h-24">
            {weeklyBuckets.map((w, i) => {
              const h = Math.max(6, Math.round((w.count / maxWeekly) * 100));
              const label = new Date(w.weekStart + 'T00:00:00').toLocaleDateString('ar-EG', {
                day: 'numeric',
                month: 'numeric',
              });
              return (
                <div
                  key={w.weekStart}
                  class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                >
                  <div class="text-[11px] text-[#5B5646] font-semibold">
                    {toArabicDigits(w.count)}
                  </div>
                  <div
                    class="w-full rounded-t-[6px]"
                    style={{
                      height: `${h}%`,
                      background: i === busiestWeekIdx ? '#C9A227' : '#0F3D2E',
                    }}
                  />
                  <div class="text-[10px] text-taupe font-semibold">{label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class={cardCls}>
        <div class={cardTitleCls}>🎯 توزيع مستويات التقييم</div>
        {scoreDist.every((d) => d.count === 0) ? (
          <div class="text-center text-sm text-taupe py-6">لا يوجد تقييمات مسجلة بعد</div>
        ) : (
          <div class="space-y-2.5">
            {scoreDist.map((d) => {
              const tc = TIER_COLORS[d.label] ?? { bar: '#8A8372' };
              return (
                <div key={d.label} class="flex items-center gap-2.5">
                  <div class="w-16 text-xs text-[#5B5646] font-semibold shrink-0">{d.label}</div>
                  <div class="flex-1 h-2 rounded-full bg-[#F1ECDD] overflow-hidden">
                    <div
                      class="h-full rounded-full"
                      style={{ width: `${d.pct}%`, background: tc.bar }}
                    />
                  </div>
                  <div class="w-6 text-xs text-taupe text-left shrink-0">
                    {toArabicDigits(d.count)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class={cardCls}>
        <div class={cardTitleCls}>🏆 الأكثر حفظاً للصفحات</div>
        {topPages.length === 0 ? (
          <div class="text-center text-sm text-taupe py-6">لا توجد صفحات مكتملة بعد</div>
        ) : (
          <div class="space-y-2">
            {visiblePages.map((x, i) => {
              const rc = rankStyle(i + 1);
              return (
                <div
                  key={x.id}
                  class="flex items-center gap-3 py-1.5 border-b border-[#F5F1E5] last:border-0"
                >
                  <div
                    class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                    style={{ background: rc.bg, color: rc.color }}
                  >
                    {toArabicDigits(i + 1)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-ink-dark truncate">{x.name}</div>
                    <div class="text-xs text-taupe">
                      {pagesLabel(x.pages)}، {sessionsLabel(x.sessionsCount)}
                      {x.startLabel && x.endLabel && (
                        <>
                          {' · '}
                          {x.startLabel} ← {x.endLabel}
                        </>
                      )}
                    </div>
                  </div>
                  <div class="font-extrabold text-[#C9A227] shrink-0">
                    {toArabicDigits(x.pages)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <ShowAllToggle
          expanded={pagesExpanded}
          total={topPages.length}
          cardLabel="الأكثر حفظاً للصفحات"
          onToggle={() => setPagesExpanded((v) => !v)}
        />
      </div>

      <div class={cardCls}>
        <div class={cardTitleCls}>✅ الأكثر حضوراً</div>
        <div class="flex gap-1.5 mb-3">
          {ATTEND_BASIS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={attendBasis === tab.key}
              class={
                'flex-1 py-1.5 rounded-full text-xs font-bold border ' +
                (attendBasis === tab.key
                  ? 'bg-forest text-parchment border-forest'
                  : 'border-hairline text-taupe')
              }
              onClick={() => setAttendBasis(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div class="text-[11px] text-taupe mb-2.5">
          {attendBasis === 'halaqa'
            ? 'النسبة من كل أيام الحلقة — مقياس واحد للجميع'
            : 'النسبة من أيام الحلقة بعد انضمام الطالب — زي صفحة ولي الأمر'}
        </div>
        {attendRows.length === 0 ? (
          <div class="text-center text-sm text-taupe py-6">لا يوجد بيانات</div>
        ) : (
          <div class="space-y-2">
            {visibleAttend.map((x, i) => {
              const rc = rankStyle(x.rank);
              const below = x.attendPct < ATTENDANCE_BADGE_THRESHOLD;
              return (
                <div key={x.id}>
                  {i === firstBelowThreshold && (
                    <div class="flex items-center gap-2 py-2">
                      <div class="flex-1 h-px bg-[#F1ECDD]" />
                      <div class="text-[10px] font-bold text-taupe">
                        أقل من {toArabicDigits(ATTENDANCE_BADGE_THRESHOLD)}٪
                      </div>
                      <div class="flex-1 h-px bg-[#F1ECDD]" />
                    </div>
                  )}
                  <div class="flex items-center gap-3 py-1.5 border-b border-[#F5F1E5] last:border-0">
                    <div
                      class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                      style={{ background: rc.bg, color: rc.color }}
                      title={`المركز ${toArabicOrdinal(x.rank)}`}
                    >
                      {toArabicDigits(x.rank)}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div
                        class={
                          'text-sm font-bold truncate ' +
                          (below ? 'text-[#5B5646]' : 'text-ink-dark')
                        }
                      >
                        {x.name}
                      </div>
                      <div class="text-xs text-taupe">
                        المركز {toArabicOrdinal(x.rank)} · {toArabicDigits(x.days)} يوم حضور من{' '}
                        {toArabicDigits(x.ofDays)}
                      </div>
                    </div>
                    <div
                      class="font-extrabold shrink-0"
                      style={{ color: attendBarColor(x.attendPct) }}
                    >
                      {toArabicDigits(x.attendPct)}٪
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <ShowAllToggle
          expanded={attendExpanded}
          total={attendRows.length}
          cardLabel="الأكثر حضوراً"
          onToggle={() => setAttendExpanded((v) => !v)}
        />
      </div>

      <div class={cardCls}>
        <div class={cardTitleCls}>⚠️ يحتاجون متابعة</div>
        {followUp.length === 0 ? (
          <div class="text-xs text-taupe text-center py-3">
            كل الطلاب حضروا آخر {arabicPlural(ABSENCE_ALERT_STREAK, HALAQA_FORMS)} — ما شاء الله
          </div>
        ) : (
          <div class="space-y-2">
            {visibleFollowUp.map((x) => (
              <div
                key={x.id}
                class="flex items-center gap-3 py-1.5 border-b border-[#F5F1E5] last:border-0"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-bold text-ink-dark truncate">{x.name}</div>
                  <div class="text-xs text-taupe">
                    {x.neverAttended
                      ? 'لم يحضر ولا مرة'
                      : `غاب آخر ${arabicPlural(x.absenceStreak, HALAQA_FORMS)} · آخر حضور ${x.lastAttended}`}
                  </div>
                </div>
                <div
                  class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                  style={{ background: '#FBEAEA', color: '#B3261E' }}
                  title={`${toArabicDigits(x.absenceStreak)} حلقة متتالية`}
                >
                  {toArabicDigits(x.absenceStreak)}
                </div>
              </div>
            ))}
          </div>
        )}
        <ShowAllToggle
          expanded={followUpExpanded}
          total={followUp.length}
          cardLabel="يحتاجون متابعة"
          onToggle={() => setFollowUpExpanded((v) => !v)}
        />
      </div>

      <button
        type="button"
        onClick={() => setCardOpen(true)}
        disabled={cardData.count === 0}
        class="w-full rounded-2xl p-4 font-extrabold text-parchment shadow-[0_8px_20px_rgba(15,61,46,0.28)] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'linear-gradient(165deg, #0F3D2E, #0A2E22)' }}
      >
        🌟 بطاقة نجوم الحضور — للمشاركة
      </button>

      <div class={cardCls}>
        <div class={cardTitleCls}>تفصيل الطلاب</div>
        <SearchInput
          compact
          class="mb-3"
          value={search}
          onChange={setSearch}
          placeholder="ابحث عن طالب…"
          label="ابحث عن طالب في تفصيل الطلاب"
        />
        <div class="flex gap-1.5 mb-3.5">
          {SORT_TABS.map((tab) => (
            <button
              key={tab.key}
              class={
                'flex-1 py-1.5 rounded-full text-xs font-bold border ' +
                (sortKey === tab.key
                  ? 'bg-forest text-parchment border-forest'
                  : 'border-hairline text-taupe')
              }
              onClick={() => setSortKey(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <div class="text-center text-sm text-taupe py-6">
            {search ? `لا يوجد نتائج لـ "${esc(search)}"` : 'لا يوجد بيانات مطابقة'}
          </div>
        ) : (
          <div class="divide-y divide-[#F5F1E5]">
            {visibleRows.map((row) => (
              <div key={row.id} class="py-3">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="text-sm font-bold text-ink-dark">{row.name}</div>
                  <div
                    class="text-sm font-extrabold"
                    style={{ color: attendBarColor(row.attendPct) }}
                  >
                    {toArabicDigits(row.attendPct)}٪
                  </div>
                </div>
                <div class="h-1.5 rounded-full bg-[#F1ECDD] overflow-hidden mb-1.5">
                  <div
                    class="h-full rounded-full"
                    style={{
                      width: `${row.attendPct}%`,
                      background: attendBarColor(row.attendPct),
                    }}
                  />
                </div>
                <div class="text-[11px] text-taupe">
                  {toArabicDigits(row.sessionsCount)} جلسة · {toArabicDigits(row.ayat)} آية ·{' '}
                  {row.avg === null ? 'لم يُقيَّم' : `متوسط ${toArabicDigits(row.avg)}٪`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cardOpen && (
        <div
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setCardOpen(false)}
        >
          <div
            class="w-full max-w-sm bg-white rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="font-extrabold text-ink-dark">بطاقة نجوم الحضور</div>
            <div
              class="rounded-xl overflow-hidden border border-hairline"
              dangerouslySetInnerHTML={{ __html: cardSvg }}
            />
            <div class="flex gap-2">
              <button
                type="button"
                onClick={handleShareCard}
                disabled={cardBusy}
                class="flex-1 py-2.5 rounded-xl bg-forest text-parchment font-bold text-sm disabled:opacity-50"
              >
                {cardBusy ? '⏳ جارٍ التحضير…' : '📤 مشاركة / تحميل'}
              </button>
              <button
                type="button"
                onClick={() => setCardOpen(false)}
                class="py-2.5 px-4 rounded-xl bg-[#F1ECDD] text-[#5B5646] font-bold text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
