const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getActivity,
} = require('../controllers/project.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', listProjects);
router.get('/:id/activity', getActivity);
router.post('/', requireRole('admin', 'pm'), createProject);
router.patch('/:id', requireRole('admin', 'pm'), updateProject);
router.delete('/:id', requireRole('admin', 'pm'), deleteProject);

module.exports = router;
