import { useEffect, useMemo, useState, useCallback } from 'react';
import { useProject } from '../context/ProjectContext';
import * as tasksApi from '../api/tasks';
import * as usersApi from '../api/users';
import TaskDetailModal from '../components/TaskDetailModal';
import styles from './calendar.module.css';

const PRIORITY_COLORS = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(date) {
  // local-time Y-M-D key, so this lines up with how <input type="date"> values compare
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// builds just as many weeks as the month actually needs (5 or 6), from the
// Sunday on/before the 1st through the Saturday on/after the last day —
// no trailing dead week of entirely-next-month cells.
function buildMonthGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - first.getDay());

  const gridEnd = new Date(last);
  gridEnd.setDate(gridEnd.getDate() + (6 - last.getDay()));

  const days = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function formatMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CalendarPage() {
  const { currentProjectId, currentProject } = useProject();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);

  const loadTasks = useCallback(async () => {
    if (!currentProjectId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await tasksApi.listTasks({ project_id: currentProjectId });
      setTasks(data.filter((t) => t.due_date));
    } catch (err) {
      setError('Could not load tasks. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadTasks();
    usersApi.listUsers().then(setUsers).catch(() => {});
  }, [loadTasks]);

  // tasks grouped by local day-key for fast grid lookups
  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      const key = toDateKey(new Date(t.due_date));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return map;
  }, [tasks]);

  const hasRange = Boolean(rangeStart && rangeEnd);

  function isInRange(dateKey) {
    if (!hasRange) return false;
    return dateKey >= rangeStart && dateKey <= rangeEnd;
  }

  const rangeTasks = useMemo(() => {
    if (!hasRange) return [];
    return tasks
      .filter((t) => {
        const key = toDateKey(new Date(t.due_date));
        return key >= rangeStart && key <= rangeEnd;
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }, [tasks, rangeStart, rangeEnd, hasRange]);

  const days = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const todayKey = toDateKey(new Date());

  function goToMonth(offset) {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  // First click starts a fresh single-day selection. A second click (on a
  // different day) completes the range, in whichever order the two were
  // clicked. The click after that starts a new single-day selection again —
  // so you always "click a start, click an end" rather than every click
  // collapsing whatever range you'd already built.
  function selectDay(dateKey) {
    const pickingEnd = rangeStart && rangeStart === rangeEnd;
    if (!pickingEnd) {
      setRangeStart(dateKey);
      setRangeEnd(dateKey);
    } else if (dateKey < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(dateKey);
    } else {
      setRangeEnd(dateKey);
    }
  }

  function clearRange() {
    setRangeStart('');
    setRangeEnd('');
  }

  async function handleUpdateTask(id, payload) {
    const updated = await tasksApi.updateTask(id, payload);
    setTasks((prev) => {
      const withoutOld = prev.filter((t) => t.id !== id);
      return updated.due_date ? [...withoutOld, updated] : withoutOld;
    });
    setSelectedTask(updated);
  }

  async function handleDeleteTask(id) {
    await tasksApi.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) {
    return <div className={styles.screen}>Loading calendar…</div>;
  }

  if (!currentProjectId) {
    return (
      <div className={styles.screen}>
        <h1>Calendar</h1>
        <p className={styles.subLine}>No project selected yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <h1>{currentProject?.name || 'Calendar'}</h1>
          <p className={styles.subLine}>
            Click a day, then another, to select a range — or set exact dates on the right.
          </p>
        </div>
      </div>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}

      <div className={styles.toolbar}>
        <div className={styles.monthNav}>
          <button className="btn btn-secondary" onClick={() => goToMonth(-1)}>
            ‹
          </button>
          <span className={styles.monthLabel}>{formatMonthLabel(monthCursor)}</span>
          <button className="btn btn-secondary" onClick={() => goToMonth(1)}>
            ›
          </button>
          <button className="btn btn-ghost" onClick={() => setMonthCursor(startOfMonth(new Date()))}>
            Today
          </button>
        </div>

        <div className={styles.rangePicker}>
          <label className={styles.rangeLabel}>
            From
            <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </label>
          <label className={styles.rangeLabel}>
            To
            <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </label>
          {hasRange && (
            <button className="btn btn-ghost" onClick={clearRange}>
              Clear range
            </button>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className={styles.weekdayCell}>
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = toDateKey(day);
          const inCurrentMonth = day.getMonth() === monthCursor.getMonth();
          const dayTasks = tasksByDay.get(key) || [];
          const visibleTasks = dayTasks.slice(0, 3);
          const overflow = dayTasks.length - visibleTasks.length;

          return (
            <div
              key={key}
              className={[
                styles.dayCell,
                !inCurrentMonth ? styles.dayCellMuted : '',
                key === todayKey ? styles.dayCellToday : '',
                isInRange(key) ? styles.dayCellInRange : '',
              ].join(' ')}
              onClick={() => selectDay(key)}
            >
              <span className={styles.dayNumber}>{day.getDate()}</span>
              <div className={styles.dayTasks}>
                {visibleTasks.map((t) => (
                  <div
                    key={t.id}
                    className={styles.taskChip}
                    style={{ borderLeftColor: PRIORITY_COLORS[t.priority] }}
                    title={t.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(t);
                    }}
                  >
                    {t.title}
                  </div>
                ))}
                {overflow > 0 && <div className={styles.taskOverflow}>+{overflow} more</div>}
              </div>
            </div>
          );
        })}
      </div>

      {hasRange && (
        <div className={styles.rangeResults}>
          <p className={styles.sectionTitle}>
            {rangeTasks.length} task{rangeTasks.length === 1 ? '' : 's'} due {rangeStart === rangeEnd ? 'on' : 'between'}{' '}
            {rangeStart === rangeEnd ? formatShortDate(rangeStart) : `${formatShortDate(rangeStart)} – ${formatShortDate(rangeEnd)}`}
          </p>
          {rangeTasks.length === 0 ? (
            <p className={styles.emptyText}>No tasks due in this range.</p>
          ) : (
            <div className={styles.rangeList}>
              {rangeTasks.map((t) => (
                <div key={t.id} className={styles.rangeItem} onClick={() => setSelectedTask(t)}>
                  <span
                    className={styles.rangePriorityDot}
                    style={{ background: PRIORITY_COLORS[t.priority] }}
                  />
                  <span className={styles.rangeTitle}>{t.title}</span>
                  <span className={styles.rangeMeta}>
                    {t.assignees && t.assignees.length > 0
                      ? t.assignees.map((a) => a.name).join(', ')
                      : 'Unassigned'}
                  </span>
                  <span className={styles.rangeMeta}>{formatShortDate(t.due_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}
