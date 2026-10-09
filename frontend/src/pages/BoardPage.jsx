import { useEffect, useState, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import * as tasksApi from '../api/tasks';
import * as usersApi from '../api/users';
import socket from '../api/socket';
import { isOverdue } from '../utils/dueDate';
import { colorForProject } from '../utils/projectColor';
import KanbanColumn from '../components/KanbanColumn';
import ProjectSwitcher from '../components/ProjectSwitcher';
import NewTaskModal from '../components/NewTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskListView from '../components/TaskListView';
import styles from './board.module.css';

const COLUMNS = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' },
];

// Insert-or-replace by id. The server broadcasts "task:upserted" to EVERYONE
// in the project room — including the person who just created the task — and
// that event can land before or after the create request's own response.
// Whichever arrives second must replace the card, never add another one.
function upsertTaskInList(list, task) {
  return list.some((t) => t.id === task.id)
    ? list.map((t) => (t.id === task.id ? task : t))
    : [task, ...list];
}

export default function BoardPage() {
  const { currentProjectId, currentProject } = useProject();
  const { user } = useAuth();
  const canApprove = user?.role === 'admin' || user?.role === 'pm';
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [view, setView] = useState('board'); // 'board' | 'list'
  // Optional: float overdue tasks to the top of each column. On by default,
  // remembered per browser. (Card order within a column isn't saved anywhere
  // — dragging only changes the status — so this doesn't fight manual ordering.)
  const [overdueFirst, setOverdueFirst] = useState(() => localStorage.getItem('boardOverdueFirst') !== 'false');

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // ticks every 60s so the due-date countdown on every card stays live
  // without each card running its own timer
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const loadTasks = useCallback(async () => {
    if (!currentProjectId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await tasksApi.listTasks({ project_id: currentProjectId });
      setTasks(data);
    } catch (err) {
      setError('Could not load tasks. Is the API running?');
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    loadTasks();
    usersApi.listUsers().then(setUsers).catch(() => {});
  }, [loadTasks]);

  // live sync: join the current project's room and apply changes other
  // people make — drag-and-drop, create, edit, delete — the moment they
  // happen, no refresh needed
  useEffect(() => {
    if (!currentProjectId) return;
    socket.emit('join-project', currentProjectId);

    function handleUpserted(task) {
      if (task.project_id !== currentProjectId) return;
      setTasks((prev) => upsertTaskInList(prev, task));
      setSelectedTask((prev) => (prev && prev.id === task.id ? task : prev));
    }

    function handleDeleted({ id }) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSelectedTask((prev) => (prev && prev.id === id ? null : prev));
    }

    socket.on('task:upserted', handleUpserted);
    socket.on('task:deleted', handleDeleted);

    return () => {
      socket.emit('leave-project', currentProjectId);
      socket.off('task:upserted', handleUpserted);
      socket.off('task:deleted', handleDeleted);
    };
  }, [currentProjectId]);

  // The single place that decides whether a task may change status, shared by
  // drag-and-drop and the list view's status dropdown so both follow the same
  // rules (and the backend enforces them again).
  async function moveTask(taskId, newStatus) {
    const fromStatus = tasks.find((t) => t.id === taskId)?.status;
    if (!fromStatus || fromStatus === newStatus) return;

    // A Done task can only leave Done through the reopen flow: PM/admin,
    // back to To Do, with a required comment (the backend enforces this
    // too). Nothing is moved optimistically here — the card just snaps
    // back unless the reopen actually goes through.
    if (fromStatus === 'done' && newStatus !== 'done') {
      if (!canApprove) {
        setError('Only a PM or admin can reopen a Done task.');
      } else if (newStatus !== 'todo') {
        setError('A Done task can only be reopened to To Do, with a comment explaining why.');
      } else {
        handleDeny(taskId);
      }
      return;
    }

    // Members can't drag a card straight into Done — a PM/admin has to
    // approve it from Review first (see handleApprove below).
    if (newStatus === 'done' && !canApprove) {
      setError('Only a PM or admin can move a task to Done. Move it to Review for approval instead.');
      return;
    }

    // Members can only move their own tasks — this is also enforced by
    // disabling the drag itself (see TaskCard), but checked again here in
    // case the task's assignee list changed after the board last loaded.
    if (!canApprove) {
      const task = tasks.find((t) => t.id === taskId);
      const isAssignee = (task?.assignees || []).some((a) => a.id === user.id);
      if (!isAssignee) {
        setError('You can only move tasks you are assigned to.');
        return;
      }
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await tasksApi.updateTaskStatus(taskId, newStatus);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that move — reverting.');
      loadTasks();
    }
  }

  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    await moveTask(draggableId, destination.droppableId);
  }

  async function handleApprove(taskId) {
    try {
      const updated = await tasksApi.approveTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setSelectedTask((prev) => (prev && prev.id === taskId ? updated : prev));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not approve that task.');
    }
  }

  // Sends a task back to To Do — either denying a Review approval, or
  // reopening a Done task. Both need a comment explaining why; the backend
  // saves it as a real comment and notifies the assignees.
  async function handleDeny(taskId) {
    const isReopen = tasks.find((t) => t.id === taskId)?.status === 'done';
    const verb = isReopen ? 'reopen' : 'deny';

    // keep asking until the PM provides a comment or explicitly cancels (the
    // backend enforces this too, this just avoids a round-trip)
    let reason = window.prompt(`Comment explaining why this task is being sent back to To Do (required):`, '');
    if (reason === null) return; // user cancelled the prompt
    while (!reason.trim()) {
      reason = window.prompt(`A comment is required to ${verb} a task. Please explain what needs to change:`, '');
      if (reason === null) return;
    }
    try {
      const updated = await tasksApi.denyTask(taskId, reason);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setSelectedTask((prev) => (prev && prev.id === taskId ? updated : prev));
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${verb} that task.`);
    }
  }

  async function handleCreateFromModal(payload) {
    const created = await tasksApi.createTask({ ...payload, project_id: currentProjectId });
    setTasks((prev) => upsertTaskInList(prev, created));
  }

  async function handleUpdateTask(id, payload) {
    const updated = await tasksApi.updateTask(id, payload);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setSelectedTask(updated);
  }

  async function handleDeleteTask(id) {
    await tasksApi.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const filteredTasks = tasks.filter((t) => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterAssignee && !(t.assignees || []).some((a) => a.id === filterAssignee)) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const projectOverdue = tasks.filter((t) => isOverdue(t.due_date, t.status, now)).length;
  const overdueTotal = filteredTasks.filter((t) => isOverdue(t.due_date, t.status, now)).length;

  // Default order everywhere (columns and list): priority first (high → low),
  // then due date (earliest first, tasks without a due date last). With
  // "Overdue first" on, overdue tasks are pulled to the top of that order.
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (overdueFirst) {
      const aLate = isOverdue(a.due_date, a.status, now);
      const bLate = isOverdue(b.due_date, b.status, now);
      if (aLate !== bLate) return aLate ? -1 : 1;
    }
    const pr = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (pr !== 0) return pr;
    if (a.due_date && b.due_date) {
      const d = new Date(a.due_date) - new Date(b.due_date);
      if (d !== 0) return d;
    } else if (a.due_date || b.due_date) {
      return a.due_date ? -1 : 1;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  function toggleOverdueFirst() {
    const next = !overdueFirst;
    setOverdueFirst(next);
    localStorage.setItem('boardOverdueFirst', next ? 'true' : 'false');
  }

  function toggleSelect(taskId) {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }

  // list view's header checkbox: replace the selection with the given ids
  function setSelection(ids) {
    setSelectedIds(ids);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  async function handleBulkStatus(status) {
    try {
      await tasksApi.bulkUpdateStatus(selectedIds, status);
      setTasks((prev) => prev.map((t) => (selectedIds.includes(t.id) ? { ...t, status } : t)));
      exitSelectMode();
    } catch (err) {
      setError('Bulk status update failed.');
    }
  }

  async function handleBulkAssign(assigneeId) {
    try {
      const updated = await tasksApi.bulkAssign(selectedIds, assigneeId || null);
      const byId = new Map(updated.map((t) => [t.id, t]));
      setTasks((prev) => prev.map((t) => byId.get(t.id) || t));
      exitSelectMode();
    } catch (err) {
      setError('Bulk assign failed.');
    }
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} task(s)? This cannot be undone.`)) return;
    try {
      await tasksApi.bulkDelete(selectedIds);
      setTasks((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
      exitSelectMode();
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk delete failed.');
    }
  }

  if (loading) {
    return <div className={styles.boardScreen}>Loading board…</div>;
  }

  if (!currentProjectId) {
    return (
      <div className={styles.boardScreen}>
        <h1>Board</h1>
        <p className={styles.subLine}>
          No project yet. Ask an Admin/PM to create one from the Home page.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.boardScreen}>
      <div className={styles.boardHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>
            <span className={styles.titleDot} style={{ background: colorForProject(currentProjectId) }} />
            {currentProject?.name || 'Board'}
          </h1>
          <p className={styles.subLine}>
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
            {' · '}
            {tasks.filter((t) => t.status === 'done').length} done
            {projectOverdue > 0 && <span className={styles.subOverdue}> · {projectOverdue} overdue</span>}
          </p>
        </div>
        <button className={styles.newTaskBtn} onClick={() => setShowNewTaskModal(true)}>
          <span className={styles.newTaskPlus} aria-hidden="true">+</span>
          New task
        </button>
      </div>

      {error && <p style={{ color: 'var(--priority-high)', marginBottom: 16 }}>{error}</p>}

      <div className={styles.toolbar}>
        <div className={styles.filterBar}>
          <ProjectSwitcher canManageProjects={canApprove} />
          <input
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="">All assignees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            className={`btn ${overdueFirst ? 'btn-active' : 'btn-secondary'}`}
            onClick={toggleOverdueFirst}
            title="Show overdue tasks at the top of each column"
          >
            ⚠ Overdue first{overdueTotal > 0 ? ` (${overdueTotal})` : ''}
          </button>
          {(searchQuery || filterAssignee || filterPriority) && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSearchQuery('');
                setFilterAssignee('');
                setFilterPriority('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className={styles.viewControls}>
          <button
            className={`btn ${selectMode ? 'btn-active' : 'btn-secondary'}`}
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            title="Select several cards to move, assign or delete them together"
          >
            {selectMode ? 'Cancel select' : 'Select'}
          </button>
          <div className={styles.segmented} role="tablist" aria-label="View">
            <button
              role="tab"
              aria-selected={view === 'board'}
              className={`${styles.segBtn} ${view === 'board' ? styles.segBtnActive : ''}`}
              onClick={() => setView('board')}
            >
              Board
            </button>
            <button
              role="tab"
              aria-selected={view === 'list'}
              className={`${styles.segBtn} ${view === 'list' ? styles.segBtnActive : ''}`}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            padding: '10px 14px',
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-accent)',
            borderRadius: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.length} selected</span>
          <select onChange={(e) => e.target.value && handleBulkStatus(e.target.value)} defaultValue="">
            <option value="" disabled>
              Move to…
            </option>
            <option value="todo">{canApprove ? 'To Do' : 'Back to To Do'}</option>
            <option value="in_progress">{canApprove ? 'In Progress' : 'Accept (In Progress)'}</option>
            <option value="review">{canApprove ? 'Review' : 'Submit for review'}</option>
            {canApprove && <option value="done">Done</option>}
          </select>
          <select
            onChange={(e) => handleBulkAssign(e.target.value === '__clear__' ? null : e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Add assignee…
            </option>
            {canApprove && <option value="__clear__">Clear all assignees</option>}
            {/* members can only bring in fellow members, and can't clear assignees */}
            {users
              .filter((u) => canApprove || u.role === 'member')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          <button className="btn btn-danger" onClick={handleBulkDelete}>
            Delete selected
          </button>
        </div>
      )}

      {view === 'list' ? (
        <TaskListView
          tasks={sortedTasks}
          now={now}
          currentUser={user}
          canApprove={canApprove}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={setSelection}
          onOpen={setSelectedTask}
          onStatusChange={moveTask}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.columns}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                tasks={sortedTasks.filter((t) => t.status === col.status)}
                onTaskClick={setSelectedTask}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                canApprove={canApprove}
                onApprove={handleApprove}
                onDeny={handleDeny}
                onMove={moveTask}
                currentUser={user}
                now={now}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {showNewTaskModal && (
        <NewTaskModal
          users={users}
          onClose={() => setShowNewTaskModal(false)}
          onCreate={handleCreateFromModal}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          canApprove={canApprove}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}
    </div>
  );
}
