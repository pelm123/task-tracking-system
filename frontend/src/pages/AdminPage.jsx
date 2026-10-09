import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as usersApi from '../api/users';
import * as tasksApi from '../api/tasks';
import styles from './admin.module.css';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'users' : 'tasks');

  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]); // sign-ups waiting for approval (admin only)
  const [busyId, setBusyId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedUserId, setSavedUserId] = useState(null);

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

  async function handleRoleChange(userId, role) {
    try {
      const updated = await usersApi.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setSavedUserId(userId);
      setTimeout(() => setSavedUserId((current) => (current === userId ? null : current)), 1500);
    } catch (err) {
      setError('Could not update role.');
    }
  }

  async function handleApprove(person) {
    setBusyId(person.id);
    try {
      const approved = await usersApi.approveUser(person.id);
      setPending((prev) => prev.filter((p) => p.id !== person.id));
      setUsers((prev) =>
        [...prev, approved].sort((a, b) => a.name.localeCompare(b.name))
      );
      setError('');
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
    if (
      !window.confirm(
        'Delete this user? Any tasks they created will also be deleted. This cannot be undone.'
      )
    )
      return;
    try {
      await usersApi.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTasks((prev) => prev.filter((t) => t.created_by !== userId));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete user.');
    }
  }

  async function handleDeleteTask(taskId) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await tasksApi.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setError('Could not delete task.');
    }
  }

  if (loading) {
    return <div className={styles.adminScreen}>Loading admin data…</div>;
  }

  return (
    <div className={styles.adminScreen}>
      <h1>Admin</h1>
      <p className={styles.subLine}>Manage every user and task across the project.</p>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}

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
          className={`${styles.tabBtn} ${tab === 'tasks' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('tasks')}
        >
          Tasks <span className={styles.muted}>({tasks.length})</span>
        </button>
      </div>

      {tab === 'users' && isAdmin && pending.length > 0 && (
        <div className={styles.pendingBox}>
          <p className={styles.pendingTitle}>
            Waiting for approval ({pending.length})
          </p>
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
                <button
                  className="btn btn-danger"
                  disabled={busyId === p.id}
                  onClick={() => handleReject(p)}
                >
                  Reject
                </button>
                <button
                  className="btn btn-primary"
                  disabled={busyId === p.id}
                  onClick={() => handleApprove(p)}
                >
                  {busyId === p.id ? 'Working…' : 'Approve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && isAdmin && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.emptyRow}>
                    No users yet.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.avatar}>{initials(u.name)}</span>
                      {u.name}
                    </div>
                  </td>
                  <td className={styles.muted}>{u.email}</td>
                  <td>
                    <select
                      className={styles.roleSelect}
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="pm">PM</option>
                      <option value="admin">Admin</option>
                    </select>
                    {savedUserId === u.id && (
                      <span style={{ marginLeft: 8, color: 'var(--status-done)', fontSize: 12 }}>
                        ✓ Saved
                      </span>
                    )}
                  </td>
                  <td className={styles.muted}>{formatDate(u.created_at)}</td>
                  <td>
                    {u.id !== currentUser.id && (
                      <button className="btn btn-danger" onClick={() => handleDeleteUser(u.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tasks' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
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
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.emptyRow}>
                    No tasks yet.
                  </td>
                </tr>
              )}
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td className={styles.muted}>{t.project_name}</td>
                  <td>
                    <span className={styles.badge} style={{ color: STATUS_COLORS[t.status] }}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td className={styles.muted}>{t.priority}</td>
                  <td className={styles.muted}>
                    {t.assignees && t.assignees.length > 0
                      ? t.assignees.map((a) => a.name).join(', ')
                      : 'Unassigned'}
                  </td>
                  <td className={styles.muted}>{t.creator_name}</td>
                  <td className={styles.muted}>{formatDate(t.due_date)}</td>
                  <td>
                    <button className="btn btn-danger" onClick={() => handleDeleteTask(t.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
