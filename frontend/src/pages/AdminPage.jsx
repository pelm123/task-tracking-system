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
import styles from './admin.module.css';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
const ROLE_LABELS = { admin: 'Admin', pm: 'PM', member: 'Member' };

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
      .catch(() => setError('Could not load admin data.'))
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
    flash('Project created.');
  }

  async function handleSaveProject(id, payload) {
    await projectsApi.updateProject(id, payload);
    await refreshProjects();
    await reloadTasks(); // task rows show the project name
    flash('Project saved.');
  }

  async function handleDeleteProject(id) {
    await projectsApi.deleteProject(id);
    setTasks((prev) => prev.filter((t) => t.project_id !== id));
    setSelectedIds([]);
    if (projectFilter === id) setProjectFilter('');
    await refreshProjects();
    flash('Project deleted.');
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
      setError(err.response?.data?.message || 'Could not approve that task.');
    }
  }

  async function handleDenyTask(taskId) {
    const isReopen = tasks.find((t) => t.id === taskId)?.status === 'done';
    let reason = window.prompt('Comment explaining why this task is being sent back to To Do (required):', '');
    if (reason === null) return;
    while (!reason.trim()) {
      reason = window.prompt(`A comment is required to ${isReopen ? 'reopen' : 'deny'} a task. Please explain:`, '');
      if (reason === null) return;
    }
    try {
      const updated = await tasksApi.denyTask(taskId, reason);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setOpenTask((prev) => (prev && prev.id === taskId ? updated : prev));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send that task back.');
    }
  }

  async function handleCreateTask(payload) {
    const created = await tasksApi.createTask({ ...payload, project_id: newTaskProjectId });
    setTasks((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
    refreshProjects(); // keeps the per-project task counts fresh
    flash('Task created.');
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
      setError(err.response?.data?.message || 'Could not move those tasks.');
    }
  }

  async function handleBulkAssign(value) {
    try {
      await tasksApi.bulkAssign(selectedIds, value === '__clear__' ? null : value);
      await reloadTasks();
      setSelectedIds([]);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not assign those tasks.');
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
      setError(err.response?.data?.message || 'Could not update role.');
    }
  }

  async function handleApprove(person) {
    setBusyId(person.id);
    try {
      const approved = await usersApi.approveUser(person.id);
      setPending((prev) => prev.filter((p) => p.id !== person.id));
      setUsers((prev) => [...prev, approved].sort((a, b) => a.name.localeCompare(b.name)));
      setError('');
      flash(`${person.name} can now log in.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve that account.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(person) {
    if (
      !window.confirm(
        `Reject and remove the sign-up from ${person.name} (${person.email})? They can sign up again later.`
      )
    )
      return;
    setBusyId(person.id);
    try {
      await usersApi.deleteUser(person.id);
      setPending((prev) => prev.filter((p) => p.id !== person.id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reject that sign-up.');
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
      setResetError('Use at least 6 characters.');
      return;
    }
    setResetBusy(true);
    try {
      await usersApi.resetUserPassword(resetTarget.id, resetPassword);
      flash(`Password updated for ${resetTarget.name}. Share it with them privately.`);
      setResetTarget(null);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Could not reset the password.');
    } finally {
      setResetBusy(false);
    }
  }

  function exportTasksCsv() {
    const header = ['Title', 'Project', 'Status', 'Priority', 'Assignees', 'Created by', 'Due', 'Created'];
    const rows = filteredTasks.map((t) => [
      t.title,
      t.project_name,
      STATUS_LABELS[t.status],
      PRIORITY_LABELS[t.priority] || t.priority,
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
    return <div className={styles.adminScreen}>Loading admin data…</div>;
  }

  const tasksCreatedBy = (userId) => tasks.filter((t) => t.created_by === userId).length;

  return (
    <div className={styles.adminScreen}>
      <h1>Admin</h1>
      <p className={styles.subLine}>
        {isAdmin
          ? 'Manage every user, project and task in one place.'
          : 'Manage projects and tasks across the team. User accounts and roles are managed by admins.'}
      </p>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.tabs}>
        {isAdmin && (
          <button
            className={`${styles.tabBtn} ${tab === 'users' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('users')}
          >
            Users <span className={styles.muted}>({users.length})</span>
            {pending.length > 0 && <span className={styles.pendingBadge}>{pending.length} new</span>}
          </button>
        )}
        <button
          className={`${styles.tabBtn} ${tab === 'projects' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('projects')}
        >
          Projects <span className={styles.muted}>({projects.length})</span>
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'tasks' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('tasks')}
        >
          Tasks <span className={styles.muted}>({tasks.length})</span>
        </button>
      </div>

      {/* ───────────── Users ───────────── */}
      {tab === 'users' && isAdmin && (
        <>
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{users.length}</span>
              <span className={styles.summaryLabel}>Active users</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{roleCounts.admin}</span>
              <span className={styles.summaryLabel}>Admins</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{roleCounts.pm}</span>
              <span className={styles.summaryLabel}>PMs</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryValue}>{roleCounts.member}</span>
              <span className={styles.summaryLabel}>Members</span>
            </div>
            <div className={`${styles.summaryCard} ${pending.length > 0 ? styles.summaryCardWarn : ''}`}>
              <span className={styles.summaryValue}>{pending.length}</span>
              <span className={styles.summaryLabel}>Awaiting approval</span>
            </div>
          </div>

          {pending.length > 0 && (
            <div className={styles.pendingBox}>
              <p className={styles.pendingTitle}>Waiting for approval ({pending.length})</p>
              <p className={styles.pendingHint}>
                These people have signed up but can't log in until you approve them.
              </p>
              <div className={styles.pendingList}>
                {pending.map((p) => (
                  <div key={p.id} className={styles.pendingRow}>
                    <span className={styles.avatar}>{initials(p.name)}</span>
                    <div className={styles.pendingWho}>
                      <span className={styles.pendingName}>{p.name}</span>
                      <span className={styles.muted}>
                        {p.email} · asked for {p.role === 'pm' ? 'PM' : 'Member'} · {formatDate(p.created_at)}
                      </span>
                    </div>
                    <button className="btn btn-danger" disabled={busyId === p.id} onClick={() => handleReject(p)}>
                      Reject
                    </button>
                    <button className="btn btn-primary" disabled={busyId === p.id} onClick={() => handleApprove(p)}>
                      {busyId === p.id ? 'Working…' : 'Approve'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.filterRow}>
            <input
              className={styles.searchInput}
              placeholder="Search name or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              <option value="admin">Admins</option>
              <option value="pm">PMs</option>
              <option value="member">Members</option>
            </select>
            {(userSearch || roleFilter) && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setUserSearch('');
                  setRoleFilter('');
                }}
              >
                Clear
              </button>
            )}
            <span className={styles.resultCount}>
              {filteredUsers.length} of {users.length}
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Open tasks</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyRow}>
                      {users.length === 0 ? 'No users yet.' : 'No users match your search.'}
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
                          {isSelf && <span className={styles.youTag}>You</span>}
                        </div>
                      </td>
                      <td className={styles.muted}>{u.email}</td>
                      <td>
                        <select
                          className={styles.roleSelect}
                          value={u.role}
                          disabled={isSelf}
                          title={isSelf ? "You can't change your own role" : undefined}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="member">Member</option>
                          <option value="pm">PM</option>
                          <option value="admin">Admin</option>
                        </select>
                        {savedUserId === u.id && (
                          <span style={{ marginLeft: 8, color: 'var(--status-done)', fontSize: 12 }}>✓ Saved</span>
                        )}
                      </td>
                      <td className={styles.muted}>
                        {load ? (
                          <>
                            {load.open}
                            {load.overdue > 0 && <span className={styles.overdueText}> · {load.overdue} overdue</span>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={styles.muted}>{formatDate(u.created_at)}</td>
                      <td className={styles.rowActions}>
                        <button className="btn btn-secondary" onClick={() => openReset(u)}>
                          Reset password
                        </button>
                        {!isSelf && (
                          <button className="btn btn-danger" onClick={() => setDeleteUserTarget(u)}>
                            Delete
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
              {projects.length} project{projects.length === 1 ? '' : 's'}
            </span>
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowNewProject(true)}>
              + New project
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Progress</th>
                  <th>Tasks</th>
                  <th>Overdue</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyRow}>
                      No projects yet.
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
                          {stats.done}/{stats.total} done · {pct}%
                        </span>
                      </td>
                      <td className={styles.muted}>{stats.total}</td>
                      <td className={stats.overdue > 0 ? styles.overdueText : styles.muted}>
                        {stats.overdue > 0 ? stats.overdue : '—'}
                      </td>
                      <td className={styles.muted}>{formatDate(p.created_at)}</td>
                      <td className={styles.rowActions}>
                        <button className="btn btn-secondary" onClick={() => viewProjectTasks(p.id)}>
                          View tasks
                        </button>
                        <button className="btn btn-secondary" onClick={() => setEditProject(p)}>
                          Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => setDeleteProjectTarget(p)}>
                          Delete
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
              placeholder="Search tasks…"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
            />
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">All priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">All assignees</option>
              <option value="__none__">Unassigned</option>
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
              ⚠ Overdue only
            </button>
            {tasksFiltered && (
              <button className="btn btn-ghost" onClick={clearTaskFilters}>
                Clear
              </button>
            )}
            <span className={styles.resultCount}>
              {filteredTasks.length} of {tasks.length}
            </span>
            <button
              className="btn btn-primary"
              onClick={() => {
                setPickedProjectId(projectFilter || projects[0]?.id || '');
                setPickProjectOpen(true);
              }}
              disabled={projects.length === 0}
            >
              + New task
            </button>
            <button
              className="btn btn-secondary"
              onClick={exportTasksCsv}
              disabled={filteredTasks.length === 0}
              title="Download the tasks shown here as a CSV file (opens in Excel)"
            >
              ⬇ Export CSV
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className={styles.bulkBar}>
              <strong>{selectedIds.length} selected</strong>
              <select onChange={(e) => e.target.value && handleBulkStatus(e.target.value)} value="">
                <option value="" disabled>
                  Move to…
                </option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select onChange={(e) => e.target.value && handleBulkAssign(e.target.value)} value="">
                <option value="" disabled>
                  Add assignee…
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                <option value="__clear__">— Remove all assignees —</option>
              </select>
              <button className="btn btn-danger" onClick={() => setBulkDeleteOpen(true)}>
                Delete selected
              </button>
              <button className="btn btn-ghost" onClick={() => setSelectedIds([])}>
                Clear selection
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
                      aria-label="Select all shown"
                      checked={filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.includes(t.id))}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredTasks.map((t) => t.id) : [])
                      }
                    />
                  </th>
                  <th>Title</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Created by</th>
                  <th>Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={9} className={styles.emptyRow}>
                      {tasks.length === 0 ? 'No tasks yet.' : 'No tasks match your filters.'}
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
                          aria-label={`Select ${t.title}`}
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td className={styles.titleCell}>
                        <button className={styles.titleLink} onClick={() => setOpenTask(t)} title="Open and edit this task">
                          {t.title}
                        </button>
                      </td>
                      <td className={styles.muted}>
                        <span className={styles.projectDotSm} style={{ background: colorForProject(t.project_id) }} />
                        {t.project_name}
                      </td>
                      <td>
                        <span className={styles.badge} style={{ color: STATUS_COLORS[t.status] }}>
                          {STATUS_LABELS[t.status]}
                        </span>
                      </td>
                      <td className={styles.muted}>{PRIORITY_LABELS[t.priority] || t.priority}</td>
                      <td className={styles.muted}>
                        {t.assignees && t.assignees.length > 0
                          ? t.assignees.map((a) => a.name).join(', ')
                          : 'Unassigned'}
                      </td>
                      <td className={styles.muted}>{t.creator_name}</td>
                      <td className={late ? styles.overdueText : styles.muted}>
                        {formatDate(t.due_date)}
                        {late && ' · overdue'}
                      </td>
                      <td className={styles.rowActions}>
                        <button className="btn btn-secondary" onClick={() => setOpenTask(t)}>
                          Open
                        </button>
                        <button className="btn btn-danger" onClick={() => setDeleteTaskTarget(t)}>
                          Delete
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
            title="Delete project?"
            message={
              count === 0
                ? `"${deleteProjectTarget.name}" is empty. Delete it?`
                : `This deletes "${deleteProjectTarget.name}" and its ${count} task${count === 1 ? '' : 's'} for good.`
            }
            confirmLabel="Delete"
            danger
            requireText={count === 0 ? undefined : 'delete'}
            onConfirm={() => handleDeleteProject(deleteProjectTarget.id)}
            onClose={() => setDeleteProjectTarget(null)}
          />
        );
      })()}

      {bulkDeleteOpen && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} task${selectedIds.length === 1 ? '' : 's'}?`}
          message="They and their comments and files will be deleted for good."
          confirmLabel="Delete"
          danger
          requireText={selectedIds.length > 3 ? 'delete' : undefined}
          onConfirm={handleBulkDelete}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}

      {pickProjectOpen && (
        <div className={styles.dialogOverlay} onClick={() => setPickProjectOpen(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>New task</h2>
            <label className={styles.dialogLabel}>
              Which project is it for?
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
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!pickedProjectId}
                onClick={() => {
                  setNewTaskProjectId(pickedProjectId);
                  setPickProjectOpen(false);
                }}
              >
                Continue
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
          title="Delete user?"
          message={(() => {
            const created = tasksCreatedBy(deleteUserTarget.id);
            return `This removes ${deleteUserTarget.name} (${deleteUserTarget.email}) for good${
              created > 0
                ? `, along with the ${created} task${created === 1 ? '' : 's'} they created`
                : ''
            }.`;
          })()}
          confirmLabel="Delete"
          danger
          requireText="delete"
          onConfirm={() => handleDeleteUser(deleteUserTarget.id)}
          onClose={() => setDeleteUserTarget(null)}
        />
      )}

      {deleteTaskTarget && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${deleteTaskTarget.title}" and its comments and files will be deleted for good.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDeleteTask(deleteTaskTarget.id)}
          onClose={() => setDeleteTaskTarget(null)}
        />
      )}

      {resetTarget && (
        <div className={styles.dialogOverlay} onClick={() => !resetBusy && setResetTarget(null)}>
          <form className={styles.dialog} onClick={(e) => e.stopPropagation()} onSubmit={handleResetPassword}>
            <h2 className={styles.dialogTitle}>Reset password</h2>
            <p className={styles.dialogText}>
              Set a new password for <strong>{resetTarget.name}</strong> ({resetTarget.email}). Their current password
              stops working immediately — tell them the new one privately.
            </p>
            <label className={styles.dialogLabel}>
              New password
              <input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="off"
                autoFocus
              />
            </label>
            {resetError && <p className={styles.dialogError}>{resetError}</p>}
            <div className={styles.dialogActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)} disabled={resetBusy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={resetBusy || resetPassword.length < 6}>
                {resetBusy ? 'Saving…' : 'Set password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
