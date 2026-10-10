// Auth service: sign-up, login, profile, and user administration.
const { runService } = require('./base');

runService({
  name: 'auth',
  mount(app) {
    app.use('/auth', require('../routes/auth.routes'));
    app.use('/users', require('../routes/user.routes'));
  },
});
