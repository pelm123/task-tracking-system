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

export default function KanbanColumn({
  status,
  label,
  tasks,
  onTaskClick,
  onQuickAdd,
  selectMode,
  selectedIds,
  onToggleSelect,
  canApprove,
  onApprove,
  onDeny,
}) {
  const [draft, setDraft] = useState('');

  // Done is reached only through PM/admin approval of a Review task, so a
  // member can't drag into it or quick-add straight into it.
  const doneLockedForUser = status === 'done' && !canApprove;

  function handleAdd(e) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onQuickAdd(status, title);
    setDraft('');
  }

  return (
    <div className={styles.column} style={{ '--column-accent': STATUS_COLORS[status] }}>
      <div className={styles.columnHeader}>
        <div className={styles.columnTitle}>
          <span className={styles.dot} style={{ background: STATUS_COLORS[status] }} />
          {label}
        </div>
        <span className={styles.count}>{tasks.length}</span>
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
                {status === 'review' && !canApprove
                  ? 'No tasks awaiting approval'
                  : 'No tasks here yet'}
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
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {!doneLockedForUser && (
        <form className={styles.quickAdd} onSubmit={handleAdd}>
          <input
            className={styles.quickAddInput}
            placeholder="+ Add a task"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
      )}
    </div>
  );
}
