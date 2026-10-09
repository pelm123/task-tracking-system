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

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_COLORS = {
  todo: '#8b9490',
  in_progress: '#c98a3e',
  review: '#6e8fa8',
  done: '#6b9080',
};
const PRIORITY_COLORS = { low: '#7c8985', medium: '#c9a63e', high: '#c9603e' };

const ALL_PROJECTS = 'all';
const PROJECT_FILTER_STORAGE_KEY = 'dashboardProjectFilter';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

// One period's report (This Month, or the fiscal year) — stat cards, a
// status/priority breakdown, and a per-project / per-assignee rundown.
// Shared between both periods on the "All projects" view.
function PeriodSection({ title, subtitle, data }) {
  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status],
    count,
  }));
  const priorityData = Object.entries(data.byPriority).map(([priority, count]) => ({ priority, count }));
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
          <div className={styles.statLabel}>Tasks created</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-done)' }}>
          <div className={styles.statValue}>{data.totalCompleted}</div>
          <div className={styles.statLabel}>Tasks completed</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--priority-high)' }}>
          <div className={`${styles.statValue} ${data.overdueCount > 0 ? styles.statValueWarn : ''}`}>
            {data.overdueCount}
          </div>
          <div className={styles.statLabel}>Overdue</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-text-muted)' }}>
          <div className={styles.statValue}>{pct(data.totalCompleted, data.totalCreated)}%</div>
          <div className={styles.statLabel}>Completion rate</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By status</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a403e" vertical={false} />
              <XAxis dataKey="label" stroke="#9aa39e" fontSize={12} />
              <YAxis stroke="#9aa39e" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By priority</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={priorityData} dataKey="count" nameKey="priority" innerRadius={42} outerRadius={68} paddingAngle={3}>
                {priorityData.map((entry) => (
                  <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: '#9aa39e' }} />
              <Tooltip contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.rundownGrid}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By project</p>
          {data.byProject.length === 0 ? (
            <p className={styles.emptyText}>No tasks in this period.</p>
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
                    {p.completed}/{p.total} done
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>By team member</p>
          {data.byAssignee.length === 0 ? (
            <p className={styles.emptyText}>No assigned tasks in this period.</p>
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
                    {a.total} task{a.total === 1 ? '' : 's'}
                    {a.overdue > 0 && <span className={styles.rundownOverdue}> · {a.overdue} overdue</span>}
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
      .catch(() => setError('Could not load dashboard data.'));
    projectsApi.getActivity(projectId).then(setActivity).catch(() => {});
  }, [projectId]);

  if (error) {
    return <p style={{ color: 'var(--priority-high)' }}>{error}</p>;
  }
  if (!summary) {
    return <p className={styles.subLine}>Loading…</p>;
  }

  const statusData = Object.entries(summary.byStatus).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status],
    count,
  }));
  const priorityData = Object.entries(summary.byPriority).map(([priority, count]) => ({ priority, count }));
  const assigneeData = summary.byAssignee.map((a) => ({ name: a.name.split(' ')[0], count: a.count }));

  return (
    <>
      <div className={styles.statCards}>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-text-muted)' }}>
          <div className={styles.statValue}>{summary.totalTasks}</div>
          <div className={styles.statLabel}>Total tasks</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-done)' }}>
          <div className={styles.statValue}>{summary.byStatus.done}</div>
          <div className={styles.statLabel}>Completed</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-in-progress)' }}>
          <div className={styles.statValue}>{summary.byStatus.in_progress}</div>
          <div className={styles.statLabel}>In progress</div>
        </div>
        <div className={styles.statCard} style={{ '--stat-accent': 'var(--priority-high)' }}>
          <div className={`${styles.statValue} ${summary.overdueCount > 0 ? styles.statValueWarn : ''}`}>
            {summary.overdueCount}
          </div>
          <div className={styles.statLabel}>Overdue</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Tasks by status</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a403e" vertical={false} />
              <XAxis dataKey="label" stroke="#9aa39e" fontSize={12} />
              <YAxis stroke="#9aa39e" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {statusData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Tasks by priority</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={priorityData} dataKey="count" nameKey="priority" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {priorityData.map((entry) => (
                  <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: '#9aa39e' }} />
              <Tooltip contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`${styles.chartCard} ${styles.fullWidth}`}>
          <p className={styles.chartTitle}>Open tasks per team member</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={assigneeData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a403e" horizontal={false} />
              <XAxis type="number" stroke="#9aa39e" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="#9aa39e" fontSize={12} width={80} />
              <Tooltip contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }} />
              <Bar dataKey="count" fill="#c98a3e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.chartCard} style={{ marginTop: 20 }}>
        <p className={styles.chartTitle}>Recent activity</p>
        {activity.length === 0 ? (
          <p className={styles.emptyText}>Nothing yet.</p>
        ) : (
          <div>
            {activity.map((a, i) => (
              <div key={i} className={styles.activityItem}>
                <span>
                  <span
                    className={styles.activityDot}
                    style={{ background: a.type === 'task_created' ? 'var(--status-done)' : 'var(--status-review)' }}
                  />
                  <strong>{a.actor_name}</strong> {a.type === 'task_created' ? 'created' : 'commented on'}{' '}
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

  const showingAllProjects = projectFilter === ALL_PROJECTS;

  function handleProjectFilterChange(value) {
    setProjectFilter(value);
    localStorage.setItem(PROJECT_FILTER_STORAGE_KEY, value);
  }

  useEffect(() => {
    if (!showingAllProjects) return;
    setOverview(null);
    setOverviewError('');
    dashboardApi
      .getOverview()
      .then(setOverview)
      .catch(() => setOverviewError('Could not load the consolidated report.'));
  }, [showingAllProjects]);

  if (projects.length === 0) {
    return (
      <div className={styles.dashScreen}>
        <h1>Dashboard</h1>
        <p className={styles.subLine}>No projects yet.</p>
      </div>
    );
  }

  const headerTitle = showingAllProjects
    ? 'All Projects'
    : projects.find((p) => p.id === projectFilter)?.name || 'Dashboard';

  return (
    <div className={styles.dashScreen}>
      <div className={styles.header}>
        <div>
          <h1>{headerTitle}</h1>
          <p className={styles.subLine}>
            {showingAllProjects
              ? 'A consolidated snapshot across every project — this month and this fiscal year.'
              : 'A snapshot of where this project stands right now.'}
          </p>
        </div>
        <label className={styles.rangeLabel}>
          Showing
          <select value={projectFilter} onChange={(e) => handleProjectFilterChange(e.target.value)}>
            <option value={ALL_PROJECTS}>All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showingAllProjects ? (
        overviewError ? (
          <p style={{ color: 'var(--priority-high)' }}>{overviewError}</p>
        ) : !overview ? (
          <p className={styles.subLine}>Loading…</p>
        ) : (
          <>
            <div className={styles.statCards}>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-text-muted)' }}>
                <div className={styles.statValue}>{overview.totals.projects}</div>
                <div className={styles.statLabel}>Projects</div>
              </div>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--color-accent)' }}>
                <div className={styles.statValue}>{overview.totals.tasks}</div>
                <div className={styles.statLabel}>Total tasks (all time)</div>
              </div>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--status-done)' }}>
                <div className={styles.statValue}>{overview.totals.completed}</div>
                <div className={styles.statLabel}>Completed (all time)</div>
              </div>
              <div className={styles.statCard} style={{ '--stat-accent': 'var(--priority-high)' }}>
                <div className={`${styles.statValue} ${overview.totals.overdue > 0 ? styles.statValueWarn : ''}`}>
                  {overview.totals.overdue}
                </div>
                <div className={styles.statLabel}>Overdue right now</div>
              </div>
            </div>

            <PeriodSection title="This Month" subtitle={overview.month.label} data={overview.month} />
            <PeriodSection title="Fiscal Year" subtitle={overview.fiscalYear.label} data={overview.fiscalYear} />
          </>
        )
      ) : (
        <SingleProjectDashboard projectId={projectFilter} />
      )}
    </div>
  );
}
