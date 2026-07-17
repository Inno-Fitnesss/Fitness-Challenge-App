import { registerSW } from 'virtual:pwa-register';

/** Раз в час проверяем, не выехала ли новая версия — иначе долгоживущая
 * PWA-сессия узнала бы об обновлении только при следующем запуске. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Регистрирует service worker (режим autoUpdate: новая версия активируется
 * сразу, страница перезагружается сама) и запускает периодическую проверку
 * обновлений. В dev-сборке virtual:pwa-register — no-op.
 */
export function initPwa(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        // update() падает без сети — это штатно, глушим.
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });
}
