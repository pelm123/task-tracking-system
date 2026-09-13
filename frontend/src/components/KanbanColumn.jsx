import { useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import styles from '../pages/board.module.css';

const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};

export default function KanbanColumn({ status, label, tasks, onTaskClick, onQuickAdd }) {
  const [draft, setDraft] = useState('');

  function handleAdd(e) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onQuickAdd(status, title);
    setDraft('');
  }

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <div className={styles.columnTitle}>
          <span className={styles.dot} style={{ background: STATUS_COLORS[status] }} />
          {label}
        </div>
        <span className={styles.count}>{tasks.length}</span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`${styles.cardList} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} onClick={onTaskClick} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <form className={styles.quickAdd} onSubmit={handleAdd}>
        <input
          className={styles.quickAddInput}
          placeholder="+ Add a task"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
    </div>
  );
}
