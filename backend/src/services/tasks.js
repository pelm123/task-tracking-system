// Task/Project service: projects, tasks, comments, attachments, dashboard,
// and the due-date risk features. Task changes are published to the
// Notification service (real-time) over Postgres NOTIFY.
const { runService } = require('./base');

runService({
  name: 'tasks',
  mount(app) {
    const { taskAttachmentRouter, attachmentByIdRouter } = require('../routes/attachment.routes');
    app.use('/tasks', require('../routes/task.routes'));
    app.use('/tasks/:taskId/comments', require('../routes/comment.routes'));
    app.use('/comments', require('../routes/commentById.routes'));
    app.use('/tasks/:taskId/attachments', taskAttachmentRouter);
    app.use('/attachments', attachmentByIdRouter);
    app.use('/dashboard', require('../routes/dashboard.routes'));
    app.use('/projects', require('../routes/project.routes'));
  },
});
