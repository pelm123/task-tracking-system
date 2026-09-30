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

export default function TaskCard({ task, index, onClick, selectMode, isSelected, onToggleSelect }) {
  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={selectMode}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ''}`}
          onClick={() => (selectMode ? onToggleSelect(task.id) : onClick(task))}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {selectMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(task.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ marginTop: 3 }}
              />
            )}
            <p className={styles.cardTitle} style={{ flex: 1 }}>{task.title}</p>
          </div>
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
            {task.due_date && <span className={styles.dueDate}>Due {formatDueDate(task.due_date)}</span>}
          </div>
          {task.assignee_name && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
              👤 {task.assignee_name}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
