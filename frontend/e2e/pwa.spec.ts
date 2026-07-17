/**
 * PWA end-to-end: service worker, офлайн-оболочка, манифест.
 *
 * В отличие от остальных e2e, бэкенд и dev-сервер НЕ нужны — спек поднимает
 * собственный статический сервер поверх production-сборки. Нужен только
 * свежий `npm run build` (иначе спек упадёт с подсказкой).
 */
import { createServer, type Server } from 'http';
import { existsSync, readFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 4599;
const BASE = `http://localhost:${PORT}`;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.wav': 'audio/wav',
};

let server: Server;

test.beforeAll(async () => {
  expect(
    existsSync(join(DIST, 'sw.js')),
    'dist/sw.js не найден — сначала выполните npm run build',
  ).toBe(true);

  server = createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];
    const filePath = join(DIST, urlPath === '/' ? 'index.html' : urlPath.slice(1));
    try {
      const body = readFileSync(filePath);
      res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
      // как в nginx.conf: sw.js и index.html без кэша
      if (urlPath === '/sw.js' || urlPath === '/' || urlPath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      }
      res.end(body);
    } catch {
      // SPA-фолбэк, как try_files в nginx
      const index = readFileSync(join(DIST, 'index.html'));
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(index);
    }
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('манифест подключён и описывает standalone-приложение с иконками', async ({ page, request }) => {
  await page.goto(BASE);
  const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
  expect(manifestHref).toBeTruthy();

  const manifest = await (await request.get(`${BASE}${manifestHref}`)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.short_name).toBe('WOWFIT');
  expect(manifest.lang).toBe('ru');

  const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any');
  expect(purposes).toContain('any');
  expect(purposes).toContain('maskable');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');

  // apple-touch-icon для iOS (манифест-иконки iOS не читает)
  const appleIcon = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
  const iconResp = await request.get(`${BASE}${appleIcon}`);
  expect(iconResp.status()).toBe(200);
});

test('service worker устанавливается и берёт страницу под контроль', async ({ page }) => {
  await page.goto(BASE);
  // clientsClaim: true — контроллер появляется без перезагрузки
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
    timeout: 15000,
  });
  const swUrl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL);
  expect(swUrl).toBe(`${BASE}/sw.js`);
});

test('прекеш включает оболочку целиком: index.html, js и css', async ({ request }) => {
  const sw = await (await request.get(`${BASE}/sw.js`)).text();
  expect(sw).toContain('index.html');
  expect(sw).toMatch(/assets\/index-[\w-]+\.js/);
  expect(sw).toMatch(/assets\/index-[\w-]+\.css/);
  // API не должно попадать ни в какие кэш-правила
  expect(sw).not.toContain('/api/');
});

test('офлайн: оболочка открывается из кэша и показывает баннер', async ({ page, context }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
    timeout: 15000,
  });

  await context.setOffline(true);
  try {
    // полная перезагрузка уже без сети — всё обязано подняться из кэша SW
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => (document.getElementById('root')?.childNodes.length ?? 0) > 0,
      null,
      { timeout: 15000 },
    );
    await expect(page.getByRole('alert')).toContainText('Подключитесь к интернету');
  } finally {
    await context.setOffline(false);
  }
});
