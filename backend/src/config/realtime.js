const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Attaches the Socket.IO server (rooms project:<id> and user:<id>) to an
// http.Server. Shared by the single-process dev server and the Notification
// service, which owns real-time delivery when the backend is split.
function attachRealtime(server) {
  const io = new Server(server, {
    cors: { origin: true }, // reflect the request's origin — works over LAN, the Vite dev proxy or an ngrok tunnel
  });

  io.on('connection', (socket) => {
    // each browser tab joins a room named after the project it's currently
    // viewing, so a task change only reaches people looking at that project
    socket.on('join-project', (projectId) => {
      if (projectId) socket.join(`project:${projectId}`);
    });
    socket.on('leave-project', (projectId) => {
      if (projectId) socket.leave(`project:${projectId}`);
    });

    // each logged-in tab also joins a private room for its user, so a new
    // notification can be pushed instantly. The JWT is verified so nobody can
    // listen on someone else's room.
    socket.on('join-user', (token) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload?.id) socket.join(`user:${payload.id}`);
      } catch (err) {
        // bad/expired token — simply not joined; polling still works
      }
    });
  });

  return io;
}

module.exports = { attachRealtime };
