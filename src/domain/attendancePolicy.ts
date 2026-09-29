import { sortSeasons, type Season } from './seasons';

/**
 * How attendance is owed — per season.
 *
 * Summer: the halaqa meets three days a week and every boy is expected at all
 * three. Study season: the teacher still comes several days a week, but splits
 * the boys across them, so each boy owes ONE day a week — whichever day suits
 * him. Measured against every halaqa day, a boy who never misses his one day
 * would read 33%.
 *
 * So a season can set `daysPerWeek`. Attendance is then counted in weeks
 * (Saturday to Friday): each week asks for `daysPerWeek` days — or fewer, if
 * the halaqa met fewer days that week — and credits at most that many. Days
 * beyond the quota are reported as `extra` but never raise the percentage,
 * and never make up for another week.
 *
 * A season without `daysPerWeek` (and a halaqa without seasons) keeps the old
 * rule exactly: every halaqa day is owed.
 *
 * The week still in progress can only help: a boy whose day is Wednesday has
 * not missed anything on Monday. It asks for nothing more than he has already
 * attended, and it never counts toward a run of missed weeks.
 */

export interface AttendancePolicy {
  /** The accounting unit a halaqa date falls in: its own day, or a
   * (season, week) bucket with a weekly quota. */
  unitOf(date: string): { key: string; perWeek: number | null };
}

export const PER_DAY: AttendancePolicy = {
  unitOf: (date) => ({ key: date, perWeek: null }),
};

/** The Saturday that opens the week `date` falls in ('YYYY-MM-DD'). */
export function saturdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: Sunday 0 … Saturday 6 → days since Saturday.
  const back = (t.getUTCDay() + 1) % 7;
  t.setUTCDate(t.getUTCDate() - back);
  return t.toISOString().slice(0, 10);
}

export function policyFromSeasons(seasons: Season[]): AttendancePolicy {
  const sorted = sortSeasons(seasons);
  if (!sorted.some((s) => s.daysPerWeek)) return PER_DAY;
  return {
    unitOf(date) {
      // Same filing rule as seasonRange: the first season also holds anything
      // older than its start date.
      let season = sorted[0];
      for (const s of sorted) if (s.from <= date) season = s;
      const k = season.daysPerWeek;
      return k
        ? { key: `${season.id}|${saturdayOf(date)}`, perWeek: k }
        : { key: date, perWeek: null };
    },
  };
}

export interface AttendanceTally {
  /** Halaqa days he actually came (all of them, extra included). */
  attended: number;
  /** Days owed. */
  required: number;
  /** Days that counted toward what was owed (≤ required). */
  credited: number;
  /** attended − credited: days beyond the weekly quota. */
  extra: number;
  /** credited / required, rounded; 0 when nothing was owed. */
  pct: number;
  /** Consecutive most-recent completed units (days or weeks) he fell short. */
  missedStreak: number;
  /** What `missedStreak` counts, from the most recent unit. */
  unit: 'day' | 'week';
}

/**
 * @param studentDates dates the student was present
 * @param halaqaDates the halaqa days he was expected over (window + enrolment
 *   already applied, excluded days already removed); any order
 * @param today 'YYYY-MM-DD' — marks the week in progress
 */
export function tallyAttendance(
  studentDates: Set<string>,
  halaqaDates: string[],
  policy: AttendancePolicy,
  today: string,
): AttendanceTally {
  interface Unit {
    days: number;
    came: number;
    perWeek: number | null;
    last: string;
    inProgress: boolean;
  }
  const units = new Map<string, Unit>();
  const thisWeek = saturdayOf(today);
  for (const date of new Set(halaqaDates)) {
    const { key, perWeek } = policy.unitOf(date);
    let u = units.get(key);
    if (!u) {
      u = {
        days: 0,
        came: 0,
        perWeek,
        last: date,
        inProgress: perWeek !== null && saturdayOf(date) === thisWeek,
      };
      units.set(key, u);
    }
    u.days++;
    if (studentDates.has(date)) u.came++;
    if (date > u.last) u.last = date;
  }

  let attended = 0;
  let required = 0;
  let credited = 0;
  const graded: { last: string; short: boolean; inProgress: boolean; week: boolean }[] = [];
  for (const u of units.values()) {
    let owed = u.perWeek === null ? u.days : Math.min(u.perWeek, u.days);
    if (u.inProgress) owed = Math.min(owed, u.came);
    const got = Math.min(u.came, owed);
    attended += u.came;
    required += owed;
    credited += got;
    graded.push({
      last: u.last,
      short: got < owed,
      inProgress: u.inProgress,
      week: u.perWeek !== null,
    });
  }

  graded.sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
  let missedStreak = 0;
  for (const g of graded) {
    if (g.inProgress) continue;
    if (!g.short) break;
    missedStreak++;
  }

  return {
    attended,
    required,
    credited,
    extra: attended - credited,
    pct: required > 0 ? Math.round((credited / required) * 100) : 0,
    missedStreak,
    unit: graded[0]?.week ? 'week' : 'day',
  };
}
