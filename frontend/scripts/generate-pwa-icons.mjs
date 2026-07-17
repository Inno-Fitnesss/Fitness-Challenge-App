// Генерация PNG-иконок PWA из public/icons/icon.svg через headless chromium.
// Запуск: node scripts/generate-pwa-icons.mjs
// Пересоздаёт: pwa-192.png, pwa-512.png, pwa-maskable-512.png, apple-touch-icon.png (180).
//
// maskable-вариант рисует тот же знак в «безопасной зоне» (~64% стороны),
// потому что Android обрезает maskable-иконки под круг/сквиркл.
import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/icons/icon.svg'), 'utf8');
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const TARGETS = [
  { file: 'pwa-192.png', size: 192, scale: 1 },
  { file: 'pwa-512.png', size: 512, scale: 1 },
  // знак занимает ~64% стороны, остальное — фирменный фон
  { file: 'pwa-maskable-512.png', size: 512, scale: 0.64 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
];

const browser = await chromium.launch();
for (const t of TARGETS) {
  const page = await browser.newPage({
    viewport: { width: t.size, height: t.size },
    deviceScaleFactor: 1,
  });
  const inner = Math.round(t.size * t.scale);
  await page.setContent(`<!doctype html><style>
    html,body{margin:0;width:${t.size}px;height:${t.size}px;background:#FF5722;
      display:flex;align-items:center;justify-content:center;overflow:hidden}
    img{width:${inner}px;height:${inner}px;display:block}
  </style><img src="${svgUrl}">`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(root, 'public/icons', t.file) });
  await page.close();
  console.log(`${t.file}: ${t.size}x${t.size} (mark ${Math.round(t.scale * 100)}%)`);
}
await browser.close();
console.log('icons done');
