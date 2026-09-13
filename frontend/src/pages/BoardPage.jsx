import { useEffect, useState, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import * as tasksApi from '../api/tasks';
import KanbanColumn from '../components/KanbanColumn';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  }, [loadTasks]);

  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;

    // optimistic update so the UI feels instant
    setTasks((prev) =>
      prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t))
    );

    try {
      await tasksApi.updateTaskStatus(draggableId, newStatus);
    } catch (err) {
      setError('Could not save that move — reverting.');
      loadTasks(); // re-sync with server truth on failure
    }
  }

  async function handleQuickAdd(status, title) {
    try {
      const created = await tasksApi.createTask({ title, priority: 'medium' });
      // quick-add always creates as "todo" server-side; if added from another
      // column, immediately move it there
      if (status !== 'todo') {
        await tasksApi.updateTaskStatus(created.id, status);
        created.status = status;
      }
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      setError('Could not create the task.');
    }
  }

  function handleTaskClick(task) {
    // task detail modal (comments, attachments, edit) comes in the next step
    console.log('Task clicked:', task.title);
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
        <button className={styles.logoutBtn} onClick={logout}>
          Log out
        </button>
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
              onTaskClick={handleTaskClick}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
