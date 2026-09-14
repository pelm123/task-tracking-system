require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const commentRoutes = require('./routes/comment.routes');
const commentByIdRoutes = require('./routes/commentById.routes');
const { taskAttachmentRouter, attachmentByIdRouter } = require('./routes/attachment.routes');
const notificationRoutes = require('./routes/notification.routes');
const userRoutes = require('./routes/user.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const { startDueDateScheduler } = require('./jobs/dueDateCheck');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/', healthRoutes);
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/tasks/:taskId/comments', commentRoutes);
app.use('/comments', commentByIdRoutes);
app.use('/tasks/:taskId/attachments', taskAttachmentRouter);
app.use('/attachments', attachmentByIdRouter);
app.use('/notifications', notificationRoutes);
app.use('/users', userRoutes);
app.use('/dashboard', dashboardRoutes);

// Placeholder root
app.get('/', (req, res) => {
  res.json({ message: 'Task Tracking System API' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startDueDateScheduler();
});
