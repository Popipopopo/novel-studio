import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages base path: set via env or default to './' for flexible deploy.
// When deploying to https://<user>.github.io/<repo>/ set VITE_BASE=/<repo>/
const base = process.env.VITE_BASE ?? './';

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
