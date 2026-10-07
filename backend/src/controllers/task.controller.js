const pool = require('../config/db');
const { notifyLineIfLinked } = require('../config/line');

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

// shared SELECT fragment: aggregates every row in task_assignees into a
// single JSON array per task, e.g. [{"id": "...", "name": "Alice"}, ...]
// so one query returns a task with all of its assignees, in any count.
const ASSIGNEES_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name)
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id = t.id),
    '[]'
  ) AS assignees
`;

// broadcasts a task change to every browser tab currently viewing this
// project's board, so drag-and-drop/create/edit/delete show up live for
// everyone without a refresh
function broadcastTask(req, projectId, event, payload) {
  const io = req.app.get('io');
  if (io && projectId) {
    io.to(`project:${projectId}`).emit(event, payload);
  }
}

async function getUserName(userId) {
  if (!userId) return null;
  const result = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.name || null;
}

function formatDueDate(dueDate) {
  if (!dueDate) return 'no due date';
  return new Date(dueDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function getEnrichedTask(id) {
  const result = await pool.query(
    `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
            t.project_id, p.name AS project_name,
            t.created_by, c.name AS creator_name,
            t.created_at, t.updated_at,
            ${ASSIGNEES_SUBQUERY}
     FROM tasks t
     LEFT JOIN users c ON c.id = t.created_by
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1`,
    [id]
  );
  return result.rows[0];
}

// Notifies a specific set of user IDs that they were assigned to `task`.
// task must already be the ENRICHED version (has project_name, priority, due_date).
async function notifyAssignees(task, userIds, actorId) {
  const actorName = await getUserName(actorId);
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  const message = `${actorName} assigned you to "${task.title}" (${priorityLabel} priority, due ${formatDueDate(task.due_date)}) in ${task.project_name}`;

  for (const userId of userIds) {
    if (!userId || userId === actorId) continue; // don't notify yourself
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'assigned', $3)`,
        [userId, task.id, message]
      );
    } catch (err) {
      console.error('notifyAssignees error:', err.message);
    }
    notifyLineIfLinked(userId, `📋 ${message}`);
  }
}

// Replaces a task's full assignee set with `assigneeIds` (deduped).
// Returns the list of user IDs that are newly added (weren't assigned before),
// so callers can notify only those.
async function setTaskAssignees(taskId, assigneeIds) {
  const uniqueIds = [...new Set((assigneeIds || []).filter(Boolean))];

  const before = await pool.query('SELECT user_id FROM task_assignees WHERE task_id = $1', [taskId]);
  const previousIds = new Set(before.rows.map((r) => r.user_id));

  await pool.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);
  for (const userId of uniqueIds) {
    await pool.query(
      `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [taskId, userId]
    );
  }

  return uniqueIds.filter((id) => !previousIds.has(id));
}

// GET /tasks?project_id=...&status=todo&assignee_id=...&search=...
async function listTasks(req, res) {
  const { status, assignee_id, search, project_id } = req.query;
  const conditions = [];
  const values = [];

  if (project_id) {
    values.push(project_id);
    conditions.push(`t.project_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`t.status = $${values.length}`);
  }
  if (assignee_id) {
    values.push(assignee_id);
    conditions.push(`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $${values.length})`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(t.title ILIKE $${values.length} OR t.description ILIKE $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
              t.project_id, p.name AS project_name,
              t.created_by, c.name AS creator_name,
              t.created_at, t.updated_at,
              ${ASSIGNEES_SUBQUERY}
       FROM tasks t
       LEFT JOIN users c ON c.id = t.created_by
       LEFT JOIN projects p ON p.id = t.project_id
       ${whereClause}
       ORDER BY t.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List tasks error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /tasks/:id
async function getTask(req, res) {
  try {
    const task = await getEnrichedTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    console.error('Get task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /tasks
async function createTask(req, res) {
  const { title, description, priority, due_date, assignee_ids, project_id } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }
  if (!project_id) {
    return res.status(400).json({ message: 'project_id is required' });
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: `priority must be one of ${VALID_PRIORITIES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (project_id, title, description, priority, due_date, created_by)
       VALUES ($1, $2, $3, COALESCE($4::task_priority, 'medium'), $5, $6)
       RETURNING id`,
      [project_id, title, description || null, priority, due_date || null, req.user.id]
    );

    const taskId = result.rows[0].id;
    const newlyAssigned = await setTaskAssignees(taskId, assignee_ids);
    const task = await getEnrichedTask(taskId);
    await notifyAssignees(task, newlyAssigned, req.user.id);
    broadcastTask(req, task.project_id, 'task:upserted', task);

    res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// true if two due_date values (either may be null/undefined/a string) represent the same instant
function sameDueDate(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

// PATCH /tasks/:id  (general edit: title, description, priority, due_date, assignee_ids)
async function updateTask(req, res) {
  const { title, description, priority, due_date, assignee_ids } = req.body;

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: `priority must be one of ${VALID_PRIORITIES.join(', ')}` });
  }

  try {
    const before = await pool.query('SELECT id, due_date FROM tasks WHERE id = $1', [req.params.id]);
    if (before.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Members can reschedule (change the due date of) a task only when
    // they're one of its assignees — they can't move someone else's dates
    // around. PM/admin aren't restricted. Only enforced when the due date
    // is actually changing, so saving the rest of the form doesn't 403.
    if (
      due_date !== undefined &&
      req.user.role === 'member' &&
      !sameDueDate(due_date, before.rows[0].due_date)
    ) {
      const assignedCheck = await pool.query(
        'SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ message: 'You can only reschedule tasks you are assigned to.' });
      }
    }

    await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         priority = COALESCE($3::task_priority, priority),
         due_date = COALESCE($4, due_date)
       WHERE id = $5`,
      [title, description, priority, due_date, req.params.id]
    );

    // assignee_ids is optional on this endpoint — only touch the assignee
    // set when the caller actually sent the field (an empty array is a
    // valid "unassign everyone", so we check for undefined, not falsy).
    let newlyAssigned = [];
    if (assignee_ids !== undefined) {
      newlyAssigned = await setTaskAssignees(req.params.id, assignee_ids);
    }

    const task = await getEnrichedTask(req.params.id);

    if (newlyAssigned.length > 0) {
      await notifyAssignees(task, newlyAssigned, req.user.id);
    }
    broadcastTask(req, task.project_id, 'task:upserted', task);

    res.json(task);
  } catch (err) {
    console.error('Update task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /tasks/:id/status  (dedicated endpoint for Kanban drag-and-drop)
async function updateTaskStatus(req, res) {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }

  // Members can move a task between To Do / In Progress / Review freely,
  // but Done is reserved for PM/admin approval — see approveTask/denyTask.
  if (status === 'done' && !['admin', 'pm'].includes(req.user.role)) {
    return res.status(403).json({
      message: 'Only a PM or admin can move a task to Done. Move it to Review and ask your PM to approve it.',
    });
  }

  try {
    const before = await pool.query('SELECT status FROM tasks WHERE id = $1', [req.params.id]);
    if (before.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const previousStatus = before.rows[0].status;

    // A member can only move a task they're actually assigned to — not
    // someone else's. PM/admin can move anything.
    if (req.user.role === 'member') {
      const assignedCheck = await pool.query(
        'SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ message: 'You can only move tasks you are assigned to.' });
      }
    }

    await pool.query(`UPDATE tasks SET status = $1::task_status WHERE id = $2`, [status, req.params.id]);

    const task = await getEnrichedTask(req.params.id);

    if (task.assignees.length > 0) {
      const actorName = await getUserName(req.user.id);
      const message = `${actorName} moved "${task.title}" from ${STATUS_LABELS[previousStatus]} → ${STATUS_LABELS[status]}`;
      for (const assignee of task.assignees) {
        if (assignee.id === req.user.id) continue; // don't notify the actor
        await pool.query(
          `INSERT INTO notifications (user_id, task_id, type, message)
           VALUES ($1, $2, 'status_change', $3)`,
          [assignee.id, task.id, message]
        );
        notifyLineIfLinked(assignee.id, `🔄 ${message}`);
      }
    }
    broadcastTask(req, task.project_id, 'task:upserted', task);

    res.json(task);
  } catch (err) {
    console.error('Update task status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /tasks/:id/approve — PM/admin only. Approves a task that's in Review,
// moving it to Done. This is the only path into Done; members can't set it
// directly (see updateTaskStatus above).
async function approveTask(req, res) {
  try {
    const before = await pool.query('SELECT status FROM tasks WHERE id = $1', [req.params.id]);
    if (before.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    if (before.rows[0].status !== 'review') {
      return res.status(400).json({ message: 'Only a task currently in Review can be approved.' });
    }

    await pool.query(`UPDATE tasks SET status = 'done'::task_status WHERE id = $1`, [req.params.id]);
    const task = await getEnrichedTask(req.params.id);

    const actorName = await getUserName(req.user.id);
    const message = `${actorName} approved "${task.title}" — moved to Done`;
    for (const assignee of task.assignees) {
      if (assignee.id === req.user.id) continue; // don't notify the actor
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'approved', $3)`,
        [assignee.id, task.id, message]
      );
      notifyLineIfLinked(assignee.id, `✅ ${message}`);
    }

    broadcastTask(req, task.project_id, 'task:upserted', task);
    res.json(task);
  } catch (err) {
    console.error('Approve task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /tasks/:id/deny — PM/admin only. Denies a task that's in Review,
// sending it back to To Do. A comment explaining why is REQUIRED — it's
// saved as a real comment on the task (so it shows up in the comment
// thread, same as any other comment) and also sent as a notification to
// every assignee.
async function denyTask(req, res) {
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: 'A comment explaining why the task was denied is required.' });
  }
  const trimmedReason = reason.trim();

  try {
    const before = await pool.query('SELECT status FROM tasks WHERE id = $1', [req.params.id]);
    if (before.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    if (before.rows[0].status !== 'review') {
      return res.status(400).json({ message: 'Only a task currently in Review can be denied.' });
    }

    await pool.query(`UPDATE tasks SET status = 'todo'::task_status WHERE id = $1`, [req.params.id]);

    // record the PM's reason as a real comment, so it's visible in the
    // task's comment thread, not just buried in a notification string
    const commentResult = await pool.query(
      `INSERT INTO comments (task_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at, user_id`,
      [req.params.id, req.user.id, `Approval denied — returned to To Do: ${trimmedReason}`]
    );

    const task = await getEnrichedTask(req.params.id);

    const actorName = await getUserName(req.user.id);
    const message = `${actorName} returned "${task.title}" to To Do (approval denied) — "${trimmedReason}"`;
    for (const assignee of task.assignees) {
      if (assignee.id === req.user.id) continue; // don't notify the actor
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, message)
         VALUES ($1, $2, 'approval_denied', $3)`,
        [assignee.id, task.id, message]
      );
      notifyLineIfLinked(assignee.id, `↩️ ${message}`);
    }

    broadcastTask(req, task.project_id, 'task:upserted', task);
    res.json({ ...task, denialComment: { ...commentResult.rows[0], author_name: actorName } });
  } catch (err) {
    console.error('Deny task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /tasks/:id — admin/pm, or the task's own creator
async function deleteTask(req, res) {
  try {
    const existing = await pool.query('SELECT created_by, project_id FROM tasks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isPrivileged = ['admin', 'pm'].includes(req.user.role);
    const isOwner = existing.rows[0].created_by === req.user.id;
    if (!isPrivileged && !isOwner) {
      return res.status(403).json({ message: 'Only an admin, PM, or the task creator can delete this task' });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    broadcastTask(req, existing.rows[0].project_id, 'task:deleted', { id: req.params.id });
    res.status(204).send();
  } catch (err) {
    console.error('Delete task error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /tasks/bulk/status
async function bulkUpdateStatus(req, res) {
  const { taskIds, status } = req.body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ message: 'taskIds must be a non-empty array' });
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }
  if (status === 'done' && !['admin', 'pm'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only a PM or admin can move tasks to Done.' });
  }

  try {
    // A member can only bulk-move tasks they're assigned to — reject the
    // whole batch if any selected task belongs to someone else, rather than
    // silently moving some and skipping others.
    if (req.user.role === 'member') {
      const unowned = await pool.query(
        `SELECT t.id FROM tasks t
         WHERE t.id = ANY($1::uuid[])
           AND NOT EXISTS (
             SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2
           )`,
        [taskIds, req.user.id]
      );
      if (unowned.rows.length > 0) {
        return res.status(403).json({ message: 'You can only move tasks you are assigned to.' });
      }
    }

    const result = await pool.query(
      `UPDATE tasks SET status = $1::task_status WHERE id = ANY($2::uuid[]) RETURNING id`,
      [status, taskIds]
    );
    const updated = await Promise.all(result.rows.map((r) => getEnrichedTask(r.id)));
    for (const task of updated) {
      broadcastTask(req, task.project_id, 'task:upserted', task);
    }
    res.json(updated);
  } catch (err) {
    console.error('Bulk update status error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PATCH /tasks/bulk/assign
// Adds `assignee_id` as an additional assignee to every task in `taskIds`
// (existing assignees are kept). Pass assignee_id: null to clear ALL
// assignees from every selected task instead.
async function bulkAssign(req, res) {
  const { taskIds, assignee_id } = req.body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ message: 'taskIds must be a non-empty array' });
  }

  try {
    if (!assignee_id) {
      await pool.query(`DELETE FROM task_assignees WHERE task_id = ANY($1::uuid[])`, [taskIds]);
    } else {
      for (const taskId of taskIds) {
        await pool.query(
          `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [taskId, assignee_id]
        );
      }
      for (const taskId of taskIds) {
        const task = await getEnrichedTask(taskId);
        await notifyAssignees(task, [assignee_id], req.user.id);
      }
    }

    const updated = await Promise.all(taskIds.map((id) => getEnrichedTask(id)));
    for (const task of updated) {
      broadcastTask(req, task.project_id, 'task:upserted', task);
    }
    res.json(updated);
  } catch (err) {
    console.error('Bulk assign error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /tasks/bulk
async function bulkDelete(req, res) {
  const { taskIds } = req.body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ message: 'taskIds must be a non-empty array' });
  }

  try {
    const existing = await pool.query(
      `SELECT id, project_id FROM tasks WHERE id = ANY($1::uuid[])`,
      [taskIds]
    );
    await pool.query(`DELETE FROM tasks WHERE id = ANY($1::uuid[])`, [taskIds]);
    for (const row of existing.rows) {
      broadcastTask(req, row.project_id, 'task:deleted', { id: row.id });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Bulk delete error:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  approveTask,
  denyTask,
  deleteTask,
  bulkUpdateStatus,
  bulkAssign,
  bulkDelete,
};
