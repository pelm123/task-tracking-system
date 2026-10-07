import { io } from 'socket.io-client';

// A single shared connection for the whole app. Connecting with no URL
// means "same origin as the page" — Vite's dev proxy (see vite.config.js)
// forwards the /socket.io path to the backend, so this works identically
// whether the app is opened on localhost, over the LAN, or through an
// ngrok tunnel, with nothing to configure per-environment.
const socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export default socket;
