const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
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
  listTaskActivity,
} = require('../controllers/task.controller');

const router = express.Router();

router.use(authenticate); // every route below requires a valid JWT

// bulk routes MUST come before /:id routes, or Express would treat
// "bulk" as an :id value
router.patch('/bulk/status', bulkUpdateStatus);
router.patch('/bulk/assign', bulkAssign);
// admin/pm can bulk-delete any task; a member can only bulk-delete tasks
// they created themselves — see the ownership check inside bulkDelete
router.delete('/bulk', bulkDelete);

router.get('/', listTasks);
router.get('/:id', getTask);
router.get('/:id/activity', listTaskActivity);
router.post('/', createTask);
router.patch('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
// approve/deny are PM/admin-only — the only way a task reaches Done, or gets
// bounced back to To Do after a failed review
router.post('/:id/approve', requireRole('admin', 'pm'), approveTask);
router.post('/:id/deny', requireRole('admin', 'pm'), denyTask);
// admin/pm can delete any task; a member can delete only a task they
// created themselves — see the ownership check inside deleteTask
router.delete('/:id', deleteTask);

module.exports = router;
