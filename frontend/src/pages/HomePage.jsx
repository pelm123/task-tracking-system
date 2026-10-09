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
import { notificationMeta } from '../utils/notificationTypes';
import { getDueCountdown, isOverdue, formatOverdueShort } from '../utils/dueDate';
import { timeAgo } from '../utils/dateTime';
import { t, getLocale } from '../i18n';
import styles from './home.module.css';
import { colorForProject } from '../utils/projectColor';

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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function greeting(now) {
  const h = now.getHours();
  if (h < 5) return t('home.night');
  if (h < 12) return t('home.morning');
  if (h < 18) return t('home.afternoon');
  if (h < 21) return t('home.evening');
  return t('home.night');
}

// One task line — used in the "My tasks" tabs and the approvals list.
function TaskRow({ task, now, onOpen, actions }) {
  const overdue = isOverdue(task.due_date, task.status, now);
  const countdown = getDueCountdown(task.due_date, now);

  let dueEl = <span className={styles.dueMuted}>{t('home.noDueDate')}</span>;
  if (task.status === 'done') {
    const doneAt = task.completed_at || task.updated_at;
    dueEl = <span className={styles.dueMuted}>{t('home.doneAgo', { time: timeAgo(doneAt) })}</span>;
  } else if (overdue) {
    dueEl = (
      <span className={styles.overduePill} title={countdown.label}>
        {t('home.overduePill', { text: formatOverdueShort(task.due_date, now) })}
      </span>
    );
  } else if (countdown) {
    dueEl = (
      <span
        className={countdown.urgent ? styles.dueUrgent : styles.dueMuted}
        title={new Date(task.due_date).toLocaleString(getLocale())}
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
          <span className={styles.projectChip} title={t('home.projectTitle', { name: task.project_name })}>
            <span className={styles.projectDot} />
            {task.project_name}
          </span>
          <span
            className={styles.priorityChip}
            style={{ '--chip-color': PRIORITY_COLORS[task.priority] }}
            title={t('home.priorityTitle', { label: t(`priority.${task.priority}`) })}
          >
            ⚑ {t(`priority.${task.priority}`)}
          </span>
          <span className={styles.statusTag}>{t(`status.${task.status}`)}</span>
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
      setError(t('home.loadFail'));
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
        label: i === 0 ? t('home.today') : day.toLocaleDateString(getLocale(), { weekday: 'short' }),
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
    { key: 'overdue', label: t('home.tabOverdue'), items: data.overdue, empty: t('home.emptyOverdue') },
    { key: 'upcoming', label: t('home.tabUpcoming'), items: data.upcoming, empty: t('home.emptyUpcoming') },
    { key: 'open', label: t('home.tabOpen'), items: data.allOpen, empty: t('home.emptyOpen') },
    { key: 'done', label: t('home.tabDone'), items: data.doneRecently, empty: t('home.emptyDone') },
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
      setError(err.response?.data?.message || t('home.approveFail'));
    }
  }

  async function handleDeny(taskId) {
    const isReopen = tasks.find((t) => t.id === taskId)?.status === 'done';
    let reason = window.prompt(t('home.promptSendBack'), '');
    if (reason === null) return;
    while (!reason.trim()) {
      reason = window.prompt(t(isReopen ? 'home.promptRequiredReopen' : 'home.promptRequiredDeny'), '');
      if (reason === null) return;
    }
    try {
      const updated = await tasksApi.denyTask(taskId, reason);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setSelectedTask((prev) => (prev && prev.id === taskId ? updated : prev));
    } catch (err) {
      setError(err.response?.data?.message || t(isReopen ? 'home.reopenFail' : 'home.denyFail'));
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
    return <div className={styles.homeScreen}>{t('home.loading')}</div>;
  }

  const firstName = (user?.name || '').split(' ')[0] || t('home.there');
  const dateLine = now.toLocaleDateString(getLocale(), { weekday: 'long', month: 'long', day: 'numeric' });
  const summaryParts = [
    t('home.openAssigned', { count: data.open.length }),
    data.overdue.length > 0 ? t('home.overdueN', { count: data.overdue.length }) : null,
    data.dueToday.length > 0 ? t('home.dueTodayN', { count: data.dueToday.length }) : null,
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
          <div className={styles.statLabel}>{t('home.statOpen')}</div>
        </button>
        <button className={`${styles.statCard} ${activeKey === 'overdue' ? styles.statCardActive : ''}`} onClick={() => setTab('overdue')}>
          <div className={`${styles.statValue} ${data.overdue.length > 0 ? styles.statValueWarn : ''}`}>
            {data.overdue.length}
          </div>
          <div className={styles.statLabel}>{t('home.statOverdue')}</div>
        </button>
        <button className={styles.statCard} onClick={() => setTab('upcoming')} title={t('home.statTodayHint')}>
          <div className={styles.statValue}>{data.dueToday.length}</div>
          <div className={styles.statLabel}>{t('home.statToday')}</div>
        </button>
        <button className={`${styles.statCard} ${activeKey === 'upcoming' ? styles.statCardActive : ''}`} onClick={() => setTab('upcoming')}>
          <div className={styles.statValue}>{data.upcoming.length}</div>
          <div className={styles.statLabel}>{t('home.statWeek')}</div>
        </button>
        <button className={`${styles.statCard} ${activeKey === 'done' ? styles.statCardActive : ''}`} onClick={() => setTab('done')}>
          <div className={styles.statValue}>{data.doneRecently.length}</div>
          <div className={styles.statLabel}>{t('home.statDone')}</div>
        </button>
      </div>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {canApprove && data.awaitingApproval.length > 0 && (
            <section className={`${styles.card} ${styles.approvalCard}`}>
              <p className={styles.cardTitle}>{t('home.awaiting', { count: data.awaitingApproval.length })}</p>
              <div className={styles.taskList}>
                {data.awaitingApproval.map((item) => (
                  <TaskRow
                    key={item.id}
                    task={item}
                    now={now}
                    onOpen={setSelectedTask}
                    actions={
                      <span className={styles.approvalBtns}>
                        <button className={styles.approveBtn} onClick={() => handleApprove(item.id)}>
                          {t('home.approve')}
                        </button>
                        <button className={styles.denyBtn} onClick={() => handleDeny(item.id)}>
                          {t('home.deny')}
                        </button>
                      </span>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section className={styles.card}>
            <p className={styles.cardTitle}>{t('home.myTasks')}</p>
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
            <p className={styles.cardTitle}>{t('home.next7')}</p>
            <div className={styles.strip}>
              {data.strip.map((d, i) => (
                <div key={d.key} className={`${styles.stripDay} ${i === 0 ? styles.stripToday : ''}`}>
                  <span className={styles.stripLabel}>{d.label}</span>
                  <span className={styles.stripDate}>{d.dateNum}</span>
                  <span className={`${styles.stripCount} ${d.count === 0 ? styles.stripCountZero : ''}`}>{d.count}</span>
                </div>
              ))}
            </div>
            <p className={styles.stripHint}>{t('home.stripHint')}</p>
          </section>
        </div>

        <div className={styles.sideCol}>
          <section className={styles.card}>
            <div className={styles.cardHeadRow}>
              <p className={`${styles.cardTitle} ${styles.cardTitleInline}`}>
                {t('home.projects')} <span className={styles.cardHint}>{t('home.colorHint')}</span>
              </p>
              {canApprove && (
                <button type="button" className={styles.newProjectBtn} onClick={() => setShowNewProject(true)}>
                  {t('home.newProject')}
                </button>
              )}
            </div>
            {data.projectStats.length === 0 ? (
              <p className={styles.emptyText}>
                {t('home.noProjects')}
                {canApprove ? t('home.noProjectsHint') : ''}
              </p>
            ) : (
              <div className={styles.projectList}>
                {data.projectStats.map(({ project, total, done, overdue, mineOpen }) => {
                  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                  const color = colorForProject(project.id);
                  return (
                    <div key={project.id} className={`${styles.projectItemWrap} ${canApprove ? styles.hasDelete : ''}`}>
                      <button
                        type="button"
                        className={styles.projectItem}
                        onClick={() => openProject(project.id)}
                        title={t('home.openBoardTitle')}
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
                          <span>{t('home.doneOf', { done, total })}</span>
                          {mineOpen > 0 && <span>{t('home.assignedToYou', { n: mineOpen })}</span>}
                          {overdue > 0 && <span className={styles.projectOverdue}>{t('home.projectOverdue', { n: overdue })}</span>}
                        </p>
                      </button>
                      {canApprove && (
                        <button
                          type="button"
                          className={styles.projectDeleteBtn}
                          title={t('home.deleteProjectTitle', { name: project.name })}
                          aria-label={t('home.deleteProjectTitle', { name: project.name })}
                          onClick={() => setDeleteTarget({ project, total })}
                        >
                          <span aria-hidden="true">🗑</span> {t('home.deleteBtn')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <p className={styles.cardTitle}>{t('home.recent')}</p>
            {notifications.length === 0 ? (
              <p className={styles.emptyText}>{t('home.caughtUp')}</p>
            ) : (
              <div className={styles.notifList}>
                {notifications.slice(0, 6).map((n) => (
                  <button
                    key={n.id}
                    className={`${styles.notifItem} ${!n.is_read ? styles.notifUnread : ''}`}
                    style={{ '--n-color': notificationMeta(n.type).color }}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <p className={styles.notifMessage}>
                      <span className={styles.notifTag}>{notificationMeta(n.type).label}</span>
                      {n.message}
                    </p>
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

      {/* an empty project needs one click; one with tasks needs the word "delete" */}
      {deleteTarget && (
        <ConfirmDialog
          title={t('home.deleteTitle')}
          message={
            deleteTarget.total === 0
              ? t('home.deleteEmpty', { name: deleteTarget.project.name })
              : t('home.deleteWithTasks', { name: deleteTarget.project.name, count: deleteTarget.total })
          }
          confirmLabel={t('common.delete')}
          danger
          requireText={deleteTarget.total === 0 ? undefined : t('home.deleteWord')}
          onConfirm={() => handleDeleteProject(deleteTarget.project.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
