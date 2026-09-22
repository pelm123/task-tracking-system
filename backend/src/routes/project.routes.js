const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} = require('../controllers/project.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', listProjects);
router.post('/', requireRole('admin', 'pm'), createProject);
router.patch('/:id', requireRole('admin', 'pm'), updateProject);
router.delete('/:id', requireRole('admin', 'pm'), deleteProject);

module.exports = router;
