import { describe, it, expect } from 'vitest';
import {
  computeOverallRanking,
  OVERALL_WEIGHTS,
  PRIOR_EVAL_COUNT,
  PRIOR_EVAL_SCORE,
  STANDARD_LINES_PER_SESSION,
} from './overallRanking';
import type { SessionRecord, Student } from '../types';

const students: Student[] = [
  { id: 's_1', name: 'زيد احمد' },
  { id: 's_2', name: 'محمد علي' },
];

/** Halaqa days used by most fixtures — five consecutive Wednesdays. */
const DAYS = ['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29'];

function attended(id: string, dates: string[], loh?: number | null): SessionRecord[] {
  return dates.map((d, i) => ({
    id: `r_${id}_${i}`,
    studentId: id,
    date: d,
    ...(loh === undefined ? {} : { loh: { score: loh } }),
  }));
}

function byId<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((e) => e.id === id);
  if (!found) throw new Error(`no entry for ${id}`);
  return found;
}

describe('OVERALL_WEIGHTS', () => {
  it('sums to 1 so points stay on a 0–100 scale', () => {
    const { attendance, recitation, lines } = OVERALL_WEIGHTS;
    expect(attendance + recitation + lines).toBeCloseTo(1, 10);
  });

  it('weights attendance the heaviest and the other two equally', () => {
    expect(OVERALL_WEIGHTS.attendance).toBeGreaterThan(OVERALL_WEIGHTS.recitation);
    expect(OVERALL_WEIGHTS.recitation).toBe(OVERALL_WEIGHTS.lines);
  });
});

describe('computeOverallRanking — population', () => {
  it('returns an empty list when there are no records', () => {
    expect(computeOverallRanking(students, [])).toEqual([]);
  });

  it('leaves out a student with no record at all rather than showing them at zero', () => {
    const list = computeOverallRanking(students, attended('s_1', DAYS, 90));
    expect(list.map((e) => e.id)).toEqual(['s_1']);
  });
});

describe('computeOverallRanking — attendance component', () => {
  it('measures attendance against the student’s own enrolment window', () => {
    // s_2 joins on the last day only; the four days before he existed in the
    // halaqa must not count against him.
    const records = [...attended('s_1', DAYS, 90), ...attended('s_2', [DAYS[4]], 90)];
    const list = computeOverallRanking(students, records);
    expect(byId(list, 's_2').attendPct).toBe(100);
  });

  it('drops the percentage for a student who misses enrolled days', () => {
    const records = [
      ...attended('s_1', DAYS, 90),
      ...attended('s_2', [DAYS[0], DAYS[4]], 90), // enrolled for all 5, came to 2
    ];
    expect(byId(computeOverallRanking(students, records), 's_2').attendPct).toBe(40);
  });

  it('lets attendance outweigh a higher recitation average', () => {
    const records = [
      ...attended('s_1', DAYS, 75), // perfect attendance, middling grades
      ...attended('s_2', [DAYS[0], DAYS[4]], 100), // rare but flawless
    ];
    const list = computeOverallRanking(students, records);
    expect(list[0].id).toBe('s_1');
  });
});

describe('computeOverallRanking — recitation component', () => {
  it('averages loh and madi together', () => {
    const records: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: DAYS[0], loh: { score: 100 }, madi: { score: 50 } },
    ];
    const only = computeOverallRanking(students, records)[0];
    expect(only.evalCount).toBe(2);
    // (100 + 50 + 3×70) ÷ (2 + 3) = 72
    expect(only.recitationScore).toBeCloseTo(72, 6);
  });

  it('treats an unscored evaluation as missing, not as a zero', () => {
    const records: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: DAYS[0], loh: { score: null } },
      { id: 'b', studentId: 's_1', date: DAYS[1], loh: { score: 90 } },
    ];
    const only = computeOverallRanking(students, records)[0];
    expect(only.evalCount).toBe(1);
    expect(only.recitationScore).toBeCloseTo((90 + PRIOR_EVAL_COUNT * PRIOR_EVAL_SCORE) / 4, 6);
  });

  it('counts إعادة as the real zero it is', () => {
    const records: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: DAYS[0], loh: { score: 0 } },
    ];
    const only = computeOverallRanking(students, records)[0];
    expect(only.evalCount).toBe(1);
    expect(only.recitationScore).toBeCloseTo((PRIOR_EVAL_COUNT * PRIOR_EVAL_SCORE) / 4, 6);
  });

  it('approximates legacy star-only evaluations that carry no numeric score', () => {
    const records: SessionRecord[] = [
      { id: 'a', studentId: 's_1', date: DAYS[0], loh: { stars: 5 } },
    ];
    const only = computeOverallRanking(students, records)[0];
    expect(only.evalCount).toBe(1);
    expect(only.recitationScore).toBeCloseTo((100 + PRIOR_EVAL_COUNT * PRIOR_EVAL_SCORE) / 4, 6);
  });

  it('does not let one perfect grade beat a long record of near-perfect ones', () => {
    const oneShot = computeOverallRanking(students, attended('s_1', [DAYS[0]], 100))[0];
    const steady = computeOverallRanking(students, attended('s_1', DAYS, 95))[0];
    expect(steady.recitationScore).toBeGreaterThan(oneShot.recitationScore);
  });

  it('gives a student with no evaluations at all the neutral prior', () => {
    const only = computeOverallRanking(students, attended('s_1', DAYS))[0];
    expect(only.evalCount).toBe(0);
    expect(only.recitationScore).toBeCloseTo(PRIOR_EVAL_SCORE, 6);
  });
});

describe('computeOverallRanking — lines component', () => {
  /** One session's assignment, the way the app actually stores it: a single
   * record carrying every sura handed out that day. It counts only once a
   * LATER session grades it — homework never recited is not memorized ground. */
  function run(id: string, day: string, suras: string[]): SessionRecord[] {
    return [{ id: `p_${id}`, studentId: id, date: day, newLoh: suras.map((sura) => ({ sura })) }];
  }

  it('expects five lines a session — a third of a mushaf page', () => {
    expect(STANDARD_LINES_PER_SESSION).toBe(5);
  });

  it('credits a young student who only ever takes two ayat at a time', () => {
    // The point of the whole change: البقرة ١–٢ is one line. Counted in whole
    // pages this boy scored zero for months while attending every week.
    const records: SessionRecord[] = [
      {
        id: 'a',
        studentId: 's_1',
        date: DAYS[0],
        newLoh: [{ sura: 'البقرة', from: '1', to: '2' }],
      },
      ...attended('s_1', [DAYS[1]], 90),
    ];
    const only = computeOverallRanking(students, records)[0];
    expect(only.lines).toBe(1);
    expect(only.linesScore).toBeGreaterThan(0);
  });

  it('scores lines per attended day against the fixed standard', () => {
    // الفاتحة is 7 lines of the mushaf, over 2 attended days = 3.5 a session,
    // which is 70% of the five-line standard.
    const records = [...run('s_1', DAYS[0], ['الفاتحة']), ...attended('s_1', [DAYS[1]], 90)];
    const only = computeOverallRanking(students, records)[0];
    expect(only.lines).toBe(7);
    expect(only.linesScore).toBe(70);
  });

  it('scores against the standard, not against the fastest student', () => {
    const alone = computeOverallRanking(students, [
      ...run('s_1', DAYS[0], ['الفاتحة']),
      ...attended('s_1', [DAYS[1]], 90),
    ]);
    const withFastPeer = computeOverallRanking(students, [
      ...run('s_1', DAYS[0], ['الفاتحة']),
      ...attended('s_1', [DAYS[1]], 90),
      ...run('s_2', DAYS[0], ['الناس', 'الفلق', 'الإخلاص', 'المسد', 'النصر']),
      ...attended('s_2', [DAYS[1]], 90),
    ]);
    expect(byId(withFastPeer, 's_1').linesScore).toBe(byId(alone, 's_1').linesScore);
  });

  it('caps the component at 100 for a student who beats the standard', () => {
    // The last six suras are 18 lines; over two attended days that is nine a
    // session, well past the standard.
    const records = [
      ...run('s_1', DAYS[0], ['الناس', 'الفلق', 'الإخلاص', 'المسد', 'النصر', 'الكافرون']),
      ...attended('s_1', [DAYS[1]], 90),
    ];
    const only = computeOverallRanking(students, records)[0];
    expect(only.lines).toBe(18);
    expect(only.linesScore).toBe(100);
  });

  it('does not credit an assignment that was never recited', () => {
    const only = computeOverallRanking(students, run('s_1', DAYS[0], ['الفاتحة']))[0];
    expect(only.lines).toBe(0);
    expect(only.linesScore).toBe(0);
  });

  it('gives a zero component to a student who has memorized nothing', () => {
    const list = computeOverallRanking(students, [
      ...attended('s_1', DAYS, 90),
      ...attended('s_2', DAYS, 90),
    ]);
    expect(list.every((e) => e.lines === 0 && e.linesScore === 0)).toBe(true);
  });
});

describe('computeOverallRanking — points and ranking', () => {
  it('keeps points on a 0–100 scale', () => {
    const list = computeOverallRanking(students, [
      ...attended('s_1', DAYS, 100),
      ...attended('s_2', [DAYS[0]], 0),
    ]);
    expect(list.every((e) => e.points >= 0 && e.points <= 100)).toBe(true);
  });

  it('sorts highest points first', () => {
    const list = computeOverallRanking(students, [
      ...attended('s_1', [DAYS[0]], 60),
      ...attended('s_2', DAYS, 95),
    ]);
    expect(list[0].id).toBe('s_2');
    expect(list[0].points).toBeGreaterThan(list[1].points);
  });

  it('ranks densely — tied students share a rank and the next takes the following number', () => {
    const three = [...students, { id: 's_3', name: 'عمر خالد' }];
    const records = [
      ...attended('s_1', DAYS, 90),
      ...attended('s_2', DAYS, 90),
      ...attended('s_3', [DAYS[0]], 90),
    ];
    const list = computeOverallRanking(three, records);
    expect(byId(list, 's_1').rank).toBe(1);
    expect(byId(list, 's_2').rank).toBe(1);
    expect(byId(list, 's_3').rank).toBe(2);
  });

  it('reports the component figures behind the points', () => {
    const only = computeOverallRanking(students, attended('s_1', DAYS, 90))[0];
    expect(only).toMatchObject({ id: 's_1', name: 'زيد احمد', attendedDays: 5, enrolledDays: 5 });
    expect(only.points).toBeCloseTo(
      OVERALL_WEIGHTS.attendance * only.attendPct +
        OVERALL_WEIGHTS.recitation * only.recitationScore +
        OVERALL_WEIGHTS.lines * only.linesScore,
      1,
    );
  });
});
