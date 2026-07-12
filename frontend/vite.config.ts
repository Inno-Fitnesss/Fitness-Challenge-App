import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // HTTPS_DEV=1 npm run dev -- --host — для теста камеры с телефона в
    // локальной сети (getUserMedia требует secure context, обычный http по
    // LAN-адресу браузер телефона для камеры не пропустит).
    ...(process.env.HTTPS_DEV ? [basicSsl()] : []),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
