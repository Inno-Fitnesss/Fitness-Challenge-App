import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Плашка «нет интернета». Появляется по событию offline (и если приложение
 * открыли уже без сети — например, PWA с иконки), исчезает по online.
 * Весь фронт закэширован service worker'ом, поэтому оболочка открывается и
 * офлайн — но API недоступно, о чём и предупреждаем.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' && !navigator.onLine,
  );

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2
        bg-neutral-text text-white text-sm font-medium text-center
        px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]"
    >
      <WifiOff size={16} className="flex-shrink-0" aria-hidden="true" />
      Подключитесь к интернету — основные функции не работают
    </div>
  );
}
