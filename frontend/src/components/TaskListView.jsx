import { useMemo, useState } from 'react';
import { getDueCountdown, isOverdue, formatOverdueShort, formatDueDateShort } from '../utils/dueDate';
import { t as tr, getLocale } from '../i18n';
import RiskBadge from './RiskBadge';
import styles from './taskListView.module.css';

const STATUS_ORDER = { todo: 0, in_progress: 1, review: 2, done: 3 };
const STATUS_COLORS = {
  todo: 'var(--status-todo)',
  in_progress: 'var(--status-in-progress)',
  review: 'var(--status-review)',
  done: 'var(--status-done)',
};
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
  riskById,
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
                    title={allSelected ? tr('list.clearSelection') : tr('list.selectAllHint')}
                    aria-label={tr('list.selectAll')}
                  />
                </th>
              )}
              <th aria-sort={ariaSort('title')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('title')}>
                  {tr('list.title')} {sortIndicator('title')}
                </button>
              </th>
              <th aria-sort={ariaSort('status')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('status')}>
                  {tr('list.status')} {sortIndicator('status')}
                </button>
              </th>
              <th aria-sort={ariaSort('priority')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('priority')}>
                  {tr('list.priority')} {sortIndicator('priority')}
                </button>
              </th>
              <th>{tr('list.assignees')}</th>
              <th aria-sort={ariaSort('due')}>
                <button className={styles.sortBtn} onClick={() => cycleSort('due')}>
                  {tr('list.due')} {sortIndicator('due')}
                </button>
              </th>
              {canApprove && <th className={styles.actionsCol}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className={styles.emptyRow}>
                  {tr('list.noMatch')}
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const overdue = isOverdue(t.due_date, t.status, now);
              const countdown = getDueCountdown(t.due_date, now);
              const movable = canMoveTask(t);
              const selected = selectedIds.includes(t.id);

              return (
                <tr
                  key={t.id}
                  className={`${styles.row} ${overdue ? styles.rowOverdue : ''} ${selected ? styles.rowSelected : ''}`}
                  onClick={() => (selectMode ? movable && onToggleSelect(t.id) : onOpen(t))}
                  title={selectMode && !movable ? tr('list.notAssigned') : undefined}
                >
                  {selectMode && (
                    <td className={styles.checkCol} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!movable}
                        onChange={() => onToggleSelect(t.id)}
                        aria-label={tr('list.selectRow', { title: t.title })}
                      />
                    </td>
                  )}

                  <td className={styles.titleCell}>
                    <span className={styles.titleText}>{t.title}</span>
                    <RiskBadge risk={riskById?.[t.id]} />
                    {overdue && (
                      <span className={styles.overdueBadge} title={countdown?.label}>
                        {tr('home.overduePill', { text: formatOverdueShort(t.due_date, now) })}
                      </span>
                    )}
                  </td>

                  <td onClick={(e) => e.stopPropagation()}>
                    <span className={styles.statusCellInner}>
                      <span className={styles.statusBadge} style={{ '--status-color': STATUS_COLORS[t.status] }}>
                        {tr(`status.${t.status}`)}
                      </span>
                      {!selectMode && movable && t.status === 'todo' && (
                        <button className={styles.acceptBtn} onClick={() => onStatusChange(t.id, 'in_progress')}>
                          {tr('list.accept')}
                        </button>
                      )}
                      {!selectMode && movable && t.status === 'in_progress' && (
                        <>
                          <button
                            className={styles.backBtn}
                            title={tr('list.backHint')}
                            onClick={() => onStatusChange(t.id, 'todo')}
                          >
                            {tr('board.back')}
                          </button>
                          <button className={styles.submitBtn} onClick={() => onStatusChange(t.id, 'review')}>
                            {tr('board.submit')}
                          </button>
                        </>
                      )}
                    </span>
                  </td>

                  <td>
                    <span className={styles.priorityChip} style={{ '--chip-color': PRIORITY_COLORS[t.priority] }}>
                      ⚑ {tr(`priority.${t.priority}`)}
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
                          {t.assignees.length === 1 ? t.assignees[0].name : tr('board.assigneesN', { n: t.assignees.length })}
                        </span>
                      </span>
                    ) : (
                      <span className={styles.muted}>{tr('list.unassigned')}</span>
                    )}
                  </td>

                  <td>
                    {t.due_date ? (
                      <div className={styles.dueCell} title={new Date(t.due_date).toLocaleString(getLocale())}>
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
                      <span className={styles.muted}>{tr('home.noDueDate')}</span>
                    )}
                  </td>

                  {canApprove && (
                    <td className={styles.actionsCol} onClick={(e) => e.stopPropagation()}>
                      {t.status === 'review' && (
                        <span className={styles.actionBtns}>
                          <button className={styles.approveBtn} onClick={() => onApprove(t.id)}>
                            {tr('home.approve')}
                          </button>
                          <button className={styles.denyBtn} onClick={() => onDeny(t.id)}>
                            {tr('home.deny')}
                          </button>
                        </span>
                      )}
                      {t.status === 'done' && (
                        <button className={styles.denyBtn} onClick={() => onDeny(t.id)}>
                          {tr('board.reopen')}
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
