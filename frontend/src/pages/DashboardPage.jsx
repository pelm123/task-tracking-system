import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import * as dashboardApi from '../api/dashboard';
import * as projectsApi from '../api/projects';
import { useProject } from '../context/ProjectContext';
import styles from './dashboard.module.css';
import { colorForProject } from '../utils/projectColor';
import { timeAgo } from '../utils/dateTime';
import { t as tr, getLocale } from '../i18n';
import AtRiskPanel from '../components/AtRiskPanel';
import ProjectSwitcher from '../components/ProjectSwitcher';

const STATUS_COLORS = {
  todo: '#8b9490',
  in_progress: 'var(--status-in-progress)',
  review: '#6e8fa8',
  done: '#6b9080',
};
const PRIORITY_COLORS = { low: '#7c8985', medium: '#c9a63e', high: '#c9603e' };

// Recharts colours the tooltip's label and rows on its own (dark text by
// default), and the bar hover cursor is a light grey block; both are set from
// the theme so they read in dark and light mode.
const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-md)',
    fontSize: 13,
  },
  labelStyle: { color: 'var(--color-text)', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: 'var(--color-text)' },
  cursor: { fill: 'var(--color-accent-soft)' },
};

const ALL_PROJECTS = 'all';
const PROJECT_FILTER_STORAGE_KEY = 'dashboardProjectFilter';

// ---- date range helpers (local calendar dates as 'YYYY-MM-DD') ----
function toDateStr(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const RANGE_PRESETS = [
  {
    key: 'this-month',
    labelKey: 'dashboard.thisMonth',
    range: () => {
      const n = new Date();
      return [toDateStr(new Date(n.getFullYear(), n.getMonth(), 1)), toDateStr(new Date(n.getFullYear(), n.getMonth() + 1, 0))];
    },
  },
  {
    key: 'last-month',
    labelKey: 'dashboard.lastMonth',
    range: () => {
      const n = new Date();
      return [toDateStr(new Date(n.getFullYear(), n.getMonth() - 1, 1)), toDateStr(new Date(n.getFullYear(), n.getMonth(), 0))];
    },
  },
  {
    key: 'last-30',
    labelKey: 'dashboard.last30',
    range: () => {
      const n = new Date();
      return [toDateStr(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 29)), toDateStr(n)];
    },
  },
  {
    key: 'last-90',
    labelKey: 'dashboard.last90',
    range: () => {
      const n = new Date();
      return [toDateStr(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 89)), toDateStr(n)];
    },
  },
  {
    key: 'this-year',
    labelKey: 'dashboard.thisYear',
    range: () => {
      const n = new Date();
      return [toDateStr(new Date(n.getFullYear(), 0, 1)), toDateStr(new Date(n.getFullYear(), 11, 31))];
    },
  },
];

const RANGE_STORAGE_KEY = 'dashboardDateRange';

function initialRange() {
  try {
    const saved = JSON.parse(localStorage.getItem(RANGE_STORAGE_KEY) || 'null');
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved.from) && /^\d{4}-\d{2}-\d{2}$/.test(saved.to)) return saved;
  } catch (err) {
    // ignore — fall back to this month
  }
  const [from, to] = RANGE_PRESETS[0].range();
  return { from, to };
}

// "1 Oct 2026 – 31 Oct 2026" from two 'YYYY-MM-DD' strings, in the current language
function formatRangeLabel(from, to) {
  const fmt = (str) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

// One period's report (the selected date range) — stat cards, a
// status/priority breakdown, and a per-project / per-assignee rundown.
function PeriodSection({ title, subtitle, data }) {
  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    status,
    label: tr(`status.${status}`),
    count,
  }));
  const priorityData = Object.entries(data.byPriority).map(([priority, count]) => ({ priority, name: tr(`priority.${priority}`), count }));
  const maxProjectTotal = Math.max(1, ...data.byProject.map((p) => p.total));
  const maxAssigneeTotal = Math.max(1, ...data.byAssignee.map((a) => a.total));

  return (
    <section className={styles.periodSection}>
      <div className={styles.periodHeader}>
        <h2>{title}</h2>
        <p className={styles.subLine}>{subtitle}</p>
      </div>

      <div className={styles.statCards}>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-accent)' }}>
          <div className={styles.statValue}>{data.totalCreated}</div>
          <div className={styles.statLabel}>{tr('dashboard.created')}</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-done)' }}>
          <div className={styles.statValue}>{data.totalCompleted}</div>
          <div className={styles.statLabel}>{tr('dashboard.completed')}</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--priority-high)' }}>
          <div className={`${styles.statValue} ${data.overdueCount > 0 ? styles.statValueWarn : ''}`}>
            {data.overdueCount}
          </div>
          <div className={styles.statLabel}>{tr('home.statOverdue')}</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-text-muted)' }}>
          <div className={styles.statValue}>{pct(data.totalCompleted, data.totalCreated)}%</div>
          <div className={styles.statLabel}>{tr('dashboard.completionRate')}</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>{tr('dashboard.byStatus')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
              <Tooltip {...TOOLTIP_PROPS} />
              <Bar dataKey="count" name={tr('dashboard.tasksSeries')} radius={[4, 4, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>{tr('dashboard.byPriority')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={priorityData} dataKey="count" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={3}>
                {priorityData.map((entry) => (
                  <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
              <Tooltip {...TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.rundownGrid}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>{tr('dashboard.byProject')}</p>
          {data.byProject.length === 0 ? (
            <p className={styles.emptyText}>{tr('dashboard.noTasksPeriod')}</p>
          ) : (
            <div className={styles.rundownList}>
              {data.byProject.map((p) => (
                <div key={p.project_id} className={styles.rundownRow}>
                  <span className={styles.rundownDot} style={{ background: colorForProject(p.project_id) }} />
                  <span className={styles.rundownName} title={p.project_name}>
                    {p.project_name}
                  </span>
                  <div className={styles.rundownBarTrack}>
                    <div
                      className={styles.rundownBarFill}
                      style={{
                        width: `${(p.total / maxProjectTotal) * 100}%`,
                        background: colorForProject(p.project_id),
                      }}
                    />
                  </div>
                  <span className={styles.rundownCount}>
                    {tr('home.doneOf', { done: p.completed, total: p.total })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>{tr('dashboard.byMember')}</p>
          {data.byAssignee.length === 0 ? (
            <p className={styles.emptyText}>{tr('dashboard.noAssignedPeriod')}</p>
          ) : (
            <div className={styles.rundownList}>
              {data.byAssignee.map((a) => (
                <div key={a.id} className={styles.rundownRow}>
                  <span className={styles.rundownName} title={a.name}>
                    {a.name}
                  </span>
                  <div className={styles.rundownBarTrack}>
                    <div
                      className={styles.rundownBarFill}
                      style={{ width: `${(a.total / maxAssigneeTotal) * 100}%`, background: 'var(--color-accent)' }}
                    />
                  </div>
                  <span className={styles.rundownCount}>
                    {tr('board.taskCount', { count: a.total })}
                    {a.overdue > 0 && <span className={styles.rundownOverdue}> · {tr('board.overdueCount', { n: a.overdue })}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Single-project dashboard — unchanged behavior from before, just scoped to
// whichever project is chosen in the "Showing" dropdown rather than the
// header's globally-selected project.
function SingleProjectDashboard({ projectId }) {
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setSummary(null);
    setError('');
    dashboardApi
      .getSummary(projectId)
      .then(setSummary)
      .catch(() => setError(tr('dashboard.loadFail')));
    projectsApi.getActivity(projectId).then(setActivity).catch(() => {});
  }, [projectId]);

  if (error) {
    return <p style={{ color: 'var(--priority-high)' }}>{error}</p>;
  }
  if (!summary) {
    return <p className={styles.subLine}>{tr('common.loading')}</p>;
  }

  const statusData = Object.entries(summary.byStatus).map(([status, count]) => ({
    status,
    label: tr(`status.${status}`),
    count,
  }));
  const priorityData = Object.entries(summary.byPriority).map(([priority, count]) => ({ priority, name: tr(`priority.${priority}`), count }));
  const assigneeData = summary.byAssignee.map((a) => ({ name: a.name.split(' ')[0], count: a.count }));

  return (
    <>
      <div className={styles.statCards}>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-text-muted)' }}>
          <div className={styles.statValue}>{summary.totalTasks}</div>
          <div className={styles.statLabel}>{tr('dashboard.totalTasks')}</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-done)' }}>
          <div className={styles.statValue}>{summary.byStatus.done}</div>
          <div className={styles.statLabel}>{tr('dashboard.completedShort')}</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-in-progress)' }}>
          <div className={styles.statValue}>{summary.byStatus.in_progress}</div>
          <div className={styles.statLabel}>{tr('status.in_progress')}</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--priority-high)' }}>
          <div className={`${styles.statValue} ${summary.overdueCount > 0 ? styles.statValueWarn : ''}`}>
            {summary.overdueCount}
          </div>
          <div className={styles.statLabel}>{tr('home.statOverdue')}</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>{tr('dashboard.tasksByStatus')}</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
              <Tooltip {...TOOLTIP_PROPS} />
              <Bar dataKey="count" name={tr('dashboard.tasksSeries')} radius={[4, 4, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>{tr('dashboard.tasksByPriority')}</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={priorityData} dataKey="count" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {priorityData.map((entry) => (
                  <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
              <Tooltip {...TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`${styles.chartCard} ${styles.fullWidth}`}>
          <p className={styles.chartTitle}>{tr('dashboard.openPerMember')}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={assigneeData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="var(--color-text-muted)" fontSize={12} width={80} />
              <Tooltip {...TOOLTIP_PROPS} />
              <Bar dataKey="count" name={tr('dashboard.tasksSeries')} fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.chartCard} style={{ marginTop: 20 }}>
        <p className={styles.chartTitle}>{tr('dashboard.recentActivity')}</p>
        {activity.length === 0 ? (
          <p className={styles.emptyText}>{tr('dashboard.nothingYet')}</p>
        ) : (
          <div>
            {activity.map((a, i) => (
              <div key={i} className={styles.activityItem}>
                <span>
                  <span
                    className={styles.activityDot}
                    style={{ background: a.type === 'task_created' ? 'var(--status-done)' : 'var(--status-review)' }}
                  />
                  <strong>{a.actor_name}</strong> {a.type === 'task_created' ? tr('dashboard.created_') : tr('dashboard.commentedOn')}{' '}
                  <span style={{ color: 'var(--color-accent)' }}>{a.task_title}</span>
                </span>
                <span className={styles.activityTime}>{timeAgo(a.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { projects } = useProject();
  const [projectFilter, setProjectFilter] = useState(
    () => localStorage.getItem(PROJECT_FILTER_STORAGE_KEY) || ALL_PROJECTS
  );
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [range, setRange] = useState(initialRange);

  const showingAllProjects = projectFilter === ALL_PROJECTS;

  function handleProjectFilterChange(value) {
    setProjectFilter(value);
    localStorage.setItem(PROJECT_FILTER_STORAGE_KEY, value);
  }

  function updateRange(next) {
    setRange(next);
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      // storage blocked — the range just won't be remembered
    }
  }

  const rangeInvalid = !range.from || !range.to || range.from > range.to;
  const activePreset = RANGE_PRESETS.find((p) => {
    const [f, to] = p.range();
    return f === range.from && to === range.to;
  });

  useEffect(() => {
    if (!showingAllProjects || rangeInvalid) return;
    setOverview(null);
    setOverviewError('');
    let cancelled = false;
    dashboardApi
      .getOverview(range.from, range.to)
      .then((data) => !cancelled && setOverview(data))
      .catch((err) =>
        !cancelled && setOverviewError(err.response?.data?.message || tr('dashboard.overviewFail'))
      );
    return () => {
      cancelled = true;
    };
  }, [showingAllProjects, range.from, range.to, rangeInvalid]);

  if (projects.length === 0) {
    return (
      <div className={styles.dashScreen}>
        <h1>{tr('nav.dashboard')}</h1>
        <p className={styles.subLine}>{tr('calendar.noProjects')}</p>
      </div>
    );
  }

  const headerTitle = showingAllProjects
    ? tr('calendar.allProjectsTitle')
    : projects.find((p) => p.id === projectFilter)?.name || tr('nav.dashboard');

  return (
    <div className={styles.dashScreen}>
      <div className={styles.header}>
        <div>
          <h1>{headerTitle}</h1>
          <p className={styles.subLine}>
            {showingAllProjects
              ? tr('dashboard.subAll')
              : tr('dashboard.subOne')}
          </p>
        </div>
        <div className={styles.rangeLabel}>
          {tr('calendar.showing')}
          <ProjectSwitcher
            value={projectFilter}
            onChange={handleProjectFilterChange}
            allOption={{ value: ALL_PROJECTS, label: tr('calendar.allProjects') }}
            alignRight
          />
        </div>
      </div>

      {showingAllProjects && (
        <div className={styles.rangeBar}>
          <div className={styles.presetChips}>
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`${styles.presetChip} ${activePreset?.key === p.key ? styles.presetChipActive : ''}`}
                onClick={() => {
                  const [from, to] = p.range();
                  updateRange({ from, to });
                }}
              >
                {tr(p.labelKey)}
              </button>
            ))}
          </div>
          <div className={styles.rangeInputs}>
            <label className={styles.rangeLabel}>
              {tr('calendar.from')}
              <input
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => updateRange({ ...range, from: e.target.value })}
              />
            </label>
            <label className={styles.rangeLabel}>
              {tr('calendar.to')}
              <input
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => updateRange({ ...range, to: e.target.value })}
              />
            </label>
          </div>
        </div>
      )}

      {showingAllProjects ? (
        rangeInvalid ? (
          <p className={styles.subLine}>{tr('dashboard.pickRange')}</p>
        ) : overviewError ? (
          <p style={{ color: 'var(--priority-high)' }}>{overviewError}</p>
        ) : !overview ? (
          <p className={styles.subLine}>{tr('common.loading')}</p>
        ) : (
          <>
            <div className={styles.statCards}>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-text-muted)' }}>
                <div className={styles.statValue}>{overview.totals.projects}</div>
                <div className={styles.statLabel}>{tr('home.projects')}</div>
              </div>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-accent)' }}>
                <div className={styles.statValue}>{overview.totals.tasks}</div>
                <div className={styles.statLabel}>{tr('dashboard.totalAll')}</div>
              </div>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-done)' }}>
                <div className={styles.statValue}>{overview.totals.completed}</div>
                <div className={styles.statLabel}>{tr('dashboard.completedAll')}</div>
              </div>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--priority-high)' }}>
                <div className={`${styles.statValue} ${overview.totals.overdue > 0 ? styles.statValueWarn : ''}`}>
                  {overview.totals.overdue}
                </div>
                <div className={styles.statLabel}>{tr('dashboard.overdueNow')}</div>
              </div>
            </div>

            <AtRiskPanel />

            <PeriodSection title={tr('dashboard.selectedPeriod')} subtitle={formatRangeLabel(range.from, range.to)} data={overview.period} />
          </>
        )
      ) : (
        <SingleProjectDashboard projectId={projectFilter} />
      )}
    </div>
  );
}
