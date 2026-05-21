import { defineConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  fmt: {
    printWidth: 80,
    singleQuote: true,
    trailingComma: 'es5',
    tabWidth: 2,
  },
  build: {
    sourcemap: 'hidden',
  },
  staged: {
    '*.{js,jsx,ts,tsx}': 'vp check --fix',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/sockets/overview': { target: 'http://localhost:8080', ws: true },
      '/sockets/arrivals': { target: 'http://localhost:8080', ws: true },
      '/sockets/flights': { target: 'http://localhost:8080', ws: true },
      '/sockets/session-users': { target: 'http://localhost:8080', ws: true },
      '/sockets/chat': { target: 'http://localhost:9901', ws: true },
      '/sockets/global-chat': { target: 'http://localhost:9901', ws: true },
      '/sockets/voice-chat': { target: 'http://localhost:9901', ws: true },
      '/sockets/notifications': { target: 'http://localhost:9901', ws: true },
      '/sockets/sector-controller': {
        target: 'http://localhost:9901',
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});