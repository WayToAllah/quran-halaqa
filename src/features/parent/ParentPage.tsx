import { useEffect, useState } from 'preact/hooks';
import type { PublicStats } from '../../types';
import { fetchPublicStatsRest } from '../../data/firestoreRest';
import {
  getParentTheme,
  buildChart,
  buildTrend,
  buildStats,
  buildCurrentTask,
  buildSessions,
  firstInitial,
  rankBadgeText,
  type ParentTheme,
  type ColorRole,
  type TrendTone,
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
const trendColor: Record<TrendTone, string> = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  muted: 'var(--text-muted)',
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
        ';min-height:100vh;background:var(--bg);color:var(--text);display:flex;justify-content:center;font-family:Tajawal,system-ui,\'Segoe UI\',Tahoma,sans-serif;transition:background 0.25s ease,color 0.25s ease'
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
  const trend = buildTrend(stats.scoreHistory);
  const statCells = buildStats(stats);
  const task = buildCurrentTask(stats);
  const sessions = buildSessions(stats);
  const rankText = rankBadgeText(stats.rank);

  // End-of-line value labels, nudged apart when the two points sit close.
  const close = chart.lohLast && chart.madiLast && Math.abs(chart.lohLast.y - chart.madiLast.y) < 14;
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
          style="width:78px;height:78px;margin:0 auto 12px;border-radius:50%;border:1.5px solid oklch(70% 0.1 55 / 0.55);display:flex;align-items:center;justify-content:center;background:var(--ink-deep);font-size:30px;font-weight:900;color:oklch(97% 0.014 85)"
        >
          {firstInitial(stats.name)}
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
                آخر جلسة: {sessions[0]?.date ?? task.date}
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
          </div>
          <div style="position:relative;width:100%">
            <svg
              viewBox={chart.viewBox}
              preserveAspectRatio="xMidYMid meet"
              style="width:100%;height:auto;display:block;overflow:visible"
            >
              <line x1="18" y1="20" x2="18" y2="80" stroke="var(--border)" stroke-width="1" />
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
              {chart.lohLast && (
                <circle cx={chart.lohLast.x} cy={chart.lohLast.y} r="4" fill="var(--ink)" />
              )}
              {chart.madiLast && (
                <circle cx={chart.madiLast.x} cy={chart.madiLast.y} r="4" fill="var(--accent)" />
              )}
            </svg>
            {chart.lohLast && (
              <div
                style={
                  'position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:700;color:var(--ink);white-space:nowrap;pointer-events:none;left:' +
                  pctLeft(chart.lohLast.x) +
                  ';top:' +
                  pctTop(lohLabelY)
                }
              >
                {chart.lohLast.value}٪
              </div>
            )}
            {chart.madiLast && (
              <div
                style={
                  'position:absolute;transform:translate(-50%,-50%);font-size:11px;font-weight:700;color:var(--accent);white-space:nowrap;pointer-events:none;left:' +
                  pctLeft(chart.madiLast.x) +
                  ';top:' +
                  pctTop(madiLabelY)
                }
              >
                {chart.madiLast.value}٪
              </div>
            )}
          </div>
          <div
            style={'text-align:center;font-size:13px;font-weight:700;margin-top:8px;color:' + trendColor[trend.tone]}
          >
            {trend.text}
          </div>
        </div>

        {/* Badges */}
        {stats.badges.length > 0 && (
          <div style={cardStyle}>
            <div style={cardTitle}>
              <span style={titleDot}>🏅</span>
              الأوسمة
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:9px">
              {stats.badges.map((b) => (
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
                  <div style="font-size:12.5px;color:var(--ink);font-weight:700">{s.date}</div>
                </div>

                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                  <span style="font-size:12px;color:var(--text-muted);width:44px;flex-shrink:0">اللوح</span>
                  {s.newLoh && (
                    <span style="font-size:12.5px;color:var(--text);font-weight:500;max-width:108px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0">
                      {s.newLoh}
                    </span>
                  )}
                  <div style="flex:1;height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden">
                    <div
                      style={'height:100%;border-radius:3px;background:var(--ink);transition:width 0.6s ease;width:' + s.lohPct}
                    ></div>
                  </div>
                  <span style="font-size:12.5px;font-weight:700;color:var(--ink);width:32px;text-align:left">
                    {s.lohLabel}
                  </span>
                </div>

                <div style="display:flex;align-items:center;gap:10px">
                  <span style="font-size:12px;color:var(--text-muted);width:44px;flex-shrink:0">الماضي</span>
                  {s.newMadi && (
                    <span style="font-size:12.5px;color:var(--text);font-weight:500;max-width:108px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0">
                      {s.newMadi}
                    </span>
                  )}
                  <div style="flex:1;height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden">
                    <div
                      style={'height:100%;border-radius:3px;background:var(--accent);transition:width 0.6s ease;width:' + s.madiPct}
                    ></div>
                  </div>
                  <span style="font-size:12.5px;font-weight:700;color:var(--accent);width:32px;text-align:left">
                    {s.madiLabel}
                  </span>
                </div>

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
