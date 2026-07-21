// Генерация PNG-иконок PWA из public/brand/logo-icon.png.
// Запуск: node scripts/generate-pwa-icons.mjs
// Пересоздаёт: pwa-192.png, pwa-512.png, pwa-maskable-512.png,
//              apple-touch-icon.png (180), favicon-32.png, favicon-192.png, og-image.png
//
// Предпочитает sharp (npm i -D sharp), иначе Playwright chromium.
import { copyFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = join(root, 'public/brand/logo-icon.png');
const fullPath = join(root, 'public/brand/logo-full.png');
const iconsDir = join(root, 'public/icons');

const ICON_TARGETS = [
  { file: 'pwa-192.png', size: 192, scale: 1 },
  { file: 'pwa-512.png', size: 512, scale: 1 },
  { file: 'pwa-maskable-512.png', size: 512, scale: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  { file: 'favicon-32.png', size: 32, scale: 1 },
  { file: 'favicon-192.png', size: 192, scale: 1 },
];

async function withSharp() {
  const require = createRequire(import.meta.url);
  const sharp = require('sharp');

  for (const t of ICON_TARGETS) {
    const inner = Math.round(t.size * t.scale);
    const mark = await sharp(iconPath)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png()
      .toBuffer();
    await sharp({
      create: { width: t.size, height: t.size, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .composite([{ input: mark, gravity: 'centre' }])
      .png()
      .toFile(join(iconsDir, t.file));
    console.log(`${t.file}: ${t.size}x${t.size} (mark ${Math.round(t.scale * 100)}%)`);
  }

  const logo = await sharp(fullPath)
    .resize(720, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: 1200, height: 630, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(join(root, 'public/brand/og-image.png'));
  console.log('og-image.png: 1200x630');
}

async function withPlaywright() {
  const { chromium } = await import('@playwright/test');
  const iconUrl = `data:image/png;base64,${readFileSync(iconPath).toString('base64')}`;
  const fullUrl = `data:image/png;base64,${readFileSync(fullPath).toString('base64')}`;
  const browser = await chromium.launch();

  for (const t of ICON_TARGETS) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size },
      deviceScaleFactor: 1,
    });
    const inner = Math.round(t.size * t.scale);
    await page.setContent(`<!doctype html><style>
      html,body{margin:0;width:${t.size}px;height:${t.size}px;background:#000000;
        display:flex;align-items:center;justify-content:center;overflow:hidden}
      img{width:${inner}px;height:${inner}px;display:block;object-fit:contain}
    </style><img src="${iconUrl}" alt="">`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(iconsDir, t.file) });
    await page.close();
    console.log(`${t.file}: ${t.size}x${t.size} (mark ${Math.round(t.scale * 100)}%)`);
  }

  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><style>
    html,body{margin:0;width:1200px;height:630px;background:#000000;
      display:flex;align-items:center;justify-content:center;overflow:hidden}
    img{width:720px;height:auto;max-height:280px;display:block;object-fit:contain}
  </style><img src="${fullUrl}" alt="WOWFIT">`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(root, 'public/brand/og-image.png') });
  await page.close();
  console.log('og-image.png: 1200x630');
  await browser.close();
}

try {
  await withSharp();
} catch {
  console.log('sharp недоступен — используем Playwright');
  await withPlaywright();
}

copyFileSync(join(iconsDir, 'favicon-32.png'), join(root, 'public/favicon.ico'));
console.log('favicon.ico: copied from favicon-32.png');
console.log('icons done');
