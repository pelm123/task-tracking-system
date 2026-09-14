import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as usersApi from '../api/users';
import * as tasksApi from '../api/tasks';
import styles from './admin.module.css';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('users');

  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([usersApi.listUsers(), tasksApi.listTasks()])
      .then(([u, t]) => {
        setUsers(u);
        setTasks(t);
      })
      .catch(() => setError('Could not load admin data.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(userId, role) {
    try {
      const updated = await usersApi.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setError('Could not update role.');
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
        <button
          className={`${styles.tabBtn} ${tab === 'users' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('users')}
        >
          Users ({users.length})
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'tasks' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('tasks')}
        >
          Tasks ({tasks.length})
        </button>
      </div>

      {tab === 'users' && (
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
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className={styles.muted}>{u.email}</td>
                  <td>
                    <select
                      className={styles.roleSelect}
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td className={styles.muted}>{formatDate(u.created_at)}</td>
                  <td>
                    {u.id !== currentUser.id && (
                      <button className={styles.actionBtn} onClick={() => handleDeleteUser(u.id)}>
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
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Created by</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>
                    <span className={styles.badge}>{STATUS_LABELS[t.status]}</span>
                  </td>
                  <td className={styles.muted}>{t.priority}</td>
                  <td className={styles.muted}>{t.assignee_name || 'Unassigned'}</td>
                  <td className={styles.muted}>{t.creator_name}</td>
                  <td className={styles.muted}>{formatDate(t.due_date)}</td>
                  <td>
                    <button className={styles.actionBtn} onClick={() => handleDeleteTask(t.id)}>
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
