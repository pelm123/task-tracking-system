import { useEffect, useState, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import * as tasksApi from '../api/tasks';
import * as usersApi from '../api/users';
import KanbanColumn from '../components/KanbanColumn';
import NewTaskModal from '../components/NewTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import styles from './board.module.css';

const COLUMNS = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

export default function BoardPage() {
  const { currentProjectId, currentProject } = useProject();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
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

  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;

    setTasks((prev) =>
      prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t))
    );

    try {
      await tasksApi.updateTaskStatus(draggableId, newStatus);
    } catch (err) {
      setError('Could not save that move — reverting.');
      loadTasks();
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
    if (filterAssignee && t.assignee_id !== filterAssignee) return false;
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
      await tasksApi.bulkAssign(selectedIds, assigneeId || null);
      setTasks((prev) =>
        prev.map((t) => (selectedIds.includes(t.id) ? { ...t, assignee_id: assigneeId || null } : t))
      );
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
      setError('Bulk delete failed.');
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
        <button
          className={styles.logoutBtn}
          style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
          onClick={() => setShowNewTaskModal(true)}
        >
          + New task
        </button>
        <button
          className={styles.logoutBtn}
          style={{ marginLeft: 10 }}
          onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        >
          {selectMode ? 'Cancel select' : 'Select'}
        </button>
      </div>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
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
            className={styles.logoutBtn}
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
            <option value="done">Done</option>
          </select>
          <select onChange={(e) => handleBulkAssign(e.target.value)} defaultValue="">
            <option value="" disabled>
              Assign to…
            </option>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button className={styles.logoutBtn} style={{ borderColor: 'var(--priority-high)', color: 'var(--priority-high)' }} onClick={handleBulkDelete}>
            Delete selected
          </button>
        </div>
      )}

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
            />
          ))}
        </div>
      </DragDropContext>

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
        />
      )}
    </div>
  );
}
