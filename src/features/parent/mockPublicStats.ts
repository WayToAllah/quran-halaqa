import type { PublicStats } from '../../types';

/** A realistic PublicStats payload used only for local preview (dev + the
 * ?preview escape hatch). Never shipped as real data — the live page always
 * reads getPublicStats(token). */
export const MOCK_PUBLIC_STATS: PublicStats = {
  name: 'زيد أحمد',
  updatedAt: Date.now(),
  totalHalaqaDays: 26,
  uniqueDays: 23,
  attendPct: 88,
  rank: 2,
  sessionsCount: 23,
  totalAyat: 1240,
  avgLoh: 86,
  avgMadi: 84,
  badges: [
    { key: 'attendanceStar', icon: '🌟', label: 'نجم الحضور' },
    { key: 'improving', icon: '📈', label: 'الأكثر تحسناً' },
  ],
  currentTask: {
    date: '2026-07-09',
    newLoh: [{ sura: 'آل عمران', from: '1', to: '15' }],
    newMadi: [{ sura: 'البقرة', from: '280', to: '286' }],
  },
  recentSessions: [
    {
      date: '2026-07-09',
      loh: { score: 92 },
      madi: { score: 90 },
      newLoh: [{ sura: 'آل عمران', from: '1', to: '15' }],
      newMadi: [{ sura: 'البقرة', from: '280', to: '286' }],
      tajweed: null,
      note: 'أداء ممتاز اليوم، ثبات في الحفظ',
    },
    {
      date: '2026-07-07',
      loh: { score: 88 },
      madi: { score: 92 },
      newLoh: [{ sura: 'آل عمران', from: '1', to: '7' }],
      newMadi: [{ sura: 'البقرة', from: '275', to: '286' }],
      tajweed: null,
      note: '',
    },
    {
      date: '2026-07-05',
      loh: { score: 90 },
      madi: { score: 85 },
      newLoh: [{ sura: 'البقرة', from: '285', to: '286' }],
      newMadi: [{ sura: 'الفاتحة' }],
      tajweed: null,
      note: '',
    },
  ],
  scoreHistory: [
    { date: '2026-06-20', loh: 70, madi: 80 },
    { date: '2026-06-22', loh: 75, madi: 78 },
    { date: '2026-06-25', loh: 80, madi: 85 },
    { date: '2026-06-27', loh: 78, madi: 82 },
    { date: '2026-07-01', loh: 85, madi: 88 },
    { date: '2026-07-04', loh: 90, madi: 85 },
    { date: '2026-07-07', loh: 88, madi: 92 },
    { date: '2026-07-09', loh: 92, madi: 90 },
  ],
  monthlyStats: {},
};
