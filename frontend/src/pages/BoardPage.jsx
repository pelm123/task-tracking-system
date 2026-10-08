import { useEffect, useState, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import * as tasksApi from '../api/tasks';
import * as usersApi from '../api/users';
import socket from '../api/socket';
import KanbanColumn from '../components/KanbanColumn';
import NewTaskModal from '../components/NewTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import styles from './board.module.css';
import tableStyles from './admin.module.css';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const COLUMNS = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

export default function BoardPage() {
  const { currentProjectId, currentProject } = useProject();
  const { user } = useAuth();
  const canApprove = user?.role === 'admin' || user?.role === 'pm';
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [view, setView] = useState('board'); // 'board' | 'list'

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // ticks every 60s so the due-date countdown on every card stays live
  // without each card running its own timer
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const loadTasks = useCallback(async () => {
    if (!currentProjectId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await tasksApi.listTasks({ project_id: currentProjectId });
      setTasks(data);
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

  // live sync: join the current project's room and apply changes other
  // people make — drag-and-drop, create, edit, delete — the moment they
  // happen, no refresh needed
  useEffect(() => {
    if (!currentProjectId) return;
    socket.emit('join-project', currentProjectId);

    function handleUpserted(task) {
      if (task.project_id !== currentProjectId) return;
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === task.id);
        return exists ? prev.map((t) => (t.id === task.id ? task : t)) : [task, ...prev];
      });
      setSelectedTask((prev) => (prev && prev.id === task.id ? task : prev));
    }

    function handleDeleted({ id }) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSelectedTask((prev) => (prev && prev.id === id ? null : prev));
    }

    socket.on('task:upserted', handleUpserted);
    socket.on('task:deleted', handleDeleted);

    return () => {
      socket.emit('leave-project', currentProjectId);
      socket.off('task:upserted', handleUpserted);
      socket.off('task:deleted', handleDeleted);
    };
  }, [currentProjectId]);

  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;

    // A Done task can only leave Done through the reopen flow: PM/admin,
    // back to To Do, with a required comment (the backend enforces this
    // too). Nothing is moved optimistically here — the card just snaps
    // back unless the reopen actually goes through.
    if (source.droppableId === 'done' && newStatus !== 'done') {
      if (!canApprove) {
        setError('Only a PM or admin can reopen a Done task.');
      } else if (newStatus !== 'todo') {
        setError('A Done task can only be reopened to To Do, with a comment explaining why.');
      } else {
        handleDeny(draggableId);
      }
      return;
    }

    // Members can't drag a card straight into Done — a PM/admin has to
    // approve it from Review first (see handleApprove below).
    if (newStatus === 'done' && !canApprove) {
      setError('Only a PM or admin can move a task to Done. Move it to Review for approval instead.');
      return;
    }

    // Members can only move their own tasks — this is also enforced by
    // disabling the drag itself (see TaskCard), but checked again here in
    // case the task's assignee list changed after the board last loaded.
    if (!canApprove) {
      const task = tasks.find((t) => t.id === draggableId);
      const isAssignee = (task?.assignees || []).some((a) => a.id === user.id);
      if (!isAssignee) {
        setError('You can only move tasks you are assigned to.');
        return;
      }
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t))
    );

    try {
      await tasksApi.updateTaskStatus(draggableId, newStatus);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that move — reverting.');
      loadTasks();
    }
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

  // Sends a task back to To Do — either denying a Review approval, or
  // reopening a Done task. Both need a comment explaining why; the backend
  // saves it as a real comment and notifies the assignees.
  async function handleDeny(taskId) {
    const isReopen = tasks.find((t) => t.id === taskId)?.status === 'done';
    const verb = isReopen ? 'reopen' : 'deny';

    // keep asking until the PM provides a comment or explicitly cancels (the
    // backend enforces this too, this just avoids a round-trip)
    let reason = window.prompt(`Comment explaining why this task is being sent back to To Do (required):`, '');
    if (reason === null) return; // user cancelled the prompt
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

  async function handleQuickAdd(status, title) {
    try {
      const created = await tasksApi.createTask({ title, priority: 'medium', project_id: currentProjectId });
      if (status !== 'todo') {
        await tasksApi.updateTaskStatus(created.id, status);
        created.status = status;
      }
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      setError('Could not create the task.');
    }
  }

  async function handleCreateFromModal(payload) {
    const created = await tasksApi.createTask({ ...payload, project_id: currentProjectId });
    setTasks((prev) => [created, ...prev]);
  }

  async function handleUpdateTask(id, payload) {
    const updated = await tasksApi.updateTask(id, payload);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setSelectedTask(updated);
  }

  async function handleDeleteTask(id) {
    await tasksApi.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const filteredTasks = tasks.filter((t) => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterAssignee && !(t.assignees || []).some((a) => a.id === filterAssignee)) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  function toggleSelect(taskId) {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleBulkStatus(status) {
    try {
      await tasksApi.bulkUpdateStatus(selectedIds, status);
      setTasks((prev) => prev.map((t) => (selectedIds.includes(t.id) ? { ...t, status } : t)));
      exitSelectMode();
    } catch (err) {
      setError('Bulk status update failed.');
    }
  }

  async function handleBulkAssign(assigneeId) {
    try {
      const updated = await tasksApi.bulkAssign(selectedIds, assigneeId || null);
      const byId = new Map(updated.map((t) => [t.id, t]));
      setTasks((prev) => prev.map((t) => byId.get(t.id) || t));
      exitSelectMode();
    } catch (err) {
      setError('Bulk assign failed.');
    }
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} task(s)? This cannot be undone.`)) return;
    try {
      await tasksApi.bulkDelete(selectedIds);
      setTasks((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
      exitSelectMode();
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk delete failed.');
    }
  }

  if (loading) {
    return <div className={styles.boardScreen}>Loading board…</div>;
  }

  if (!currentProjectId) {
    return (
      <div className={styles.boardScreen}>
        <h1>Board</h1>
        <p className={styles.subLine}>
          No project yet. Ask an Admin/PM to create one, or use "+ Project" in the top bar if you have access.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.boardScreen}>
      <div className={styles.boardHeader}>
        <div>
          <h1>{currentProject?.name || 'Board'}</h1>
          <p className={styles.subLine}>Drag cards between columns, or click one to see details.</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary" onClick={() => setShowNewTaskModal(true)}>
            + New task
          </button>
          <button
            className={`btn ${selectMode ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            {selectMode ? 'Cancel select' : 'Select'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setView((v) => (v === 'board' ? 'list' : 'board'))}
          >
            {view === 'board' ? 'List view' : 'Board view'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}

      <div className={styles.filterBar}>
        <input
          placeholder="Search tasks…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
          <option value="">All assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        {(searchQuery || filterAssignee || filterPriority) && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSearchQuery('');
              setFilterAssignee('');
              setFilterPriority('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            padding: '10px 14px',
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-accent)',
            borderRadius: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.length} selected</span>
          <select onChange={(e) => e.target.value && handleBulkStatus(e.target.value)} defaultValue="">
            <option value="" disabled>
              Move to…
            </option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            {canApprove && <option value="done">Done</option>}
          </select>
          <select
            onChange={(e) => handleBulkAssign(e.target.value === '__clear__' ? null : e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Add assignee…
            </option>
            <option value="__clear__">Clear all assignees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            Delete selected
          </button>
        </div>
      )}

      {view === 'list' ? (
        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id} onClick={() => setSelectedTask(t)} style={{ cursor: 'pointer' }}>
                  <td>{t.title}</td>
                  <td>
                    <span className={tableStyles.badge}>{STATUS_LABELS[t.status]}</span>
                  </td>
                  <td className={tableStyles.muted}>{t.priority}</td>
                  <td className={tableStyles.muted}>
                    {t.assignees && t.assignees.length > 0
                      ? t.assignees.map((a) => a.name).join(', ')
                      : 'Unassigned'}
                  </td>
                  <td className={tableStyles.muted}>{formatDate(t.due_date)}</td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className={tableStyles.muted} style={{ textAlign: 'center', padding: 24 }}>
                    No tasks match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.columns}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                tasks={filteredTasks.filter((t) => t.status === col.status)}
                onTaskClick={setSelectedTask}
                onQuickAdd={handleQuickAdd}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                canApprove={canApprove}
                onApprove={handleApprove}
                onDeny={handleDeny}
                currentUser={user}
                now={now}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {showNewTaskModal && (
        <NewTaskModal
          users={users}
          onClose={() => setShowNewTaskModal(false)}
          onCreate={handleCreateFromModal}
        />
      )}

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
    </div>
  );
}
