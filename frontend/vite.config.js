import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so it's reachable from other machines (e.g. Windows browser)
    // accept LAN access (any IP/hostname) plus any ngrok tunnel hostname —
    // ngrok's free tier assigns a new random subdomain every time you restart
    // it, so a leading-dot wildcard matches all of them instead of needing
    // to update this file each time
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io'],
    proxy: {
      // any request starting with /api is forwarded to the backend on port 4000,
      // with the /api prefix stripped before it reaches Express
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // LINE's webhook calls this path directly (no /api prefix, since LINE
      // doesn't know about our proxy convention) — forward it straight through
      // so a single ngrok tunnel on 5173 can serve both the app AND the webhook
      '/line/webhook': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // Socket.IO's live-updates connection (WebSocket upgrade) — proxying
      // it through Vite means the browser always connects to "itself"
      // (same origin, whether that's localhost, the LAN IP, or an ngrok
      // tunnel) and never needs to know the backend's real address
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
