import { Draggable } from '@hello-pangea/dnd';
import { getDueCountdown, isOverdue, formatOverdueShort, formatDueDateShort } from '../utils/dueDate';
import styles from '../pages/board.module.css';

const PRIORITY_COLORS = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
};

export default function TaskCard({
  task,
  index,
  onClick,
  selectMode,
  isSelected,
  onToggleSelect,
  canApprove,
  onApprove,
  onDeny,
  onMove,
  currentUser,
  now,
}) {
  const showApprovalActions = canApprove && task.status === 'review';
  const countdown = getDueCountdown(task.due_date, now);
  // Done tasks are never flagged as late, even if they finished past the due date
  const overdue = isOverdue(task.due_date, task.status, now);

  // A member can only move a task they're assigned to — not someone
  // else's (PM/admin can move anything). Mirrors the backend check in
  // updateTaskStatus/bulkUpdateStatus.
  const isAssignee = (task.assignees || []).some((a) => a.id === currentUser?.id);
  const canMove = canApprove || isAssignee;

  // Status changes use the Accept / Submit buttons, so dragging is always off.
  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`${styles.card} ${snapshot.isDragging ? styles.dragging : ''} ${overdue ? styles.cardOverdue : ''}`}
          style={{
            '--card-accent': PRIORITY_COLORS[task.priority],
            ...provided.draggableProps.style,
            cursor: 'pointer',
            opacity: !selectMode && !canMove ? 0.75 : 1,
          }}
                    onClick={() => (selectMode ? (canMove && onToggleSelect(task.id)) : onClick(task))}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            {selectMode && (
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!canMove}
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
                background: 'color-mix(in srgb, var(--color-text) 7%, transparent)',
              }}
            >
              {task.priority}
            </span>
            {overdue && (
              <span
                className={styles.overdueBadge}
                title={`${countdown.label} — due ${new Date(task.due_date).toLocaleString()}`}
              >
                Overdue · {formatOverdueShort(task.due_date, now)}
              </span>
            )}
            {countdown && !overdue && (
              <span
                className={styles.dueDate}
                style={{
                  color: countdown.urgent && task.status !== 'done' ? 'var(--priority-medium)' : undefined,
                  fontWeight: countdown.urgent && task.status !== 'done' ? 600 : undefined,
                }}
                title={new Date(task.due_date).toLocaleString()}
              >
                {countdown.label}
              </span>
            )}
          </div>
          {task.due_date && (
            <p
              className={`${styles.dueDateLine} ${overdue ? styles.dueDateLineOverdue : ''}`}
              title={new Date(task.due_date).toLocaleString()}
            >
              📅 {formatDueDateShort(task.due_date, now)}
            </p>
          )}
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
          {!selectMode && canMove && task.status === 'todo' && (
            <div className={styles.approvalActions} onClick={(e) => e.stopPropagation()}>
              <button className={styles.acceptBtn} onClick={() => onMove(task.id, 'in_progress')}>
                ▶ Accept task
              </button>
            </div>
          )}
          {!selectMode && canMove && task.status === 'in_progress' && (
            <div className={styles.approvalActions} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.backBtn}
                title="Changed your mind? Move it back to To Do"
                onClick={() => onMove(task.id, 'todo')}
              >
                ↩ To Do
              </button>
              <button className={styles.submitBtn} onClick={() => onMove(task.id, 'review')}>
                ✓ Submit for review
              </button>
            </div>
          )}
          {canApprove && task.status === 'done' && (
            <div className={styles.approvalActions} onClick={(e) => e.stopPropagation()}>
              <button className={styles.denyBtn} onClick={() => onDeny(task.id)}>
                ↩ Reopen
              </button>
            </div>
          )}
          {showApprovalActions && (
            <div className={styles.approvalActions} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.approveBtn}
                onClick={() => onApprove(task.id)}
              >
                ✓ Approve
              </button>
              <button
                className={styles.denyBtn}
                onClick={() => onDeny(task.id)}
              >
                ✕ Deny
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
