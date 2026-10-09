import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import * as tasksApi from '../api/tasks';
import * as usersApi from '../api/users';
import * as notificationsApi from '../api/notifications';
import TaskDetailModal from '../components/TaskDetailModal';
import NewProjectModal from '../components/NewProjectModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { getDueCountdown, isOverdue, formatOverdueShort } from '../utils/dueDate';
import styles from './home.module.css';

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
const STATUS_LABELS ={ todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};
const PRIORITY_COLORS = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 2 * 60 * 1000;

// Same deterministic hash-to-color used on Calendar / Dashboard / the project
// switcher, so a project is the same color everywhere in the app.
function colorForProject(projectId) {
  if (!projectId) return 'var(--color-text-muted)';
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 60%, 55%)`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function greeting(now) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// One task line — used in the "My tasks" tabs and the approvals list.
function TaskRow({ task, now, onOpen, actions }) {
  const overdue = isOverdue(task.due_date, task.status, now);
  const countdown = getDueCountdown(task.due_date, now);

  let dueEl = <span className={styles.dueMuted}>No due date</span>;
  if (task.status === 'done') {
    const doneAt = task.completed_at || task.updated_at;
    dueEl = <span className={styles.dueMuted}>Done {timeAgo(doneAt)}</span>;
  } else if (overdue) {
    dueEl = (
      <span className={styles.overduePill} title={countdown.label}>
        Overdue · {formatOverdueShort(task.due_date, now)}
      </span>
    );
  } else if (countdown) {
    dueEl = (
      <span
        className={countdown.urgent ? styles.dueUrgent : styles.dueMuted}
        title={new Date(task.due_date).toLocaleString()}
      >
        {countdown.label}
      </span>
    );
  }

  return (
    <div
      className={`${styles.taskRow} ${overdue ? styles.taskRowOverdue : ''}`}
      style={{ '--project-color': colorForProject(task.project_id) }}
      onClick={() => onOpen(task)}
    >
      <div className={styles.taskMain}>
        <p className={styles.taskTitle}>{task.title}</p>
        <p className={styles.taskMeta}>
          <span className={styles.projectChip} title={`Project: ${task.project_name}`}>
            <span className={styles.projectDot} />
            {task.project_name}
          </span>
          <span
            className={styles.priorityChip}
            style={{ '--chip-color': PRIORITY_COLORS[task.priority] }}
            title={`${PRIORITY_LABELS[task.priority] || task.priority} priority`}
          >
            ⚑ {PRIORITY_LABELS[task.priority] || task.priority}
          </span>
          <span className={styles.statusTag}>{STATUS_LABELS[task.status]}</span>
        </p>
      </div>
      <div className={styles.taskSide} onClick={actions ? (e) => e.stopPropagation() : undefined}>
        {actions || dueEl}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { projects, selectProject, createProject, deleteProject } = useProject();
  const navigate = useNavigate();
  const canApprove = user?.role === 'admin' || user?.role === 'pm';

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(null); // null = pick a sensible default once data is in
  const [selectedTask, setSelectedTask] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { project, total }

  // ticks every minute so countdowns / overdue flags stay live
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const [taskList, userList, notifList] = await Promise.all([
        tasksApi.listTasks(),
        usersApi.listUsers(),
        notificationsApi.listNotifications().catch(() => []),
      ]);
      setTasks(taskList);
      setUsers(userList);
      setNotifications(notifList);
      setError('');
    } catch (err) {
      setError('Could not load your overview. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load, periodic refresh, and a refresh whenever you come back to the tab
  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const data = useMemo(() => {
    const todayStart = startOfDay(now);
    const weekEnd = new Date(todayStart.getTime() + 7 * DAY_MS);
    const mine = tasks.filter((t) => (t.assignees || []).some((a) => a.id === user.id));
    const open = mine.filter((t) => t.status !== 'done');
    const byDue = (a, b) => new Date(a.due_date) - new Date(b.due_date);

    const overdue = open.filter((t) => isOverdue(t.due_date, t.status, now)).sort(byDue);
    const upcoming = open
      .filter((t) => t.due_date && !isOverdue(t.due_date, t.status, now) && new Date(t.due_date) < weekEnd)
      .sort(byDue);
    const dueToday = upcoming.filter((t) => startOfDay(new Date(t.due_date)).getTime() === todayStart.getTime());

    // everything open: overdue first, then by due date, undated last
    const allOpen = [...open].sort((a, b) => {
      const aLate = isOverdue(a.due_date, a.status, now);
      const bLate = isOverdue(b.due_date, b.status, now);
      if (aLate !== bLate) return aLate ? -1 : 1;
      if (a.due_date && b.due_date) return byDue(a, b);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

    const weekAgo = now.getTime() - 7 * DAY_MS;
    const doneRecently = mine
      .filter((t) => t.status === 'done' && new Date(t.completed_at || t.updated_at).getTime() >= weekAgo)
      .sort((a, b) => new Date(b.completed_at || b.updated_at) - new Date(a.completed_at || a.updated_at));

    // next-7-days strip: how many of my open tasks fall due each day
    const strip = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(todayStart.getTime() + i * DAY_MS);
      const count = open.filter((t) => t.due_date && startOfDay(new Date(t.due_date)).getTime() === day.getTime()).length;
      return {
        key: day.toISOString(),
        label: i === 0 ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'short' }),
        dateNum: day.getDate(),
        count,
      };
    });

    const awaitingApproval = tasks.filter((t) => t.status === 'review').sort((a, b) => {
      if (a.due_date && b.due_date) return byDue(a, b);
      return a.due_date ? -1 : b.due_date ? 1 : 0;
    });

    const projectStats = projects.map((p) => {
      const pt = tasks.filter((t) => t.project_id === p.id);
      const done = pt.filter((t) => t.status === 'done').length;
      return {
        project: p,
        total: pt.length,
        done,
        overdue: pt.filter((t) => isOverdue(t.due_date, t.status, now)).length,
        mineOpen: open.filter((t) => t.project_id === p.id).length,
      };
    });

    return { open, overdue, upcoming, dueToday, allOpen, doneRecently, strip, awaitingApproval, projectStats };
  }, [tasks, projects, user.id, now]);

  const tabs = [
    { key: 'overdue', label: 'Overdue', items: data.overdue, empty: 'Nothing overdue — nice work.' },
    { key: 'upcoming', label: 'Due this week', items: data.upcoming, empty: 'Nothing due in the next 7 days.' },
    { key: 'open', label: 'All open', items: data.allOpen, empty: 'No open tasks are assigned to you.' },
    { key: 'done', label: 'Done this week', items: data.doneRecently, empty: "You haven't completed anything in the last 7 days." },
  ];
  const activeKey = tab || (data.overdue.length > 0 ? 'overdue' : 'upcoming');
  const activeTab = tabs.find((t) => t.key === activeKey);

  // ── handlers for the task modal (same behavior as on the Board) ──
  async function handleUpdateTask(id, payload) {
    const updated = await tasksApi.updateTask(id, payload);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setSelectedTask(updated);
  }

  async function handleDeleteTask(id) {
    await tasksApi.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleApprove(taskId) {
    try {
      const updated = await tasksApi.approveTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setSelectedTask((prev) => (prev && prev.id === taskId ? updated : prev));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve that task.');
    }
  }

  async function handleDeny(taskId) {
    const isReopen = tasks.find((t) => t.id === taskId)?.status === 'done';
    const verb = isReopen ? 'reopen' : 'deny';
    let reason = window.prompt('Comment explaining why this task is being sent back to To Do (required):', '');
    if (reason === null) return;
    while (!reason.trim()) {
      reason = window.prompt(`A comment is required to ${verb} a task. Please explain what needs to change:`, '');
      if (reason === null) return;
    }
    try {
      const updated = await tasksApi.denyTask(taskId, reason);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setSelectedTask((prev) => (prev && prev.id === taskId ? updated : prev));
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${verb} that task.`);
    }
  }

  async function handleCreateProject(payload) {
    const created = await createProject(payload);
    load(); // pick up the new project's (empty) stats
    return created;
  }

  async function handleDeleteProject(id) {
    await deleteProject(id);
    load(); // drop the deleted project's tasks from every list and stat
  }

  function openProject(projectId) {
    selectProject(projectId);
    navigate('/board');
  }

  async function handleNotificationClick(n) {
    if (!n.is_read) {
      notificationsApi.markAsRead(n.id).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    const task = n.task_id && tasks.find((t) => t.id === n.task_id);
    if (task) setSelectedTask(task);
  }

  if (loading) {
    return <div className={styles.homeScreen}>Loading your overview…</div>;
  }

  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const summaryParts = [
    `${data.open.length} open task${data.open.length === 1 ? '' : 's'} assigned to you`,
    data.overdue.length > 0 ? `${data.overdue.length} overdue` : null,
    data.dueToday.length > 0 ? `${data.dueToday.length} due today` : null,
  ].filter(Boolean);

  return (
    <div className={styles.homeScreen}>
      <div className={styles.header}>
        <h1>
          {greeting(now)}, {firstName}
        </h1>
        <p className={styles.subLine}>
          {dateLine} · {summaryParts.join(' · ')}
        </p>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.statCards}>
        <button className={`${styles.statCard} ${activeKey === 'open' ? styles.statCardActive : ''}`} onClick={() => setTab('open')}>
          <div className={styles.statValue}>{data.open.length}</div>
          <div className={styles.statLabel}>My open tasks</div>
        </button>
        <button className={`${styles.statCard} ${activeKey === 'overdue' ? styles.statCardActive : ''}`} onClick={() => setTab('overdue')}>
          <div className={`${styles.statValue} ${data.overdue.length > 0 ? styles.statValueWarn : ''}`}>
            {data.overdue.length}
          </div>
          <div className={styles.statLabel}>Overdue</div>
        </button>
        <button className={styles.statCard} onClick={() => setTab('upcoming')} title="Shows tasks due in the next 7 days">
          <div className={styles.statValue}>{data.dueToday.length}</div>
          <div className={styles.statLabel}>Due today</div>
        </button>
        <button className={`${styles.statCard} ${activeKey === 'upcoming' ? styles.statCardActive : ''}`} onClick={() => setTab('upcoming')}>
          <div className={styles.statValue}>{data.upcoming.length}</div>
          <div className={styles.statLabel}>Due this week</div>
        </button>
        <button className={`${styles.statCard} ${activeKey === 'done' ? styles.statCardActive : ''}`} onClick={() => setTab('done')}>
          <div className={styles.statValue}>{data.doneRecently.length}</div>
          <div className={styles.statLabel}>Done this week</div>
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {canApprove && data.awaitingApproval.length > 0 && (
            <section className={`${styles.card} ${styles.approvalCard}`}>
              <p className={styles.cardTitle}>Awaiting your approval ({data.awaitingApproval.length})</p>
              <div className={styles.taskList}>
                {data.awaitingApproval.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    now={now}
                    onOpen={setSelectedTask}
                    actions={
                      <span className={styles.approvalBtns}>
                        <button className={styles.approveBtn} onClick={() => handleApprove(t.id)}>
                          ✓ Approve
                        </button>
                        <button className={styles.denyBtn} onClick={() => handleDeny(t.id)}>
                          ✕ Deny
                        </button>
                      </span>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section className={styles.card}>
            <p className={styles.cardTitle}>My tasks</p>
            <div className={styles.tabs}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className={`${styles.tab} ${t.key === activeKey ? styles.tabActive : ''} ${
                    t.key === 'overdue' && t.items.length > 0 ? styles.tabWarn : ''
                  }`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label} <span className={styles.tabCount}>{t.items.length}</span>
                </button>
              ))}
            </div>
            {activeTab.items.length === 0 ? (
              <p className={styles.emptyText}>{activeTab.empty}</p>
            ) : (
              <div className={styles.taskList}>
                {activeTab.items.map((t) => (
                  <TaskRow key={t.id} task={t} now={now} onOpen={setSelectedTask} />
                ))}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <p className={styles.cardTitle}>Next 7 days</p>
            <div className={styles.strip}>
              {data.strip.map((d, i) => (
                <div key={d.key} className={`${styles.stripDay} ${i === 0 ? styles.stripToday : ''}`}>
                  <span className={styles.stripLabel}>{d.label}</span>
                  <span className={styles.stripDate}>{d.dateNum}</span>
                  <span className={`${styles.stripCount} ${d.count === 0 ? styles.stripCountZero : ''}`}>{d.count}</span>
                </div>
              ))}
            </div>
            <p className={styles.stripHint}>Tasks assigned to you, by due date.</p>
          </section>
        </div>

        <div className={styles.sideCol}>
          <section className={styles.card}>
            <div className={styles.cardHeadRow}>
              <p className={`${styles.cardTitle} ${styles.cardTitleInline}`}>
                Projects <span className={styles.cardHint}>· color = project</span>
              </p>
              {canApprove && (
                <button type="button" className={styles.newProjectBtn} onClick={() => setShowNewProject(true)}>
                  + New project
                </button>
              )}
            </div>
            {data.projectStats.length === 0 ? (
              <p className={styles.emptyText}>
                No projects yet.{canApprove ? ' Click “+ New project” to create one.' : ''}
              </p>
            ) : (
              <div className={styles.projectList}>
                {data.projectStats.map(({ project, total, done, overdue, mineOpen }) => {
                  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                  const color = colorForProject(project.id);
                  return (
                    <div key={project.id} className={styles.projectItemWrap}>
                      <button
                        type="button"
                        className={styles.projectItem}
                        onClick={() => openProject(project.id)}
                        title="Open this project's board"
                      >
                        <div className={styles.projectTop}>
                          <span className={styles.projectDotLg} style={{ background: color }} />
                          <span className={styles.projectName} title={project.name}>
                            {project.name}
                          </span>
                          <span className={styles.projectPct}>{pct}%</span>
                        </div>
                        <div className={styles.progressTrack}>
                          <div className={styles.progressFill} style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <p className={styles.projectMeta}>
                          <span>{done}/{total} done</span>
                          {mineOpen > 0 && <span>{mineOpen} assigned to you</span>}
                          {overdue > 0 && <span className={styles.projectOverdue}>{overdue} overdue</span>}
                        </p>
                      </button>
                      {canApprove && (
                        <button
                          type="button"
                          className={styles.projectDeleteBtn}
                          title={`Delete "${project.name}"`}
                          aria-label={`Delete "${project.name}"`}
                          onClick={() => setDeleteTarget({ project, total })}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <p className={styles.cardTitle}>Recent updates</p>
            {notifications.length === 0 ? (
              <p className={styles.emptyText}>You're all caught up.</p>
            ) : (
              <div className={styles.notifList}>
                {notifications.slice(0, 6).map((n) => (
                  <button
                    key={n.id}
                    className={`${styles.notifItem} ${!n.is_read ? styles.notifUnread : ''}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <p className={styles.notifMessage}>{n.message}</p>
                    <span className={styles.notifTime}>{timeAgo(n.created_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          canApprove={canApprove}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}

      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={handleCreateProject} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete project"
          message={`This permanently deletes "${deleteTarget.project.name}" and all ${deleteTarget.total} task${
            deleteTarget.total === 1 ? '' : 's'
          } in it. This cannot be undone.`}
          confirmLabel="Delete project"
          danger
          requireText={deleteTarget.project.name}
          onConfirm={() => handleDeleteProject(deleteTarget.project.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
