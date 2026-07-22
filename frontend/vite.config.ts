import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_PROXY_TARGET (из .env или переменной окружения) позволяет направить
  // dev/preview-прокси на нестандартный адрес бэкенда, не трогая конфиг.
  const proxyTarget =
    loadEnv(mode, '.', 'VITE_').VITE_PROXY_TARGET || 'http://localhost:8001';

  return {
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,wav,pdf}'],
        // Основной JS-бандл ~1.5MB > дефолтного лимита 2MiB c запасом на рост.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Бэкендовые адреса не должны падать в SPA-фолбэк и вообще
        // обрабатываться SW-навигацией.
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/legal\//,
          /^\/docs/,
          /^\/redoc/,
          /^\/openapi\.json/,
        ],
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
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    // `npm run preview -- --host` — прод-сборка, доступная из локальной сети
    // (проверка PWA с телефона). API проксируется на локальный бэкенд,
    // как и в dev (поднимите его: см. backend/README или docker compose).
    host: true,
    // Для проверки PWA с телефона через HTTPS-туннель:
    //   cloudflared tunnel --url http://localhost:4173
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  };
});
