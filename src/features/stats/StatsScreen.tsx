import { useMemo, useState } from 'preact/hooks';
import { useStudents } from '../../hooks/useStudents';
import { useAllRecords } from '../../hooks/useAllRecords';
import { esc } from '../../domain/text';
import { ATTENDANCE_BADGE_THRESHOLD, getAttendanceRanking, rankBadgeEmoji } from '../../domain/attendance';
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

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_CLASS = ['text-amber-500', 'text-neutral-400', 'text-amber-700'];

const SCORE_COLORS: Record<string, string> = {
  'ممتاز': 'bg-emerald-600',
  'جيد جداً': 'bg-emerald-500',
  'جيد': 'bg-amber-500',
  'مقبول': 'bg-orange-500',
  'إعادة': 'bg-red-500',
};

function barColorClass(pct: number): string {
  if (pct >= 80) return 'bg-emerald-600 text-emerald-600';
  if (pct >= 50) return 'bg-amber-500 text-amber-500';
  return 'bg-red-500 text-red-500';
}

const SORT_TABS: { key: StatsSortKey; label: string }[] = [
  { key: 'attend', label: 'الحضور' },
  { key: 'ayat', label: 'الآيات' },
  { key: 'avg', label: 'التقييم' },
  { key: 'name', label: 'الاسم' },
];

export function StatsScreen() {
  const { students, loaded: studentsLoaded } = useStudents(MOSQUE_ID, HALAQA_ID);
  const { records, loaded: recordsLoaded } = useAllRecords(MOSQUE_ID, HALAQA_ID);

  const [monthFilter, setMonthFilter] = useState('all');
  const [sortKey, setSortKey] = useState<StatsSortKey>('attend');
  const [search, setSearch] = useState('');

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
  const loaded = studentsLoaded && recordsLoaded;

  if (!loaded) {
    return (
      <div class="p-4 space-y-3" dir="rtl">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} class="h-20 rounded-xl bg-neutral-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div class="p-4 space-y-4" dir="rtl">
      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <label class="text-xs font-semibold text-neutral-600 block mb-1">📅 الفترة</label>
        <select
          class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm bg-white"
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
      </div>

      <div class="grid grid-cols-3 gap-2">
        {[
          { icon: '📅', num: summary.totalSessions, lbl: 'جلسة مسجلة' },
          { icon: '👥', num: summary.activeStudents, lbl: 'طالب نشط' },
          { icon: '📖', num: summary.totalAyat.toLocaleString('ar-EG'), lbl: 'إجمالي الآيات' },
          { icon: '⭐', num: `${summary.avgLoh}%`, lbl: 'متوسط اللوح' },
          { icon: '📝', num: summary.lohAyat.toLocaleString('ar-EG'), lbl: 'آيات لوح' },
          { icon: '🔄', num: summary.madiAyat.toLocaleString('ar-EG'), lbl: 'آيات ماضي' },
        ].map((c) => (
          <div key={c.lbl} class="bg-white rounded-xl border border-neutral-200 p-3 text-center">
            <div class="text-xl mb-1">{c.icon}</div>
            <div class="font-bold text-neutral-900">{c.num}</div>
            <div class="text-[11px] text-neutral-400">{c.lbl}</div>
          </div>
        ))}
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <div class="font-bold text-neutral-900 mb-3">📈 النشاط الأسبوعي</div>
        {weeklyBuckets.length === 0 ? (
          <div class="text-center text-sm text-neutral-400 py-6">لا يوجد بيانات</div>
        ) : (
          <div class="flex items-end gap-2 h-28">
            {weeklyBuckets.map((w) => {
              const h = Math.max(6, Math.round((w.count / maxWeekly) * 100));
              const label = new Date(w.weekStart + 'T00:00:00').toLocaleDateString('ar-EG', {
                day: 'numeric',
                month: 'numeric',
              });
              return (
                <div key={w.weekStart} class="flex-1 flex flex-col items-center gap-1">
                  <div class="text-[11px] text-neutral-500">{w.count}</div>
                  <div class="w-full bg-emerald-600 rounded-t" style={{ height: `${h}%` }} />
                  <div class="text-[10px] text-neutral-400">{label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <div class="font-bold text-neutral-900 mb-3">🎯 توزيع مستويات التقييم</div>
        {scoreDist.every((d) => d.count === 0) ? (
          <div class="text-center text-sm text-neutral-400 py-6">لا يوجد تقييمات مسجلة بعد</div>
        ) : (
          <div class="space-y-2">
            {scoreDist.map((d) => (
              <div key={d.label} class="flex items-center gap-2">
                <div class="w-16 text-xs text-neutral-600 shrink-0">{d.label}</div>
                <div class="flex-1 h-2 rounded bg-neutral-100 overflow-hidden">
                  <div class={`h-2 rounded ${SCORE_COLORS[d.label]}`} style={{ width: `${d.pct}%` }} />
                </div>
                <div class="w-6 text-xs text-neutral-500 text-left">{d.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <div class="font-bold text-neutral-900 mb-3">🏆 الأكثر تسميعاً للآيات</div>
        {topAyat.length === 0 ? (
          <div class="text-center text-sm text-neutral-400 py-6">لا يوجد بيانات</div>
        ) : (
          <div class="space-y-2">
            {topAyat.map((x, i) => (
              <div key={x.name} class="flex items-center gap-3">
                <div class={`text-xl ${RANK_CLASS[i]}`}>{MEDALS[i]}</div>
                <div class="flex-1">
                  <div class="text-sm font-semibold text-neutral-900">{x.name}</div>
                  <div class="text-xs text-neutral-400">
                    {x.ayat} آية مسمّعة · {x.sessionsCount} جلسة
                  </div>
                </div>
                <div class="font-bold text-amber-600">{x.ayat}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <div class="font-bold text-neutral-900 mb-3">✅ الأكثر حضوراً</div>
        {topAttend.length === 0 ? (
          <div class="text-center text-sm text-neutral-400 py-6">لا يوجد بيانات</div>
        ) : (
          <div class="space-y-2">
            {topAttend.map((x) => (
              <div key={x.name} class="flex items-center gap-3">
                <div class="text-xl" title={`المركز ${x.rank}`}>
                  {rankBadgeEmoji(x.rank)}
                </div>
                <div class="flex-1">
                  <div class="text-sm font-semibold text-neutral-900">{x.name}</div>
                  <div class="text-xs text-neutral-400">
                    المركز {x.rank} · {x.uniqueDays} يوم حضور من {summary.totalHalaqaDays}
                  </div>
                </div>
                <div class="font-bold text-emerald-700">{x.attendPct}%</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="bg-white rounded-2xl border border-neutral-200 p-4">
        <div class="font-bold text-neutral-900 mb-3">تفصيل الطلاب</div>
        <input
          type="text"
          class="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm mb-3"
          placeholder="🔍 ابحث عن طالب..."
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
        <div class="flex gap-1.5 mb-3">
          {SORT_TABS.map((tab) => (
            <button
              key={tab.key}
              class={
                'flex-1 py-1.5 rounded-full text-xs font-semibold border ' +
                (sortKey === tab.key
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'border-neutral-200 text-neutral-500')
              }
              onClick={() => setSortKey(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {visibleRows.length === 0 ? (
          <div class="text-center text-sm text-neutral-400 py-6">
            {search ? `لا يوجد نتائج لـ "${esc(search)}"` : 'لا يوجد بيانات مطابقة'}
          </div>
        ) : (
          <div class="divide-y divide-neutral-100">
            {visibleRows.map((row) => {
              const [barBg, textColor] = barColorClass(row.attendPct).split(' ');
              return (
                <div key={row.name} class="py-3">
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="text-sm font-semibold text-neutral-900">{row.name}</div>
                    <div class={`text-sm font-bold ${textColor}`}>{row.attendPct}%</div>
                  </div>
                  <div class="h-1.5 rounded bg-neutral-100 overflow-hidden mb-1.5">
                    <div class={`h-1.5 rounded ${barBg}`} style={{ width: `${row.attendPct}%` }} />
                  </div>
                  <div class="text-[11px] text-neutral-400">
                    {row.sessionsCount} جلسة · {row.ayat} آية · متوسط {row.avg}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
