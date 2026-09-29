import { describe, it, expect } from 'vitest';
import type { SessionRecord, Student } from '../types';
import { getAttendanceRanking, getPersonalAttendanceRanking } from './attendance';
import { policyFromSeasons } from './attendancePolicy';
import {
  averageWeeklyAttendance,
  computeFollowUpList,
  computeStudentStatsRows,
} from './statsScreen';
import { computeOverallRanking } from './overallRanking';
import { buildStudentPublicStats } from './stats';

// Study season from Saturday 2026-09-26, one day a week. The teacher is in on
// Sat/Mon/Wed; زيد comes on Mondays, خالد comes twice in week one then vanishes.
const seasons = [
  { id: 'sum', name: 'صيف 2026', from: '2026-06-01', daysPerWeek: 3 },
  { id: 'stu', name: 'دراسة 2027', from: '2026-09-26', daysPerWeek: 1 },
];
const policy = policyFromSeasons(seasons);
const TODAY = '2026-10-20';
const students: Student[] = [
  { id: 's1', name: 'زيد احمد' },
  { id: 's2', name: 'خالد سعيد' },
  { id: 's3', name: 'عمر حسن' },
];
const rec = (id: string, studentId: string, date: string): SessionRecord => ({
  id,
  studentId,
  date,
});
const records: SessionRecord[] = [
  rec('a', 's1', '2026-09-28'),
  rec('b', 's1', '2026-10-05'),
  rec('c', 's1', '2026-10-12'),
  rec('d', 's2', '2026-09-26'),
  rec('e', 's2', '2026-09-30'),
  // عمر keeps the Saturdays and Wednesdays open as halaqa days.
  rec('f', 's3', '2026-10-03'),
  rec('g', 's3', '2026-10-07'),
  rec('h', 's3', '2026-10-10'),
  rec('i', 's3', '2026-10-14'),
];
const byId = <T extends { id: string }>(l: T[], id: string) => l.find((x) => x.id === id)!;

describe('weekly quota through the leaderboards', () => {
  it('personal ranking: one day a week is 100%', () => {
    const { list } = getPersonalAttendanceRanking(students, records, records, policy, TODAY);
    expect(byId(list, 's1')).toMatchObject({ attendPct: 100, attendedDays: 3, enrolledDays: 3 });
    expect(byId(list, 's2')).toMatchObject({ attendPct: 33, attendedDays: 2, extraDays: 1 });
  });

  it('halaqa-wide ranking uses the same weekly rule', () => {
    const { list } = getAttendanceRanking(students, records, undefined, policy, TODAY);
    expect(byId(list, 's1').attendPct).toBe(100);
    expect(byId(list, 's2').attendPct).toBe(33);
  });

  it('student rows follow the policy', () => {
    const rows = computeStudentStatsRows(students, records, 7, policy, TODAY);
    expect(byId(rows, 's1').attendPct).toBe(100);
  });

  it('follow-up counts missed weeks, not days', () => {
    const list = computeFollowUpList(students, records, 2, policy, TODAY);
    expect(list.map((x) => x.id)).toEqual(['s2']);
    expect(list[0]).toMatchObject({ absenceStreak: 2, unit: 'week' });
  });

  it('overall ranking scores attendance on the weekly rule', () => {
    const list = computeOverallRanking(students, records, 'all', policy, TODAY);
    expect(byId(list, 's1').attendPct).toBe(100);
  });

  it('the parent projection: percentage, days owed and extra days', () => {
    const halaqaDays = [...new Set(records.map((r) => r.date!))].sort().reverse();
    const out = buildStudentPublicStats(students[1], records, 7, null, halaqaDays, seasons, TODAY);
    expect(out.attendPct).toBe(33);
    // attendedDays is what COUNTED (one day in week one); the second day that
    // week is the extra one, shown beside it as +١.
    expect(out.seasonStats?.stu).toMatchObject({
      attendPct: 33,
      attendedDays: 1,
      halaqaDays: 3,
      extraDays: 1,
    });
    const zaid = buildStudentPublicStats(students[0], records, 7, null, halaqaDays, seasons, TODAY);
    expect(zaid.attendPct).toBe(100);
    expect(zaid.enrolledHalaqaDays).toBe(3);
  });
});

describe('averageWeeklyAttendance', () => {
  it('counts distinct students per week, not per day', () => {
    // Week 1: زيد + خالد; week 2: زيد + عمر; week 3: زيد + عمر.
    expect(averageWeeklyAttendance(records)).toBe(2);
  });
});
