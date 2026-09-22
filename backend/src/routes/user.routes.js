const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { listUsers, updateUserRole, deleteUser } = require('../controllers/user.controller');

const router = express.Router();

router.use(authenticate);
router.get('/', listUsers);
router.patch('/:id', requireRole('admin'), updateUserRole);
router.delete('/:id', requireRole('admin'), deleteUser);

module.exports = router;
