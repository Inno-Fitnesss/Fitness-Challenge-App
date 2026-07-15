// Заглушка virtual:pwa-register для vitest: виртуальный модуль существует
// только внутри vite-сборки с плагином. Тесты переопределяют её через
// vi.mock('virtual:pwa-register', ...) — см. src/pwa.test.ts.
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export function registerSW(_options?: RegisterSWOptions): (reload?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
