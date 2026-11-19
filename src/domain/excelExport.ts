/**
 * The rows behind the two Excel exports. Pure, so what lands in the file is
 * tested here; src/data/excel.ts only turns these into an .xlsx.
 *
 * Every number is computed by the same functions the screens use, so the file
 * never disagrees with what the teacher sees in الإحصائيات or السجل.
 */
import type { SessionRecord, Student, SuraAssignment } from '../types';
import { computeStudentStatsRows, computeSummaryStats, computeTopPages } from './statsScreen';
import { policyFromSeasons } from './attendancePolicy';
import { ALL_SEASONS, currentSeasonId, filterByPeriod, seasonRange, type Season } from './seasons';
import { recordsForStudent, displayStudentName } from './students';
import { hasScore } from './scoring';
import { joinSuraNames } from './suras';
import { markedAssignments } from './logGrouping';
import { hijriLong } from './hijri';

export type Cell = string | number | null;

export interface ExportSheet {
  /** Sheet name and part of the file name. */
  title: string;
  header: string[];
  rows: Cell[][];
  /** Column widths in characters, one per header. */
  widths: number[];
}

const assignmentText = (list: SuraAssignment[] | undefined): string => {
  const items = (list ?? []).filter((a) => a?.sura);
  return items.length ? joinSuraNames(items) : '';
};

const avgScore = (recs: SessionRecord[], key: 'loh' | 'madi'): number | null => {
  const scored = recs.map((r) => r[key]).filter(hasScore);
  if (!scored.length) return null;
  return Math.round(scored.reduce((a, e) => a + e.score, 0) / scored.length);
};

/**
 * One row per student on the roster for the CURRENT season — the same default
 * view as الإحصائيات. A student with no session still gets a row: the one who
 * stopped coming is exactly who the teacher is looking for in the file.
 */
export function buildStudentsSheet(
  students: Student[],
  allRecords: SessionRecord[],
  seasons: Season[],
  today: string,
): ExportSheet {
  const seasonId = currentSeasonId(seasons, today);
  const season = seasons.find((s) => s.id === seasonId);
  const period = seasonRange(seasons, seasonId);
  const inSeason = filterByPeriod(allRecords, period);
  const policy = policyFromSeasons(seasons);

  // Second argument unfiltered, as on the stats screen: a mark given early in
  // the season may grade an assignment handed out before it.
  const summary = computeSummaryStats(inSeason, allRecords);
  const statsRows = computeStudentStatsRows(
    students,
    inSeason,
    summary.totalHalaqaDays,
    policy,
    today,
  );
  const pagesById = new Map(
    computeTopPages(students, allRecords, Infinity, period).map((p) => [p.id, p]),
  );

  const header = [
    'الاسم',
    'رقم ولي الأمر',
    'تاريخ الانضمام',
    'الجلسات',
    'أيام الحضور',
    'الحضور %',
    'متوسط اللوح',
    'متوسط الماضي',
    'الآيات',
    'الصفحات',
    'من',
    'إلى',
    'آخر جلسة',
  ];

  const rows: Cell[][] = students.map((s, i) => {
    const stat = statsRows[i];
    const recs = recordsForStudent(s, inSeason);
    const last = recs
      .map((r) => r.date)
      .filter(Boolean)
      .sort()
      .pop();
    const pages = pagesById.get(s.id);
    return [
      stat.name,
      s.phonePrimary ?? '',
      s.joinDate ?? '',
      stat.sessionsCount,
      stat.uniqueDays,
      stat.attendPct,
      avgScore(recs, 'loh'),
      avgScore(recs, 'madi'),
      stat.ayat,
      pages?.pages ?? 0,
      pages?.startLabel ?? '',
      pages?.endLabel ?? '',
      last ?? '',
    ];
  });

  return {
    title: seasonId === ALL_SEASONS || !season ? 'الطلاب' : season.name,
    header,
    rows,
    widths: [22, 14, 13, 9, 11, 10, 11, 11, 9, 9, 18, 18, 12],
  };
}

const mistakesText = (r: SessionRecord['loh']): string => {
  const m = r?.mistakes;
  if (!m) return '';
  return `أخطاء ${m.full ?? 0} · تجويد ${m.tajweed ?? 0}`;
};

/**
 * One row per session exactly as listed (filter, search and order kept). A
 * mark is written next to the assignment it was GIVEN for — that lives on the
 * student's previous session, resolved over `context` (everything loaded),
 * the same way the log cards do it.
 */
export function buildLogSheet(
  visible: SessionRecord[],
  students: Student[],
  context: SessionRecord[],
): ExportSheet {
  const marks = markedAssignments(context);
  const header = [
    'التاريخ',
    'الهجري',
    'الطالب',
    'النوع',
    'اللوح المتسمّع',
    'درجة اللوح',
    'أخطاء اللوح',
    'الماضي المتسمّع',
    'درجة الماضي',
    'أخطاء الماضي',
    'لوح جديد',
    'ماضي جديد',
    'تجويد',
    'ملاحظة',
  ];
  const rows: Cell[][] = visible.map((r) => {
    const marked = marks.get(r.id);
    const tajweed = r.tajweed?.sura
      ? `${r.tajweed.sura}${r.tajweed.from ? ` (${r.tajweed.from}–${r.tajweed.to ?? ''})` : ''}`
      : '';
    return [
      r.date ?? '',
      r.date ? hijriLong(r.date) : '',
      displayStudentName(r, students),
      r.attendance_only ? 'حضور فقط' : 'تسميع',
      hasScore(r.loh) ? assignmentText(marked?.loh) : '',
      hasScore(r.loh) ? r.loh.score : null,
      mistakesText(r.loh),
      hasScore(r.madi) ? assignmentText(marked?.madi) : '',
      hasScore(r.madi) ? r.madi.score : null,
      mistakesText(r.madi),
      assignmentText(r.newLoh),
      assignmentText(r.newMadi),
      tajweed,
      r.note ?? '',
    ];
  });
  return {
    title: 'السجل',
    header,
    rows,
    widths: [12, 16, 22, 10, 24, 10, 16, 24, 10, 16, 24, 24, 18, 30],
  };
}

/** "<title>-<date>.xlsx" with characters no file system accepts replaced. */
export function exportFileName(title: string, today: string): string {
  return `${title.replace(/[\\/:*?"<>|]/g, '-')}-${today}.xlsx`;
}
