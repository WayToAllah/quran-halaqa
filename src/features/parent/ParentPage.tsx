import { useEffect, useState } from 'preact/hooks';
import type { PublicStats } from '../../types';
import { fetchPublicStatsRest } from '../../data/firestoreRest';
import { visibleBadges } from '../../domain/badges';
import {
  getParentTheme,
  buildChart,
  buildStats,
  buildCurrentTask,
  buildSessions,
  buildMonthOptions,
  rankBadgeText,
  ALL_MONTHS,
  type ParentTheme,
  type ColorRole,
  type GradeTone,
} from './parentView';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; kind: 'notfound' | 'failed' }
  | { status: 'ready'; stats: PublicStats };

interface Props {
  /** Parent link token (from ?t=). */
  token?: string;
  /** Bypass fetching entirely — used for local preview. */
  previewStats?: PublicStats;
  /** Injectable loader so tests never touch Firebase. */
  load?: (token: string) => Promise<PublicStats | null>;
}

function cssVars(t: ParentTheme): string {
  return [
    `--bg:${t.bg}`,
    `--surface:${t.surface}`,
    `--surface-2:${t.surface2}`,
    `--ink:${t.ink}`,
    `--ink-deep:${t.inkDeep}`,
    `--ink-tint:${t.inkTint}`,
    `--accent:${t.accent}`,
    `--accent-tint:${t.accentTint}`,
    `--good:${t.good}`,
    `--good-tint:${t.goodTint}`,
    `--warn:${t.warn}`,
    `--text:${t.text}`,
    `--text-muted:${t.textMuted}`,
    `--text-hint:${t.textHint}`,
    `--border:${t.border}`,
    `--border-strong:${t.borderStrong}`,
    `--shadow-sm:${t.shadowSm}`,
    `--radius:20px`,
    `--radius-sm:12px`,
  ].join(';');
}

const statColor: Record<ColorRole, string> = { ink: 'var(--ink)', accent: 'var(--accent)' };
const gradeColor: Record<GradeTone, string> = {
  good: 'var(--good)',
  muted: 'var(--text-muted)',
  warn: 'var(--warn)',
};
function formatUpdatedAt(ms: number): string {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-arab', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

export function ParentPage({ token, previewStats, load = fetchPublicStatsRest }: Props) {
  const [dark, setDark] = useState(false);
  const [month, setMonth] = useState(ALL_MONTHS);
  const [state, setState] = useState<LoadState>(
    previewStats ? { status: 'ready', stats: previewStats } : { status: 'loading' },
  );

  useEffect(() => {
    if (previewStats) return;
    if (!token) {
      setState({ status: 'error', kind: 'notfound' });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    load(token)
      .then((stats) => {
        if (!alive) return;
        setState(stats ? { status: 'ready', stats } : { status: 'error', kind: 'notfound' });
      })
      .catch(() => alive && setState({ status: 'error', kind: 'failed' }));
    return () => {
      alive = false;
    };
  }, [token, previewStats, load]);

  const theme = getParentTheme(dark);

  const shell = (children: preact.ComponentChildren) => (
    <div
      dir="rtl"
      style={
        cssVars(theme) +
        ";min-height:100vh;background:var(--bg);color:var(--text);display:flex;justify-content:center;font-family:Tajawal,system-ui,'Segoe UI',Tahoma,sans-serif;transition:background 0.25s ease,color 0.25s ease"
      }
    >
      <div style="width:100%;max-width:440px;min-height:100vh;background:var(--bg)">{children}</div>
    </div>
  );

  if (state.status === 'loading') {
    return shell(
      <div style="padding:80px 24px;text-align:center;color:var(--text-muted);font-size:14px">
        جارٍ تحميل التقرير…
      </div>,
    );
  }

  if (state.status === 'error') {
    const msg =
      state.kind === 'notfound'
        ? 'الرابط غير صحيح أو انتهت صلاحيته. تواصل مع مُعلّم الحلقة للحصول على رابط جديد.'
        : 'تعذّر تحميل التقرير الآن. تأكّد من اتصالك بالإنترنت وحاول مرة أخرى.';
    return shell(
      <div style="padding:70px 30px;text-align:center">
        <div style="font-size:40px;margin-bottom:14px">📖</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">
          تقرير متابعة الحفظ
        </div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.8">{msg}</div>
      </div>,
    );
  }

  const stats = state.stats;
  const chart = buildChart(stats.scoreHistory);
  const monthOptions = buildMonthOptions(stats);
  // A month that vanished between renders (a fresh document dropping an old
  // month) must not leave the grid stuck on a key nothing answers to.
  const activeMonth = monthOptions.some((o) => o.key === month) ? month : ALL_MONTHS;
  const statCells = buildStats(stats, activeMonth);
  const task = buildCurrentTask(stats);
  const sessions = buildSessions(stats);
  const rankText = rankBadgeText(stats.rank);
  // publicStats documents written before a badge was hidden still carry it,
  // so filter on read as well as on write (see domain/badges.ts).
  const badges = visibleBadges(stats.badges);

  // End-of-line value labels, nudged apart when the two points sit close.
  const close =
    chart.lohLast && chart.madiLast && Math.abs(chart.lohLast.y - chart.madiLast.y) < 14;
  const lohLabelY = chart.lohLast ? chart.lohLast.y - (close ? 12 : 10) : 0;
  const madiLabelY = chart.madiLast ? chart.madiLast.y + (close ? 12 : 18) : 0;
  const pctLeft = (x: number) => (x / 320) * 100 + '%';
  const pctTop = (y: number) => y + '%';

  const cardStyle =
    'background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);padding:19px;margin-bottom:13px;box-shadow:var(--shadow-sm)';
  const cardTitle =
    'font-size:12.5px;font-weight:700;color:var(--ink);letter-spacing:0.02em;display:flex;align-items:center;gap:9px;margin-bottom:14px';
  const titleDot =
    'width:21px;height:21px;border-radius:50%;background:var(--ink-tint);color:var(--ink);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0';

  return shell(
    <>
      {/* Header */}
      <div
        style={
          'color:oklch(97% 0.014 85);padding:34px 24px 26px;text-align:center;position:relative;overflow:hidden;transition:background 0.25s ease;background:' +
          theme.headerBg
        }
      >
        <button
          onClick={() => setDark((d) => !d)}
          aria-label="تبديل المظهر"
          style="position:absolute;top:16px;left:16px;width:36px;height:36px;border-radius:50%;border:1px solid oklch(90% 0.02 85 / 0.3);background:oklch(90% 0.02 85 / 0.12);color:oklch(97% 0.014 85);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer"
        >
          {dark ? '☀️' : '🌙'}
        </button>

        <div
          aria-hidden="true"
          style="width:78px;height:78px;margin:0 auto 12px;border-radius:50%;border:1.5px solid oklch(70% 0.1 55 / 0.55);display:flex;align-items:center;justify-content:center;background:var(--ink-deep);color:oklch(97% 0.014 85)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
            <path
              fill-rule="evenodd"
              d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
              clip-rule="evenodd"
            />
          </svg>
        </div>

        <h1 style="font-size:22px;font-weight:900;letter-spacing:-0.01em;margin:0">{stats.name}</h1>
        {rankText && (
          <div style="margin-top:11px">
            <span style="display:inline-flex;align-items:center;gap:7px;white-space:nowrap;background:oklch(58% 0.13 55 / 0.24);border:1px solid oklch(70% 0.1 55 / 0.5);color:oklch(93% 0.04 60);font-size:12px;font-weight:600;padding:6px 15px;border-radius:20px">
              {rankText}
            </span>
          </div>
        )}
      </div>

      <div style="padding:18px 18px 40px">
        {/* Current task */}
        {task && (
          <div style={cardStyle}>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
              <div style="font-size:12.5px;font-weight:700;color:var(--ink);letter-spacing:0.02em;display:flex;align-items:center;gap:9px">
                <span style={titleDot}>📝</span>
                المهمة الحالية
              </div>
              <span style="font-size:11px;color:var(--text-hint);font-weight:500">
                آخر جلسة: {task.dateLabel || task.date}
              </span>
            </div>
            <div style="background:var(--accent-tint);border:1px dashed oklch(58% 0.13 55 / 0.4);border-radius:var(--radius-sm);padding:16px 17px">
              {task.loh && (
                <div style="font-size:14.5px;margin-bottom:10px;color:var(--text);display:flex;gap:8px">
                  <span style="color:var(--ink-deep);font-weight:700;flex-shrink:0">اللوح:</span>
                  <span>{task.loh}</span>
                </div>
              )}
              {task.madi && (
                <div style="font-size:14.5px;color:var(--text);display:flex;gap:8px">
                  <span style="color:var(--ink-deep);font-weight:700;flex-shrink:0">الماضي:</span>
                  <span>{task.madi}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Month filter. Only these four numbers move; the chart, the badges and
            the session list below stay all-time on purpose (they are the
            student's story, not a monthly report), so the state is spelled out
            underneath rather than left for the parent to infer. */}
        {monthOptions.length > 0 && (
          <div
            role="group"
            aria-label="تصفية الأرقام حسب الشهر"
            style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:11px;scrollbar-width:none"
          >
            {monthOptions.map((o) => {
              const on = o.key === activeMonth;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setMonth(o.key)}
                  aria-pressed={on}
                  style={
                    'flex-shrink:0;font-family:inherit;font-size:12px;font-weight:700;padding:7px 15px;border-radius:20px;cursor:pointer;white-space:nowrap;transition:background 0.15s ease;' +
                    (on
                      ? 'background:var(--ink);color:oklch(97% 0.014 85);border:1px solid var(--ink)'
                      : 'background:var(--surface);color:var(--text-muted);border:1px solid var(--border-strong)')
                  }
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Stat grid */}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:14px">
          {statCells.map((st) => (
            <div
              key={st.label}
              style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm);padding:16px 14px;text-align:center"
            >
              <div
                style={
                  'font-size:26px;font-weight:900;letter-spacing:-0.02em;line-height:1;color:' +
                  statColor[st.color]
                }
              >
                {st.value}
              </div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:7px;font-weight:500">
                {st.label}
              </div>
            </div>
          ))}
        </div>

        {activeMonth !== ALL_MONTHS && (
          <div style="font-size:11.5px;color:var(--text-hint);text-align:center;margin:-4px 0 14px;line-height:1.7">
            {/* The separator must bind to a word, not to the year: a spaced
                middle dot after '٢٠٢٦' reorders flush against the digits and
                reads as another numeral — the same bidi trap as the mistake
                line above. 'فقط' gives the comma something to attach to. */}
            الأرقام فوق عن {monthOptions.find((o) => o.key === activeMonth)?.label} فقط، والرسم
            والجلسات تحت بيعرضوا الفترة كلها
          </div>
        )}

        {/* Progress chart */}
        <div style={cardStyle}>
          <div style="font-size:12.5px;font-weight:700;color:var(--ink);letter-spacing:0.02em;display:flex;align-items:center;gap:9px;margin-bottom:6px">
            <span style={titleDot}>📈</span>
            تقدّم آخر الجلسات
          </div>
          <div style="display:flex;gap:18px;margin:10px 0 6px;font-size:12px;color:var(--text-muted)">
            <span style="display:flex;align-items:center;gap:6px">
              <i style="width:9px;height:9px;border-radius:50%;display:inline-block;background:var(--ink)"></i>{' '}
              اللوح
            </span>
            <span style="display:flex;align-items:center;gap:6px">
              <i style="width:9px;height:9px;border-radius:50%;display:inline-block;background:var(--accent)"></i>{' '}
              الماضي
            </span>
            <span style="display:flex;align-items:center;gap:6px">
              <i style="color:var(--warn);font-weight:700;line-height:1">✕</i> إعادة
            </span>
          </div>
          <div style="position:relative;width:100%">
            <svg
              viewBox={chart.viewBox}
              preserveAspectRatio="xMidYMid meet"
              style="width:100%;height:auto;display:block;overflow:visible"
            >
              {/* Below the pass line: everything here is إعادة. Tinted so the
                  axis floor reads as a grading boundary, not as zero. */}
              <rect
                x={chart.plotLeft}
                y={chart.passY}
                width={chart.plotRight - chart.plotLeft}
                height={chart.plotBottom - chart.passY}
                fill="var(--warn)"
                opacity="0.09"
              />
              {chart.gridLines.map((g) => (
                <g key={g.value}>
                  <line
                    x1={chart.plotLeft}
                    y1={g.y}
                    x2={chart.plotRight}
                    y2={g.y}
                    stroke={g.strong ? 'var(--border-strong)' : 'var(--border)'}
                    stroke-width={g.strong ? 1 : 0.7}
                    stroke-dasharray={g.strong ? '' : '3 4'}
                  />
                  {g.label && (
                    <text
                      x={chart.plotLeft - 4}
                      y={g.y + 2.6}
                      text-anchor="end"
                      font-size="7.5"
                      fill="var(--text-hint)"
                    >
                      {g.label}
                    </text>
                  )}
                </g>
              ))}
              <line
                x1={chart.plotLeft}
                y1={chart.plotTop}
                x2={chart.plotLeft}
                y2={chart.plotBottom}
                stroke="var(--border)"
                stroke-width="1"
              />
              {chart.lohPath && (
                <path
                  d={chart.lohPath}
                  stroke="var(--ink)"
                  stroke-width="2.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              )}
              {chart.madiPath && (
                <path
                  d={chart.madiPath}
                  stroke="var(--accent)"
                  stroke-width="2.5"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              )}
              {/* إعادة sessions: a ✕ in the tinted zone rather than a point on
                  the line, so one failed session reads as its own event
                  instead of collapsing the whole trend into a spike. */}
              {chart.lohRepeats.map((p, i) => (
                <path
                  key={'lr' + i}
                  d={`M ${p.x - 3.2} ${p.y - 3.2} L ${p.x + 3.2} ${p.y + 3.2} M ${p.x - 3.2} ${p.y + 3.2} L ${p.x + 3.2} ${p.y - 3.2}`}
                  stroke="var(--warn)"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              ))}
              {chart.madiRepeats.map((p, i) => (
                <path
                  key={'mr' + i}
                  d={`M ${p.x - 3.2} ${p.y - 3.2} L ${p.x + 3.2} ${p.y + 3.2} M ${p.x - 3.2} ${p.y + 3.2} L ${p.x + 3.2} ${p.y - 3.2}`}
                  stroke="var(--warn)"
                  stroke-width="2"
                  stroke-linecap="round"
                  opacity="0.55"
                />
              ))}
              {chart.lohLast && !chart.lohLast.repeat && (
                <circle cx={chart.lohLast.x} cy={chart.lohLast.y} r="4" fill="var(--ink)" />
              )}
              {chart.madiLast && !chart.madiLast.repeat && (
                <circle cx={chart.madiLast.x} cy={chart.madiLast.y} r="4" fill="var(--accent)" />
              )}
            </svg>
            {chart.lohLast && (
              <div
                style={
                  'position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none;color:' +
                  (chart.lohLast.repeat ? 'var(--warn)' : 'var(--ink)') +
                  ';left:' +
                  pctLeft(chart.lohLast.x) +
                  ';top:' +
                  pctTop(lohLabelY)
                }
              >
                {chart.lohLast.label}
                {chart.lohLast.repeat ? '' : '٪'}
              </div>
            )}
            {chart.madiLast && (
              <div
                style={
                  'position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none;color:' +
                  (chart.madiLast.repeat ? 'var(--warn)' : 'var(--accent)') +
                  ';left:' +
                  pctLeft(chart.madiLast.x) +
                  ';top:' +
                  pctTop(madiLabelY)
                }
              >
                {chart.madiLast.label}
                {chart.madiLast.repeat ? '' : '٪'}
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div style={cardStyle}>
            <div style={cardTitle}>
              <span style={titleDot}>🏅</span>
              الأوسمة
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:9px">
              {badges.map((b) => (
                <span
                  key={b.key}
                  style="display:inline-flex;align-items:center;gap:7px;background:var(--good-tint);color:var(--good);border:1px solid oklch(56% 0.09 150 / 0.3);font-size:12.5px;font-weight:700;padding:7px 14px;border-radius:20px"
                >
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div style={cardStyle}>
            <div style="font-size:12.5px;font-weight:700;color:var(--ink);letter-spacing:0.02em;margin-bottom:6px;display:flex;align-items:center;gap:9px">
              <span style={titleDot}>📜</span>
              آخر الجلسات
            </div>
            {sessions.map((s) => (
              <div
                key={s.date}
                style="padding:16px 20px 16px 4px;border-right:2.5px solid var(--border-strong);margin-top:10px;position:relative"
              >
                <div style="position:absolute;width:10px;height:10px;right:-6px;top:19px;border-radius:50%;background:var(--ink);border:2px solid var(--surface)"></div>
                <div style="margin-bottom:9px">
                  {s.dateHijri ? (
                    <>
                      <div style="font-size:12.5px;color:var(--ink);font-weight:700">
                        {s.dateHijri}
                      </div>
                      <div style="font-size:11px;color:var(--text-hint);margin-top:2px">
                        {s.dateGregorian}
                      </div>
                    </>
                  ) : (
                    <div style="font-size:12.5px;color:var(--ink);font-weight:700">
                      {s.dateGregorian || s.date}
                    </div>
                  )}
                </div>

                {/* Two clearly separated groups. These belong to DIFFERENT
                    weeks: the score grades what was assigned last session,
                    while the homework below is for next time. Rendering the
                    new sura on the same line as the score read as "he scored
                    90 on البقرة" when he hadn't recited البقرة yet. */}
                {(s.loh !== null || s.madi !== null) && (
                  <div style="margin-bottom:10px">
                    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:7px">
                      📊 تقييم التسميع
                    </div>

                    {s.loh !== null && (
                      <div style="margin-bottom:8px">
                        <div style="display:flex;align-items:center;gap:10px">
                          <span style="font-size:12px;color:var(--text-muted);width:44px;flex-shrink:0">
                            اللوح
                          </span>
                          {s.recitedLoh && (
                            <span style="font-size:12.5px;color:var(--text);font-weight:500;max-width:108px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0">
                              {s.recitedLoh}
                            </span>
                          )}
                          <div style="flex:1;height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden">
                            <div
                              style={
                                'height:100%;border-radius:3px;background:var(--ink);transition:width 0.6s ease;width:' +
                                s.lohPct
                              }
                            ></div>
                          </div>
                          <span style="font-size:12.5px;font-weight:700;color:var(--ink);width:32px;text-align:left">
                            {s.lohLabel}
                          </span>
                        </div>
                        {(s.lohGrade || s.lohMistakes) && (
                          <div style="font-size:11px;margin-top:3px;padding-right:54px;color:var(--text-hint)">
                            {s.lohGrade && (
                              <span style={'font-weight:700;color:' + gradeColor[s.lohTone]}>
                                {s.lohGrade}
                              </span>
                            )}
                            {s.lohGrade && s.lohMistakes ? '، ' : ''}
                            {s.lohMistakes}
                          </div>
                        )}
                      </div>
                    )}

                    {s.madi !== null && (
                      <div>
                        <div style="display:flex;align-items:center;gap:10px">
                          <span style="font-size:12px;color:var(--text-muted);width:44px;flex-shrink:0">
                            الماضي
                          </span>
                          {s.recitedMadi && (
                            <span style="font-size:12.5px;color:var(--text);font-weight:500;max-width:108px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0">
                              {s.recitedMadi}
                            </span>
                          )}
                          <div style="flex:1;height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden">
                            <div
                              style={
                                'height:100%;border-radius:3px;background:var(--accent);transition:width 0.6s ease;width:' +
                                s.madiPct
                              }
                            ></div>
                          </div>
                          <span style="font-size:12.5px;font-weight:700;color:var(--accent);width:32px;text-align:left">
                            {s.madiLabel}
                          </span>
                        </div>
                        {(s.madiGrade || s.madiMistakes) && (
                          <div style="font-size:11px;margin-top:3px;padding-right:54px;color:var(--text-hint)">
                            {s.madiGrade && (
                              <span style={'font-weight:700;color:' + gradeColor[s.madiTone]}>
                                {s.madiGrade}
                              </span>
                            )}
                            {s.madiGrade && s.madiMistakes ? '، ' : ''}
                            {s.madiMistakes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(s.newLoh || s.newMadi) && (
                  <div style="padding:9px 11px;border-radius:9px;background:var(--surface-2)">
                    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:5px">
                      ✏️ الواجب الجديد للمرة الجاية
                    </div>
                    {s.newLoh && (
                      <div style="font-size:12.5px;color:var(--text);margin-bottom:2px">
                        <span style="color:var(--text-muted)">اللوح:</span> {s.newLoh}
                      </div>
                    )}
                    {s.newMadi && (
                      <div style="font-size:12.5px;color:var(--text)">
                        <span style="color:var(--text-muted)">الماضي:</span> {s.newMadi}
                      </div>
                    )}
                  </div>
                )}

                {s.note && (
                  <div style="font-size:13px;color:var(--text-muted);font-style:italic;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border-strong)">
                    {s.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style="font-size:11.5px;color:var(--text-hint);text-align:center;margin-top:14px;line-height:1.7">
          آخر تحديث: {formatUpdatedAt(stats.updatedAt)}
        </div>
      </div>
    </>,
  );
}
