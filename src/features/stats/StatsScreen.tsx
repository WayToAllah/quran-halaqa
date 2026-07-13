import { useMemo, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { useAllRecords } from '../../hooks/useAllRecords';
import { esc, toArabicDigits } from '../../domain/text';
import { ATTENDANCE_BADGE_THRESHOLD, getAttendanceRanking } from '../../domain/attendance';
import {
  computeSummaryStats,
  computeWeeklyBuckets,
  computeScoreDistribution,
  computeTopAyat,
  computeStudentStatsRows,
  sortStudentStatsRows,
  type StatsSortKey,
} from '../../domain/statsScreen';
import { MOSQUE_ID, HALAQA_ID } from '../../config';
import { buildAttendanceCardData, buildAttendanceCardSvg } from '../../domain/attendanceCard';
import { svgToPngBlob, shareOrDownloadPng } from './shareCard';

/** Tier badge colors ported from the mockup — same lookup reused across the
 * Record/Log/Stats screens so a score tier always looks the same everywhere. */
const TIER_COLORS: Record<string, { bg: string; color: string; bar: string }> = {
  'ممتاز': { bg: '#E7F2EC', color: '#0F3D2E', bar: '#0F3D2E' },
  'جيد جداً': { bg: '#EFF6E8', color: '#3E6B22', bar: '#3E6B22' },
  'جيد': { bg: '#FFF8E6', color: '#8A6A15', bar: '#C9A227' },
  'مقبول': { bg: '#FBEEE3', color: '#9A5A24', bar: '#9A5A24' },
  'إعادة': { bg: '#FBEAE7', color: '#B24A3A', bar: '#B24A3A' },
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

const cardCls = 'bg-white border border-hairline rounded-2xl p-[18px]';
const cardTitleCls = 'text-[13.5px] font-extrabold text-ink-dark mb-3.5';

export function StatsScreen() {
  const { students, loaded: studentsLoaded } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { records, loaded: recordsLoaded } = useAllRecords(MOSQUE_ID, HALAQA_ID);

  const [monthFilter, setMonthFilter] = useState('all');
  const [sortKey, setSortKey] = useState<StatsSortKey>('attend');
  const [search, setSearch] = useState('');
  const [cardOpen, setCardOpen] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);

  const availableMonths = useMemo(() => {
    const months = new Set(records.map((r) => r.date?.slice(0, 7)).filter(Boolean) as string[]);
    return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (monthFilter === 'all') return records;
    return records.filter((r) => r.date?.slice(0, 7) === monthFilter);
  }, [records, monthFilter]);

  const summary = useMemo(() => computeSummaryStats(filteredRecords), [filteredRecords]);
  const weeklyBuckets = useMemo(() => computeWeeklyBuckets(filteredRecords), [filteredRecords]);
  const scoreDist = useMemo(() => computeScoreDistribution(filteredRecords), [filteredRecords]);
  const topAyat = useMemo(() => computeTopAyat(students, filteredRecords, 3), [students, filteredRecords]);
  const topAttend = useMemo(
    () => getAttendanceRanking(students, filteredRecords, ATTENDANCE_BADGE_THRESHOLD).list,
    [students, filteredRecords],
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

  const maxWeekly = Math.max(1, ...weeklyBuckets.map((w) => w.count));
  const busiestWeekIdx = weeklyBuckets.reduce(
    (best, w, i) => (w.count > (weeklyBuckets[best]?.count ?? -1) ? i : best),
    0,
  );
  const cardData = useMemo(() => buildAttendanceCardData(students, filteredRecords), [students, filteredRecords]);
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
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-taupe text-[11px] pointer-events-none">▾</span>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        {[
          { num: toArabicDigits(summary.totalSessions), lbl: 'جلسة مسجلة', color: '#0F3D2E' },
          { num: toArabicDigits(summary.activeStudents), lbl: 'طالب نشط', color: '#C9A227' },
          { num: toArabicDigits(summary.totalAyat), lbl: 'إجمالي الآيات', color: '#0F3D2E' },
          { num: toArabicDigits(summary.avgLoh) + '٪', lbl: 'متوسط اللوح', color: '#C9A227' },
          { num: toArabicDigits(summary.lohAyat), lbl: 'آيات لوح', color: '#0F3D2E' },
          { num: toArabicDigits(summary.madiAyat), lbl: 'آيات ماضي', color: '#C9A227' },
        ].map((c) => (
          <div key={c.lbl} class="bg-white border border-hairline rounded-2xl py-4 px-3 text-center">
            <div class="text-[24px] font-black leading-none" style={{ color: c.color }}>
              {c.num}
            </div>
            <div class="text-[11px] text-taupe mt-1.5 font-semibold">{c.lbl}</div>
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
                <div key={w.weekStart} class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div class="text-[11px] text-[#5B5646] font-semibold">{toArabicDigits(w.count)}</div>
                  <div
                    class="w-full rounded-t-[6px]"
                    style={{ height: `${h}%`, background: i === busiestWeekIdx ? '#C9A227' : '#0F3D2E' }}
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
                    <div class="h-full rounded-full" style={{ width: `${d.pct}%`, background: tc.bar }} />
                  </div>
                  <div class="w-6 text-xs text-taupe text-left shrink-0">{toArabicDigits(d.count)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class={cardCls}>
        <div class={cardTitleCls}>🏆 الأكثر تسميعاً للآيات</div>
        {topAyat.length === 0 ? (
          <div class="text-center text-sm text-taupe py-6">لا يوجد بيانات</div>
        ) : (
          <div class="space-y-2">
            {topAyat.map((x, i) => {
              const rc = rankStyle(i + 1);
              return (
                <div key={x.name} class="flex items-center gap-3 py-1.5 border-b border-[#F5F1E5] last:border-0">
                  <div
                    class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                    style={{ background: rc.bg, color: rc.color }}
                  >
                    {toArabicDigits(i + 1)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-ink-dark truncate">{x.name}</div>
                    <div class="text-xs text-taupe">
                      {toArabicDigits(x.ayat)} آية مسمّعة · {toArabicDigits(x.sessionsCount)} جلسة
                    </div>
                  </div>
                  <div class="font-extrabold text-[#C9A227] shrink-0">{toArabicDigits(x.ayat)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class={cardCls}>
        <div class={cardTitleCls}>✅ الأكثر حضوراً</div>
        {topAttend.length === 0 ? (
          <div class="text-center text-sm text-taupe py-6">لا يوجد بيانات</div>
        ) : (
          <div class="space-y-2">
            {topAttend.map((x) => {
              const rc = rankStyle(x.rank);
              return (
                <div key={x.name} class="flex items-center gap-3 py-1.5 border-b border-[#F5F1E5] last:border-0">
                  <div
                    class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                    style={{ background: rc.bg, color: rc.color }}
                    title={`المركز ${x.rank}`}
                  >
                    {toArabicDigits(x.rank)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-ink-dark truncate">{x.name}</div>
                    <div class="text-xs text-taupe">
                      المركز {toArabicDigits(x.rank)} · {toArabicDigits(x.uniqueDays)} يوم حضور من{' '}
                      {toArabicDigits(summary.totalHalaqaDays)}
                    </div>
                  </div>
                  <div class="font-extrabold text-forest shrink-0">{toArabicDigits(x.attendPct)}٪</div>
                </div>
              );
            })}
          </div>
        )}
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
        <div class="relative mb-3">
          <input
            type="text"
            class="w-full border border-hairline rounded-xl px-3.5 py-2.5 pr-9 text-sm text-ink-dark"
            placeholder="ابحث عن طالب…"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="#8A8372"
            stroke-width="2"
            class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </div>
        <div class="flex gap-1.5 mb-3.5">
          {SORT_TABS.map((tab) => (
            <button
              key={tab.key}
              class={
                'flex-1 py-1.5 rounded-full text-xs font-bold border ' +
                (sortKey === tab.key ? 'bg-forest text-parchment border-forest' : 'border-hairline text-taupe')
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
              <div key={row.name} class="py-3">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="text-sm font-bold text-ink-dark">{row.name}</div>
                  <div class="text-sm font-extrabold" style={{ color: attendBarColor(row.attendPct) }}>
                    {toArabicDigits(row.attendPct)}٪
                  </div>
                </div>
                <div class="h-1.5 rounded-full bg-[#F1ECDD] overflow-hidden mb-1.5">
                  <div
                    class="h-full rounded-full"
                    style={{ width: `${row.attendPct}%`, background: attendBarColor(row.attendPct) }}
                  />
                </div>
                <div class="text-[11px] text-taupe">
                  {toArabicDigits(row.sessionsCount)} جلسة · {toArabicDigits(row.ayat)} آية · متوسط{' '}
                  {toArabicDigits(row.avg)}٪
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
          <div class="w-full max-w-sm bg-white rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
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
