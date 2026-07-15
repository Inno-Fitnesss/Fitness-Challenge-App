import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: новая версия SW активируется сразу (skipWaiting+clientsClaim),
      // а клиент перезагружается из src/pwa.ts — деплой доезжает без действий юзера.
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: 'WOWFIT — фитнес-челленджи',
        short_name: 'WOWFIT',
        description:
          'Фитнес-челленджи с проверкой техники упражнений через камеру: соревнуйся с друзьями, следи за прогрессом и шагами.',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#FF5722',
        icons: [
          // any и maskable — раздельными записями: maskable-иконку Android
          // обрезает под круг, полноразмерную обрезать нельзя.
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Прекешируем весь билд: html/js/css + статические иконки, шрифты и звуки.
        // Картинки статей кэшируются в рантайме (см. runtimeCaching), чтобы не
        // раздувать установку.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,wav}'],
        // Основной JS-бандл ~1.5MB > дефолтного лимита 2MiB c запасом на рост.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Бэкендовые адреса не должны падать в SPA-фолбэк и вообще
        // обрабатываться SW-навигацией.
        navigateFallbackDenylist: [/^\/api\//, /^\/docs/, /^\/redoc/, /^\/openapi\.json/],
        runtimeCaching: [
          {
            // Картинки (обложки статей и т.п.) — CacheFirst с ограничением,
            // чтобы работали офлайн после первого просмотра.
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'wowfit-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
