import { useMemo, useState } from 'react';
import { getDueCountdown, isOverdue, formatOverdueShort, formatDueDateShort } from '../utils/dueDate';
import styles from './taskListView.module.css';

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_ORDER = { todo: 0, in_progress: 1, review: 2, done: 3 };
const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLORS = {
  low: 'var(--priority-low)',
  medium: 'var(--priority-medium)',
  high: 'var(--priority-high)',
};

// Sorting is local to the list: clicking a header cycles ascending →
// descending → back to the board's own order (so "Overdue first" still works
// when no column sort is active).
const SORTERS = {
  title: (a, b) => a.title.localeCompare(b.title),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  priority: (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  due: (a, b) => {
    // tasks without a due date always sink to the bottom, in either direction
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  },
};

export default function TaskListView({
  tasks,
  now,
  currentUser,
  canApprove,
  selectMode,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpen,
  onStatusChange,
  onApprove,
  onDeny,
}) {
  const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' } | null

  const rows = useMemo(() => {
    if (!sort) return tasks;
    const cmp = SORTERS[sort.key];
    const sorted = [...tasks].sort((a, b) => {
      const r = cmp(a, b);
      // keep "no due date" last even when descending
      if (sort.key === 'due' && (!a.due_date || !b.due_date)) return r;
      return sort.dir === 'asc' ? r : -r;
    });
    return sorted;
  }, [tasks, sort]);

  function cycleSort(key) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  function sortIndicator(key) {
    if (!sort || sort.key !== key) return <span className={styles.sortHint}>↕</span>;
    return <span className={styles.sortActive}>{sort.dir === 'asc' ? '▲' : '▼'}</span>;
  }

  function ariaSort(key) {
    if (!sort || sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  // A member can only move/select tasks they're assigned to (PM/admin: any).
  // Same rule as the board's cards.
  function canMoveTask(task) {
    return canApprove || (task.assignees || []).some((a) => a.id === currentUser?.id);
  }

  const selectableIds = rows.filter(canMoveTask).map((t) => t.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  const colCount = 5 + (selectMode ? 1 : 0) + (canApprove ? 1 : 0); // title..due, + select, + actions

  return (
    <div className={styles.wrap}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {selectMode && (
                <th className={styles.checkCol}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectableIds.length === 0}
                    onChange={() => onSelectAll(allSelected ? [] : selectableIds)}
                    title={allSelected ? 'Clear selection' : 'Select all you can change'}
                    aria-label="Select all"
                  />
                </th>
              )}
              <th aria-sort={ariaSort('title')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('title')}>
                  Title {sortIndicator('title')}
                </button>
              </th>
              <th aria-sort={ariaSort('status')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('status')}>
                  Status {sortIndicator('status')}
                </button>
              </th>
              <th aria-sort={ariaSort('priority')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('priority')}>
                  Priority {sortIndicator('priority')}
                </button>
              </th>
              <th>Assignees</th>
              <th aria-sort={ariaSort('due')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('due')}>
                  Due {sortIndicator('due')}
                </button>
              </th>
              {canApprove && <th className={styles.actionsCol}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className={styles.emptyRow}>
                  No tasks match your filters.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const overdue = isOverdue(t.due_date, t.status, now);
              const countdown = getDueCountdown(t.due_date, now);
              const movable = canMoveTask(t);
              const selected = selectedIds.includes(t.id);
              const statusOptions = canApprove
                ? ['todo', 'in_progress', 'review', 'done']
                : ['todo', 'in_progress', 'review'];

              return (
                <tr
                  key={t.id}
                  className={`${styles.row} ${overdue ? styles.rowOverdue : ''} ${selected ? styles.rowSelected : ''}`}
                  onClick={() => (selectMode ? movable && onToggleSelect(t.id) : onOpen(t))}
                  title={selectMode && !movable ? "You're not assigned to this task, so you can't select it" : undefined}
                >
                  {selectMode && (
                    <td className={styles.checkCol} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!movable}
                        onChange={() => onToggleSelect(t.id)}
                        aria-label={`Select ${t.title}`}
                      />
                    </td>
                  )}

                  <td className={styles.titleCell}>
                    <span className={styles.titleText}>{t.title}</span>
                    {overdue && (
                      <span className={styles.overdueBadge} title={countdown?.label}>
                        Overdue · {formatOverdueShort(t.due_date, now)}
                      </span>
                    )}
                  </td>

                  <td onClick={(e) => e.stopPropagation()}>
                    {t.status !== 'done' && movable && !selectMode ? (
                      <select
                        className={styles.statusSelect}
                        style={{ '--status-color': STATUS_COLORS[t.status] }}
                        value={t.status}
                        onChange={(e) => onStatusChange(t.id, e.target.value)}
                        aria-label={`Status of ${t.title}`}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={styles.statusBadge} style={{ '--status-color': STATUS_COLORS[t.status] }}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    )}
                  </td>

                  <td>
                    <span className={styles.priorityChip} style={{ '--chip-color': PRIORITY_COLORS[t.priority] }}>
                      ⚑ {PRIORITY_LABELS[t.priority] || t.priority}
                    </span>
                  </td>

                  <td className={styles.assigneeCell}>
                    {t.assignees && t.assignees.length > 0 ? (
                      <span className={styles.assignees}>
                        <span className={styles.avatarStack}>
                          {t.assignees.slice(0, 4).map((a, i) => (
                            <span key={a.id} className={styles.avatar} title={a.name} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                              {a.name.charAt(0).toUpperCase()}
                            </span>
                          ))}
                        </span>
                        <span className={styles.assigneeNames}>
                          {t.assignees.length === 1 ? t.assignees[0].name : `${t.assignees.length} assignees`}
                        </span>
                      </span>
                    ) : (
                      <span className={styles.muted}>Unassigned</span>
                    )}
                  </td>

                  <td>
                    {t.due_date ? (
                      <div className={styles.dueCell} title={new Date(t.due_date).toLocaleString()}>
                        <span className={`${styles.dueDate} ${overdue ? styles.dueDateOverdue : ''}`}>
                          {formatDueDateShort(t.due_date, now)}
                        </span>
                        {t.status !== 'done' && countdown && (
                          <span
                            className={`${styles.dueCountdown} ${
                              overdue ? styles.dueDateOverdue : countdown.urgent ? styles.dueUrgent : ''
                            }`}
                          >
                            {countdown.label}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className={styles.muted}>No due date</span>
                    )}
                  </td>

                  {canApprove && (
                    <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                      {t.status === 'review' && (
                        <span className={styles.actionBtns}>
                          <button className={styles.approveBtn} onClick={() => onApprove(t.id)}>
                            ✓ Approve
                          </button>
                          <button className={styles.denyBtn} onClick={() => onDeny(t.id)}>
                            ✕ Deny
                          </button>
                        </span>
                      )}
                      {t.status === 'done' && (
                        <button className={styles.denyBtn} onClick={() => onDeny(t.id)}>
                          ↩ Reopen
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
