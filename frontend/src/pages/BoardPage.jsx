import { useEffect, useState, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
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
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const data = await tasksApi.listTasks();
      setTasks(data);
    } catch (err) {
      setError('Could not load tasks. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, []);

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
      const created = await tasksApi.createTask({ title, priority: 'medium' });
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
    const created = await tasksApi.createTask(payload);
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

  if (loading) {
    return <div className={styles.boardScreen}>Loading board…</div>;
  }

  return (
    <div className={styles.boardScreen}>
      <div className={styles.boardHeader}>
        <div>
          <h1>Board</h1>
          <p className={styles.subLine}>
            Signed in as {user?.name} ({user?.role})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={styles.logoutBtn}
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
            onClick={() => setShowNewTaskModal(true)}
          >
            + New task
          </button>
          <button className={styles.logoutBtn} onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={styles.columns}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              tasks={tasks.filter((t) => t.status === col.status)}
              onTaskClick={setSelectedTask}
              onQuickAdd={handleQuickAdd}
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
