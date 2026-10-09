const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listUsers, listPendingUsers, approveUser, updateUserRole, deleteUser } = require('../controllers/user.controller');

const router = express.Router();

router.use(authenticate);
router.get('/', listUsers);
router.get('/pending', requireRole('admin'), listPendingUsers);
router.patch('/:id/approve', requireRole('admin'), approveUser);
router.patch('/:id', requireRole('admin'), updateUserRole);
router.delete('/:id', requireRole('admin'), deleteUser);

module.exports = router;
