import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts on purpose — keeps the production build
// config untouched. Run with: npm run test
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Виртуальный модуль vite-plugin-pwa существует только в vite-сборке;
      // в тестах подменяем заглушкой (см. src/pwa.test.ts).
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/mocks/pwa-register.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['e2e/**', 'node_modules/**'],
    },
    exclude: ['e2e/**', 'node_modules/**'],
  },
});