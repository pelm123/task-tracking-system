import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so it's reachable from other machines (e.g. Windows browser)
    allowedHosts: true, // accept requests regardless of which hostname/IP was used to reach this server
    proxy: {
      // any request starting with /api is forwarded to the backend on port 4000,
      // with the /api prefix stripped before it reaches Express
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
