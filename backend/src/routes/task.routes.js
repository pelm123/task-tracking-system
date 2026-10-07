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
} = require('../controllers/task.controller');

const router = express.Router();

router.use(authenticate); // every route below requires a valid JWT

// bulk routes MUST come before /:id routes, or Express would treat
// "bulk" as an :id value
router.patch('/bulk/status', bulkUpdateStatus);
router.patch('/bulk/assign', bulkAssign);
router.delete('/bulk', requireRole('admin', 'pm'), bulkDelete);

router.get('/', listTasks);
router.get('/:id', getTask);
router.post('/', createTask);
router.patch('/:id', updateTask);
router.patch('/:id/status', updateTaskStatus);
// approve/deny are PM/admin-only — the only way a task reaches Done, or gets
// bounced back to To Do after a failed review
router.post('/:id/approve', requireRole('admin', 'pm'), approveTask);
router.post('/:id/deny', requireRole('admin', 'pm'), denyTask);
router.delete('/:id', deleteTask);

module.exports = router;
