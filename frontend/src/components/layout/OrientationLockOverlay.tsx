import { useEffect, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { Smartphone } from 'lucide-react';

/**
 * Ландшафт на телефоне: тач-устройство (pointer: coarse) с короткой стороной
 * экрана меньше ~620px. Десктопные мониторы (pointer: fine, большая высота)
 * и планшеты в ландшафте (высота > 620px) под условие не попадают.
 * ориентация определяется по физическим размерам экрана
 * (window.screen)
 */
const MAX_SHORT_SIDE_PX = 620;

/** Страница выполнения упражнения — единственная, где ландшафт разрешён. */
const EXERCISE_SESSION_PATTERN =
  '/challenges/:challengeId/exercise/:challengeExerciseId';

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

function isScreenLandscape(): boolean {
  if (typeof window === 'undefined' || !window.screen) return false;

  const orientationType = window.screen.orientation?.type;
  if (orientationType) {
    return orientationType.startsWith('landscape');
  }

  // Фолбэк для браузеров без Screen Orientation API: сравниваем реальные
  // размеры экрана (не viewport), которые не меняются при открытии клавиатуры.
  return window.screen.width > window.screen.height;
}

function matchesLandscapePhone(): boolean {
  if (typeof window === 'undefined' || !window.screen) return false;
  if (!isCoarsePointer()) return false;
  if (!isScreenLandscape()) return false;

  const shortSide = Math.min(window.screen.width, window.screen.height);
  return shortSide <= MAX_SHORT_SIDE_PX;
}

/**
 * Полноэкранный оверлей «Поверните телефон вертикально» для всех страниц,
 * кроме страницы выполнения упражнения. Монтируется один раз в App.tsx.
 */
export function OrientationLockOverlay() {
  const location = useLocation();
  const [isLandscapePhone, setIsLandscapePhone] = useState(matchesLandscapePhone);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recompute = () => setIsLandscapePhone(matchesLandscapePhone());
    recompute();
    const screenOrientation = window.screen?.orientation;
    if (screenOrientation && typeof screenOrientation.addEventListener === 'function') {
      screenOrientation.addEventListener('change', recompute);
      return () => screenOrientation.removeEventListener('change', recompute);
    }

    // Фолбэк для браузеров без Screen Orientation API.
    window.addEventListener('orientationchange', recompute);
    return () => window.removeEventListener('orientationchange', recompute);
  }, []);

  const isExerciseSession =
    matchPath(EXERCISE_SESSION_PATTERN, location.pathname) !== null;

  if (!isLandscapePhone || isExerciseSession) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-white px-8 text-center"
      role="alert"
    >
      <div className="flex h-16 w-16 rotate-90 items-center justify-center rounded-2xl bg-lime-light">
        <Smartphone className="h-8 w-8 text-neutral-text" strokeWidth={2} />
      </div>
      <div>
        <p className="text-lg font-extrabold text-neutral-text">
          Поверните телефон вертикально
        </p>
        <p className="mt-1.5 text-sm text-neutral-secondary">
          Приложение работает в вертикальной ориентации
        </p>
      </div>
    </div>
  );
}
