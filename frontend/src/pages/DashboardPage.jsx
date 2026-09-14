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
import styles from './dashboard.module.css';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_COLORS = {
  todo: '#8b9490',
  in_progress: '#c98a3e',
  review: '#6e8fa8',
  done: '#6b9080',
};
const PRIORITY_COLORS = { low: '#7c8985', medium: '#c9a63e', high: '#c9603e' };

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .getSummary()
      .then(setSummary)
      .catch(() => setError('Could not load dashboard data.'));
  }, []);

  if (error) {
    return (
      <div className={styles.dashScreen}>
        <p style={{ color: 'var(--priority-high)' }}>{error}</p>
      </div>
    );
  }

  if (!summary) {
    return <div className={styles.dashScreen}>Loading dashboard…</div>;
  }

  const statusData = Object.entries(summary.byStatus).map(([status, count]) => ({
    status,
    label: STATUS_LABELS[status],
    count,
  }));

  const priorityData = Object.entries(summary.byPriority).map(([priority, count]) => ({
    priority,
    count,
  }));

  const assigneeData = summary.byAssignee.map((a) => ({
    name: a.name.split(' ')[0], // first name keeps bars compact
    count: a.count,
  }));

  return (
    <div className={styles.dashScreen}>
      <h1>Dashboard</h1>
      <p className={styles.subLine}>A snapshot of where the project stands right now.</p>

      <div className={styles.statCards}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{summary.totalTasks}</div>
          <div className={styles.statLabel}>Total tasks</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{summary.byStatus.done}</div>
          <div className={styles.statLabel}>Completed</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{summary.byStatus.in_progress}</div>
          <div className={styles.statLabel}>In progress</div>
        </div>
        <div className={styles.statCard}>
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
              <Tooltip
                contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }}
              />
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
              <Pie
                data={priorityData}
                dataKey="count"
                nameKey="priority"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
              >
                {priorityData.map((entry) => (
                  <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: '#9aa39e' }} />
              <Tooltip
                contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }}
              />
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
              <Tooltip
                contentStyle={{ background: '#2d3231', border: '1px solid #3a403e', fontSize: 13 }}
              />
              <Bar dataKey="count" fill="#c98a3e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
