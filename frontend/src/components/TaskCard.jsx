import { Draggable } from '@hello-pangea/dnd';
import styles from '../pages/board.module.css';

const PRIORITY_COLORS = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
};

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TaskCard({ task, index, onClick }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ''}`}
          onClick={() => onClick(task)}
        >
          <p className={styles.cardTitle}>{task.title}</p>
          <div className={styles.cardMeta}>
            <span
              className={styles.priorityTag}
              style={{
                color: PRIORITY_COLORS[task.priority],
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {task.priority}
            </span>
            {task.due_date && <span className={styles.dueDate}>{formatDueDate(task.due_date)}</span>}
          </div>
        </div>
      )}
    </Draggable>
  );
}
