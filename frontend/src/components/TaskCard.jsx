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
          style={{ '--card-accent': PRIORITY_COLORS[task.priority], ...provided.draggableProps.style }}
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
          {task.assignees && task.assignees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ display: 'flex' }}>
                {task.assignees.slice(0, 4).map((a, i) => (
                  <span
                    key={a.id}
                    title={a.name}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'var(--color-accent-soft)',
                      color: 'var(--color-accent)',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: '2px solid var(--color-surface)',
                      marginLeft: i === 0 ? 0 : -6,
                    }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {task.assignees.length === 1
                  ? task.assignees[0].name
                  : `${task.assignees.length} assignees`}
              </span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
