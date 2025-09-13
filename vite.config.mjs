import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/hubspot': { target, changeOrigin: true },
      '/api/openai': { target, changeOrigin: true },
    },
  },
  preview: {
    port: 5174,
  },
});
