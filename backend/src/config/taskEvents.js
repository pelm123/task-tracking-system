const { listen } = require('./pgListen');
const { getEnrichedTask } = require('./taskQuery');

// Relays task changes published by the Task service (Postgres NOTIFY on
// `task_event`) to the browsers in the matching project room.
function startTaskEventRelay(io) {
  listen(
    {
      task_event: async (raw) => {
        const msg = JSON.parse(raw);
        let payload = msg.payload;
        if (msg.ref) {
          payload = await getEnrichedTask(msg.ref); // oversized payloads travel as a reference
          if (!payload) return;
        }
        io.to(msg.room).emit(msg.event, payload);
      },
    },
    'task-events'
  );
}

module.exports = { startTaskEventRelay };
