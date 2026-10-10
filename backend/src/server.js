require('dotenv').config();

const http = require('http');
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
const projectRoutes = require('./routes/project.routes');
const lineRoutes = require('./routes/line.routes');
const { handleWebhook } = require('./controllers/line.controller');
const { startDueDateScheduler } = require('./jobs/dueDateCheck');
const { startNotificationPush } = require('./config/notificationPush');
const { startLineDelivery } = require('./config/lineDelivery');
const { attachRealtime } = require('./config/realtime');
const localize = require('./middleware/localize');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());

// LINE webhook MUST be mounted with express.raw() before express.json() below —
// LINE's signature verification needs the exact original request bytes, and
// express.json() would already have consumed/parsed the stream by then.
app.post('/line/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());

// Thai/English API messages, chosen by the Accept-Language header
app.use(localize);

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
app.use('/projects', projectRoutes);
app.use('/line', lineRoutes);

// Placeholder root
app.get('/', (req, res) => {
  res.json({ message: 'Task Tracking System API' });
});

// ── Real-time board sync ───────────────────────────────────────
// Wrap Express in a plain http.Server so Socket.IO can share the same port
// (4000) instead of needing one of its own. Controllers reach `io` via
// req.app.get('io') so they can broadcast after a DB write succeeds.
const server = http.createServer(app);
const io = attachRealtime(server);
app.set('io', io);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startDueDateScheduler();
  startNotificationPush(io);
  startLineDelivery();
});
