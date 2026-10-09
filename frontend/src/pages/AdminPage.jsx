import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as usersApi from '../api/users';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import { useProject } from '../context/ProjectContext';
import { colorForProject } from '../utils/projectColor';
import TaskDetailModal from '../components/TaskDetailModal';
import NewTaskModal from '../components/NewTaskModal';
import NewProjectModal from '../components/NewProjectModal';
import EditProjectModal from '../components/EditProjectModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { isOverdue } from '../utils/dueDate';
import { formatDateTime } from '../utils/dateTime';
import { t as tr, getLocale } from '../i18n';
import styles from './admin.module.css';

const STATUS_KEYS = ['todo', 'in_progress', 'review', 'done'];
const PRIORITY_KEYS = ['low', 'medium', 'high'];
const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const { projects, refresh: refreshProjects } = useProject();
  const isAdmin = currentUser.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'users' : 'tasks');

  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]); // sign-ups waiting for approval (admin only)
  const [busyId, setBusyId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedUserId, setSavedUserId] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // users tab filters
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // tasks tab filters
  const [taskSearch, setTaskSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // task selection / detail / creation
  const [selectedIds, setSelectedIds] = useState([]);
  const [openTask, setOpenTask] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pickProjectOpen, setPickProjectOpen] = useState(false);
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [pickedProjectId, setPickedProjectId] = useState('');

  // projects
  const [showNewProject, setShowNewProject] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState(null);

  // dialogs
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([
      usersApi.listUsers(),
      tasksApi.listTasks(),
      isAdmin ? usersApi.listPendingUsers() : Promise.resolve([]),
    ])
      .then(([u, t, p]) => {
        setUsers(u);
        setTasks(t);
        setPending(p);
        if (p.length > 0) setTab('users'); // land on the approval queue first
      })
      .catch(() => setError(tr('admin.loadFail')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice((current) => (current === message ? '' : current)), 3500);
  }

  // ---- per-user workload, from the task list we already have ----
  const workload = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (t.status === 'done') return;
      (t.assignees || []).forEach((a) => {
        const entry = map.get(a.id) || { open: 0, overdue: 0 };
        entry.open += 1;
        if (isOverdue(t.due_date, t.status, now)) entry.overdue += 1;
        map.set(a.id, entry);
      });
    });
    return map;
  }, [tasks, now]);

  const roleCounts = useMemo(() => {
    const counts = { admin: 0, pm: 0, member: 0 };
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, userSearch, roleFilter]);

  const projectOptions = useMemo(() => {
    const seen = new Map();
    tasks.forEach((t) => {
      if (t.project_id && !seen.has(t.project_id)) seen.set(t.project_id, t.project_name);
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      if (projectFilter && t.project_id !== projectFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter === '__none__' && (t.assignees || []).length > 0) return false;
      if (assigneeFilter && assigneeFilter !== '__none__' && !(t.assignees || []).some((a) => a.id === assigneeFilter))
        return false;
      if (overdueOnly && !isOverdue(t.due_date, t.status, now)) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, taskSearch, projectFilter, statusFilter, priorityFilter, assigneeFilter, overdueOnly, now]);

  const tasksFiltered = taskSearch || projectFilter || statusFilter || priorityFilter || assigneeFilter || overdueOnly;

  function clearTaskFilters() {
    setTaskSearch('');
    setProjectFilter('');
    setStatusFilter('');
    setPriorityFilter('');
    setAssigneeFilter('');
    setOverdueOnly(false);
  }

  const projectStats = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const e = map.get(t.project_id) || { total: 0, done: 0, overdue: 0 };
      e.total += 1;
      if (t.status === 'done') e.done += 1;
      if (isOverdue(t.due_date, t.status, now)) e.overdue += 1;
      map.set(t.project_id, e);
    });
    return map;
  }, [tasks, now]);

  // ---- actions ----
  async function reloadTasks() {
    setTasks(await tasksApi.listTasks());
  }

  async function handleCreateProject(payload) {
    await projectsApi.createProject(payload);
    await refreshProjects();
    flash(tr('admin.projectCreated'));
  }

  async function handleSaveProject(id, payload) {
    await projectsApi.updateProject(id, payload);
    await refreshProjects();
    await reloadTasks(); // task rows show the project name
    flash(tr('admin.projectSaved'));
  }

  async function handleDeleteProject(id) {
    await projectsApi.deleteProject(id);
    setTasks((prev) => prev.filter((t) => t.project_id !== id));
    setSelectedIds([]);
    if (projectFilter === id) setProjectFilter('');
    await refreshProjects();
    flash(tr('admin.projectDeleted'));
  }

  function viewProjectTasks(projectId) {
    clearTaskFilters();
    setProjectFilter(projectId);
    setTab('tasks');
  }

  // ---- task detail + bulk actions ----
  async function handleUpdateTask(id, payload) {
    const updated = await tasksApi.updateTask(id, payload);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setOpenTask(updated);
  }

  async function handleApproveTask(taskId) {
    try {
      const updated = await tasksApi.approveTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setOpenTask((prev) => (prev && prev.id === taskId ? updated : prev));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || tr('home.approveFail'));
    }
  }

  async function handleDenyTask(taskId) {
    const isReopen = tasks.find((t) => t.id === taskId)?.status === 'done';
    let reason = window.prompt(tr('home.promptSendBack'), '');
    if (reason === null) return;
    while (!reason.trim()) {
      reason = window.prompt(tr(isReopen ? 'home.promptRequiredReopen' : 'home.promptRequiredDeny'), '');
      if (reason === null) return;
    }
    try {
      const updated = await tasksApi.denyTask(taskId, reason);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setOpenTask((prev) => (prev && prev.id === taskId ? updated : prev));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || tr('admin.sendBackFail'));
    }
  }

  async function handleCreateTask(payload) {
    const created = await tasksApi.createTask({ ...payload, project_id: newTaskProjectId });
    setTasks((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
    refreshProjects(); // keeps the per-project task counts fresh
    flash(tr('admin.taskCreated'));
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBulkStatus(status) {
    try {
      await tasksApi.bulkUpdateStatus(selectedIds, status);
      await reloadTasks();
      setSelectedIds([]);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || tr('admin.moveFail'));
    }
  }

  async function handleBulkAssign(value) {
    try {
      await tasksApi.bulkAssign(selectedIds, value === '__clear__' ? null : value);
      await reloadTasks();
      setSelectedIds([]);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || tr('admin.assignFail'));
    }
  }

  async function handleBulkDelete() {
    await tasksApi.bulkDelete(selectedIds);
    setTasks((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
    setSelectedIds([]);
    refreshProjects();
    setError('');
  }

  async function handleRoleChange(userId, role) {
    try {
      const updated = await usersApi.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setSavedUserId(userId);
      setTimeout(() => setSavedUserId((current) => (current === userId ? null : current)), 1500);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || tr('admin.roleFail'));
    }
  }

  async function handleApprove(person) {
    setBusyId(person.id);
    try {
      const approved = await usersApi.approveUser(person.id);
      setPending((prev) => prev.filter((p) => p.id !== person.id));
      setUsers((prev) => [...prev, approved].sort((a, b) => a.name.localeCompare(b.name)));
      setError('');
      flash(tr('admin.canLogin', { name: person.name }));
    } catch (err) {
      setError(err.response?.data?.message || tr('admin.approveAccountFail'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(person) {
    if (
      !window.confirm(tr('admin.rejectConfirm', { name: person.name, email: person.email }))
    )
      return;
    setBusyId(person.id);
    try {
      await usersApi.deleteUser(person.id);
      setPending((prev) => prev.filter((p) => p.id !== person.id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || tr('admin.rejectFail'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteUser(userId) {
    await usersApi.deleteUser(userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setTasks((prev) => prev.filter((t) => t.created_by !== userId));
    setError('');
  }

  async function handleDeleteTask(taskId) {
    await tasksApi.deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedIds((prev) => prev.filter((id) => id !== taskId));
    refreshProjects();
    setError('');
  }

  function openReset(person) {
    setResetTarget(person);
    setResetPassword('');
    setResetError('');
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (resetPassword.length < 6) {
      setResetError(tr('admin.pwMin'));
      return;
    }
    setResetBusy(true);
    try {
      await usersApi.resetUserPassword(resetTarget.id, resetPassword);
      flash(tr('admin.pwUpdated', { name: resetTarget.name }));
      setResetTarget(null);
    } catch (err) {
      setResetError(err.response?.data?.message || tr('admin.resetFail'));
    } finally {
      setResetBusy(false);
    }
  }

  function exportTasksCsv() {
    const header = [
      tr('modal.title'),
      tr('admin.colProject'),
      tr('list.status'),
      tr('list.priority'),
      tr('list.assignees'),
      tr('admin.colCreatedBy'),
      tr('list.due'),
      tr('admin.colCreated'),
    ];
    const rows = filteredTasks.map((t) => [
      t.title,
      t.project_name,
      tr(`status.${t.status}`),
      tr(`priority.${t.priority}`),
      (t.assignees || []).map((a) => a.name).join('; '),
      t.creator_name,
      t.due_date ? formatDateTime(t.due_date) : '',
      t.created_at ? formatDateTime(t.created_at) : '',
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    // the BOM makes Excel read the Thai text as UTF-8
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className={styles.adminScreen}>{tr('admin.loading')}</div>;
  }

  const tasksCreatedBy = (userId) => tasks.filter((t) => t.created_by === userId).length;

  return (
    <div className={styles.adminScreen}>
      <h1>{tr('nav.admin')}</h1>
      <p className={styles.subLine}>
        {isAdmin
          ? tr('admin.subAdmin')
          : tr('admin.subPm')}
      </p>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.tabs}>
        {isAdmin && (
          <button
            className={`${styles.tabBtn} ${tab === 'users' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('users')}
          >
            {tr('admin.tabUsers')} <span className={styles.muted}>({users.length})</span>
            {pending.length > 0 && <span className={styles.pendingBadge}>{tr('admin.newN', { n: pending.length })}</span>}
          </button>
        )}
        <button
          className={`${styles.tabBtn} ${tab === 'projects' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('projects')}
        >
          {tr('home.projects')} <span className={styles.muted}>({projects.length})</span>
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'tasks' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('tasks')}
        >
          {tr('admin.tabTasks')} <span className={styles.muted}>({tasks.length})</span>
        </button>
      </div>

      {/* ───────────── Users ───────────── */}
      {tab === 'users' && isAdmin && (
        <>
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{users.length}</span>
              <span className={styles.summaryLabel}>{tr('admin.activeUsers')}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{roleCounts.admin}</span>
              <span className={styles.summaryLabel}>{tr('admin.admins')}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{roleCounts.pm}</span>
              <span className={styles.summaryLabel}>{tr('admin.pms')}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{roleCounts.member}</span>
              <span className={styles.summaryLabel}>{tr('admin.members')}</span>
            </div>
            <div className={`${styles.summaryCard} ${pending.length > 0 ? styles.summaryCardWarn : ''}`}>
              <span className={styles.summaryValue}>{pending.length}</span>
              <span className={styles.summaryLabel}>{tr('admin.awaitingApproval')}</span>
            </div>
          </div>

          {pending.length > 0 && (
            <div className={styles.pendingBox}>
              <p className={styles.pendingTitle}>{tr('admin.waitingTitle', { count: pending.length })}</p>
              <p className={styles.pendingHint}>{tr('admin.waitingHint')}</p>
              <div className={styles.pendingList}>
                {pending.map((p) => (
                  <div key={p.id} className={styles.pendingRow}>
                    <span className={styles.avatar}>{initials(p.name)}</span>
                    <div className={styles.pendingWho}>
                      <span className={styles.pendingName}>{p.name}</span>
                      <span className={styles.muted}>
                        {tr('admin.askedFor', { email: p.email, role: p.role === 'pm' ? tr('admin.rolePm') : tr('admin.roleMember'), date: formatDate(p.created_at) })}
                      </span>
                    </div>
                    <button className="btn btn-danger" disabled={busyId === p.id} onClick={() => handleReject(p)}>
                      {tr('admin.reject')}
                    </button>
                    <button className="btn btn-primary" disabled={busyId === p.id} onClick={() => handleApprove(p)}>
                      {busyId === p.id ? tr('confirm.working') : tr('admin.approve')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.filterRow}>
            <input
              className={styles.searchInput}
              placeholder={tr('admin.searchUsers')}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">{tr('admin.allRoles')}</option>
              <option value="admin">{tr('admin.admins')}</option>
              <option value="pm">{tr('admin.pms')}</option>
              <option value="member">{tr('admin.members')}</option>
            </select>
            {(userSearch || roleFilter) && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setUserSearch('');
                  setRoleFilter('');
                }}
              >
                {tr('admin.clear')}
              </button>
            )}
            <span className={styles.resultCount}>
              {tr('admin.ofTotal', { shown: filteredUsers.length, total: users.length })}
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{tr('auth.name')}</th>
                  <th>{tr('auth.email')}</th>
                  <th>{tr('auth.role')}</th>
                  <th>{tr('admin.openTasks')}</th>
                  <th>{tr('admin.joined')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyRow}>
                      {users.length === 0 ? tr('admin.noUsers') : tr('admin.noUsersMatch')}
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => {
                  const load = workload.get(u.id);
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className={styles.userCell}>
                          <span className={styles.avatar}>{initials(u.name)}</span>
                          {u.name}
                          {isSelf && <span className={styles.youTag}>{tr('admin.you')}</span>}
                        </div>
                      </td>
                      <td className={styles.muted}>{u.email}</td>
                      <td>
                        <select
                          className={styles.roleSelect}
                          value={u.role}
                          disabled={isSelf}
                          title={isSelf ? tr('admin.selfRole') : undefined}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="member">{tr('admin.roleMember')}</option>
                          <option value="pm">{tr('admin.rolePm')}</option>
                          <option value="admin">{tr('admin.roleAdmin')}</option>
                        </select>
                        {savedUserId === u.id && (
                          <span style={{ marginLeft: 8, color: 'var(--status-done)', fontSize: 12 }}>{tr('admin.savedTick')}</span>
                        )}
                      </td>
                      <td className={styles.muted}>
                        {load ? (
                          <>
                            {load.open}
                            {load.overdue > 0 && <span className={styles.overdueText}> · {tr('board.overdueCount', { n: load.overdue })}</span>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={styles.muted}>{formatDate(u.created_at)}</td>
                      <td className={styles.rowActions}>
                        <button className="btn btn-secondary" onClick={() => openReset(u)}>
                          {tr('admin.resetPassword')}
                        </button>
                        {!isSelf && (
                          <button className="btn btn-danger" onClick={() => setDeleteUserTarget(u)}>
                            {tr('common.delete')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ───────────── Projects ───────────── */}
      {tab === 'projects' && (
        <>
          <div className={styles.filterRow}>
            <span className={styles.resultCount} style={{ marginLeft: 0 }}>
              {tr('admin.projectCount', { count: projects.length })}
            </span>
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowNewProject(true)}>
              {tr('home.newProject')}
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{tr('admin.colProject')}</th>
                  <th>{tr('admin.progress')}</th>
                  <th>{tr('admin.tabTasks')}</th>
                  <th>{tr('home.statOverdue')}</th>
                  <th>{tr('admin.colCreated')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyRow}>
                      {tr('calendar.noProjects')}
                    </td>
                  </tr>
                )}
                {projects.map((p) => {
                  const stats = projectStats.get(p.id) || { total: 0, done: 0, overdue: 0 };
                  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
                  const color = colorForProject(p.id);
                  return (
                    <tr key={p.id}>
                      <td className={styles.titleCell}>
                        <div className={styles.userCell}>
                          <span className={styles.projectDot} style={{ background: color }} />
                          <div>
                            <div>{p.name}</div>
                            {p.description && <div className={styles.projectDesc}>{p.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <div className={styles.progressTrack}>
                          <div className={styles.progressFill} style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className={styles.muted} style={{ fontSize: 11 }}>
                          {tr('home.doneOf', { done: stats.done, total: stats.total })} · {pct}%
                        </span>
                      </td>
                      <td className={styles.muted}>{stats.total}</td>
                      <td className={stats.overdue > 0 ? styles.overdueText : styles.muted}>
                        {stats.overdue > 0 ? stats.overdue : '—'}
                      </td>
                      <td className={styles.muted}>{formatDate(p.created_at)}</td>
                      <td className={styles.rowActions}>
                        <button className="btn btn-secondary" onClick={() => viewProjectTasks(p.id)}>
                          {tr('admin.viewTasks')}
                        </button>
                        <button className="btn btn-secondary" onClick={() => setEditProject(p)}>
                          {tr('common.edit')}
                        </button>
                        <button className="btn btn-danger" onClick={() => setDeleteProjectTarget(p)}>
                          {tr('common.delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ───────────── Tasks ───────────── */}
      {tab === 'tasks' && (
        <>
          <div className={styles.filterRow}>
            <input
              className={styles.searchInput}
              placeholder={tr('board.searchPlaceholder')}
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
            />
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">{tr('calendar.allProjects')}</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{tr('admin.allStatuses')}</option>
              {STATUS_KEYS.map((value) => (
                <option key={value} value={value}>
                  {tr(`status.${value}`)}
                </option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">{tr('board.allPriorities')}</option>
              {PRIORITY_KEYS.map((value) => (
                <option key={value} value={value}>
                  {tr(`priority.${value}`)}
                </option>
              ))}
            </select>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">{tr('board.allAssignees')}</option>
              <option value="__none__">{tr('list.unassigned')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              className={`btn ${overdueOnly ? 'btn-active' : 'btn-secondary'}`}
              onClick={() => setOverdueOnly((v) => !v)}
            >
              ⚠ {tr('admin.overdueOnly')}
            </button>
            {tasksFiltered && (
              <button className="btn btn-ghost" onClick={clearTaskFilters}>
                {tr('admin.clear')}
              </button>
            )}
            <span className={styles.resultCount}>
              {tr('admin.ofTotal', { shown: filteredTasks.length, total: tasks.length })}
            </span>
            <button
              className="btn btn-primary"
              onClick={() => {
                setPickedProjectId(projectFilter || projects[0]?.id || '');
                setPickProjectOpen(true);
              }}
              disabled={projects.length === 0}
            >
              + {tr('board.newTask')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={exportTasksCsv}
              disabled={filteredTasks.length === 0}
              title={tr('admin.exportHint')}
            >
              ⬇ {tr('admin.exportCsv')}
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className={styles.bulkBar}>
              <strong>{tr('board.selected', { n: selectedIds.length })}</strong>
              <select onChange={(e) => e.target.value && handleBulkStatus(e.target.value)} value="">
                <option value="" disabled>
                  {tr('board.moveTo')}
                </option>
                {STATUS_KEYS.map((value) => (
                  <option key={value} value={value}>
                    {tr(`status.${value}`)}
                  </option>
                ))}
              </select>
              <select onChange={(e) => e.target.value && handleBulkAssign(e.target.value)} value="">
                <option value="" disabled>
                  {tr('board.addAssignee')}
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                <option value="__clear__">{tr('admin.removeAssignees')}</option>
              </select>
              <button className="btn btn-danger" onClick={() => setBulkDeleteOpen(true)}>
                {tr('board.deleteSelected')}
              </button>
              <button className="btn btn-ghost" onClick={() => setSelectedIds([])}>
                {tr('list.clearSelection')}
              </button>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCol}>
                    <input
                      type="checkbox"
                      aria-label={tr('admin.selectAllShown')}
                      checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.includes(t.id))}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredTasks.map((t) => t.id) : [])
                      }
                    />
                  </th>
                  <th>{tr('modal.title')}</th>
                  <th>{tr('admin.colProject')}</th>
                  <th>{tr('list.status')}</th>
                  <th>{tr('list.priority')}</th>
                  <th>{tr('admin.colAssignee')}</th>
                  <th>{tr('admin.colCreatedBy')}</th>
                  <th>{tr('list.due')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={9} className={styles.emptyRow}>
                      {tasks.length === 0 ? tr('admin.noTasks') : tr('list.noMatch')}
                    </td>
                  </tr>
                )}
                {filteredTasks.map((t) => {
                  const late = isOverdue(t.due_date, t.status, now);
                  return (
                    <tr key={t.id} className={late ? styles.rowOverdue : undefined}>
                      <td className={styles.checkCol}>
                        <input
                          type="checkbox"
                          aria-label={tr('list.selectRow', { title: t.title })}
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td className={styles.titleCell}>
                        <button className={styles.titleLink} onClick={() => setOpenTask(t)} title={tr('admin.openEditHint')}>
                          {t.title}
                        </button>
                      </td>
                      <td className={styles.muted}>
                        <span className={styles.projectDotSm} style={{ background: colorForProject(t.project_id) }} />
                        {t.project_name}
                      </td>
                      <td>
                        <span className={styles.badge} style={{ color: STATUS_COLORS[t.status] }}>
                          {tr(`status.${t.status}`)}
                        </span>
                      </td>
                      <td className={styles.muted}>{tr(`priority.${t.priority}`)}</td>
                      <td className={styles.muted}>
                        {t.assignees && t.assignees.length > 0
                          ? t.assignees.map((a) => a.name).join(', ')
                          : tr('list.unassigned')}
                      </td>
                      <td className={styles.muted}>{t.creator_name}</td>
                      <td className={late ? styles.overdueText : styles.muted}>
                        {formatDate(t.due_date)}
                        {late && ` · ${tr('admin.overdueLower')}`}
                      </td>
                      <td className={styles.rowActions}>
                        <button className="btn btn-secondary" onClick={() => setOpenTask(t)}>
                          {tr('admin.open')}
                        </button>
                        <button className="btn btn-danger" onClick={() => setDeleteTaskTarget(t)}>
                          {tr('common.delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ───────────── Dialogs ───────────── */}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={handleCreateProject} />
      )}

      {editProject && (
        <EditProjectModal project={editProject} onClose={() => setEditProject(null)} onSave={handleSaveProject} />
      )}

      {deleteProjectTarget && (() => {
        const count = (projectStats.get(deleteProjectTarget.id) || { total: 0 }).total;
        return (
          <ConfirmDialog
            title={tr('home.deleteTitle')}
            message={
              count === 0
                ? tr('home.deleteEmpty', { name: deleteProjectTarget.name })
                : tr('home.deleteWithTasks', { name: deleteProjectTarget.name, count })
            }
            confirmLabel={tr('common.delete')}
            danger
            requireText={count === 0 ? undefined : tr('home.deleteWord')}
            onConfirm={() => handleDeleteProject(deleteProjectTarget.id)}
            onClose={() => setDeleteProjectTarget(null)}
          />
        );
      })()}

      {bulkDeleteOpen && (
        <ConfirmDialog
          title={tr('admin.bulkDeleteTitle', { count: selectedIds.length })}
          message={tr('admin.bulkDeleteMsg')}
          confirmLabel={tr('common.delete')}
          danger
          requireText={selectedIds.length > 3 ? tr('home.deleteWord') : undefined}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}

      {pickProjectOpen && (
        <div className={styles.dialogOverlay} onClick={() => setPickProjectOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>{tr('board.newTask')}</h2>
            <label className={styles.dialogLabel}>
              {tr('admin.whichProject')}
              <select value={pickedProjectId} onChange={(e) => setPickedProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.dialogActions}>
              <button className="btn btn-ghost" onClick={() => setPickProjectOpen(false)}>
                {tr('common.cancel')}
              </button>
              <button
                className="btn btn-primary"
                disabled={!pickedProjectId}
                onClick={() => {
                  setNewTaskProjectId(pickedProjectId);
                  setPickProjectOpen(false);
                }}
              >
                {tr('admin.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {newTaskProjectId && (
        <NewTaskModal users={users} onClose={() => setNewTaskProjectId('')} onCreate={handleCreateTask} />
      )}

      {openTask && (
        <TaskDetailModal
          task={openTask}
          users={users}
          onClose={() => setOpenTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          canApprove
          onApprove={handleApproveTask}
          onDeny={handleDenyTask}
        />
      )}

      {deleteUserTarget && (
        <ConfirmDialog
          title={tr('admin.deleteUserTitle')}
          message={(() => {
            const created = tasksCreatedBy(deleteUserTarget.id);
            return created > 0
              ? tr('admin.deleteUserWithTasks', { name: deleteUserTarget.name, email: deleteUserTarget.email, count: created })
              : tr('admin.deleteUser', { name: deleteUserTarget.name, email: deleteUserTarget.email });
          })()}
          confirmLabel={tr('common.delete')}
          danger
          requireText={tr('home.deleteWord')}
          onConfirm={() => handleDeleteUser(deleteUserTarget.id)}
          onClose={() => setDeleteUserTarget(null)}
        />
      )}

      {deleteTaskTarget && (
        <ConfirmDialog
          title={tr('admin.deleteTaskTitle')}
          message={tr('admin.deleteTaskMsg', { title: deleteTaskTarget.title })}
          confirmLabel={tr('common.delete')}
          danger
          onConfirm={() => handleDeleteTask(deleteTaskTarget.id)}
          onClose={() => setDeleteTaskTarget(null)}
        />
      )}

      {resetTarget && (
        <div className={styles.dialogOverlay} onClick={() => !resetBusy && setResetTarget(null)}>
          <form className={styles.dialog} onClick={(e) => e.stopPropagation()} onSubmit={handleResetPassword}>
            <h2 className={styles.dialogTitle}>{tr('admin.resetPassword')}</h2>
            <p className={styles.dialogText}>
              {tr('admin.resetIntroBefore')}
              <strong>{resetTarget.name}</strong> ({resetTarget.email}){tr('admin.resetIntroAfter')}
            </p>
            <label className={styles.dialogLabel}>
              {tr('profile.newPw')}
              <input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder={tr('admin.pwPlaceholder')}
                autoComplete="off"
                autoFocus
              />
            </label>
            {resetError && <p className={styles.dialogError}>{resetError}</p>}
            <div className={styles.dialogActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)} disabled={resetBusy}>
                {tr('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={resetBusy || resetPassword.length < 6}>
                {resetBusy ? tr('modal.saving') : tr('admin.setPassword')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
