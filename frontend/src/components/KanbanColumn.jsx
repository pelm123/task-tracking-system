import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { isOverdue } from '../utils/dueDate';
import { t } from '../i18n';
import styles from '../pages/board.module.css';

const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};

export default function KanbanColumn({
  status,
  label,
  tasks,
  onTaskClick,
  selectMode,
  selectedIds,
  onToggleSelect,
  canApprove,
  onApprove,
  onDeny,
  onMove,
  currentUser,
  now,
}) {
  const overdueCount = tasks.filter((t) => isOverdue(t.due_date, t.status, now)).length;

  // Done is reached only through PM/admin approval of a Review task, so a
  // member can't drag into it or quick-add straight into it.
  const doneLockedForUser = status === 'done' && !canApprove;

  return (
    <div className={styles.column} style={{ '--column-accent': STATUS_COLORS[status] }}>
      <div className={styles.columnHeader}>
        <div className={styles.columnTitle}>
          <span className={styles.dot} style={{ background: STATUS_COLORS[status] }} />
          {label}
        </div>
        <span className={styles.columnHeaderRight}>
          {overdueCount > 0 && <span className={styles.overdueCount}>⚠ {t('board.overdueCount', { n: overdueCount })}</span>}
          <span className={styles.count}>{tasks.length}</span>
        </span>
      </div>

      <Droppable droppableId={status} isDropDisabled={doneLockedForUser}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`${styles.cardList} ${snapshot.isDraggingOver ? styles.draggingOver : ''}`}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className={styles.emptyColumn}>
                {status === 'review' && !canApprove ? t('board.emptyReview') : t('board.emptyColumn')}
              </div>
            )}
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onClick={onTaskClick}
                selectMode={selectMode}
                isSelected={selectedIds?.includes(task.id)}
                onToggleSelect={onToggleSelect}
                canApprove={canApprove}
                onApprove={onApprove}
                onDeny={onDeny}
                onMove={onMove}
                currentUser={currentUser}
                now={now}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

    </div>
  );
}
