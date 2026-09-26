import { defineConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
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
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});
