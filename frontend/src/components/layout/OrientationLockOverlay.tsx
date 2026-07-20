import { matchPath, useLocation } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { useLandscapePhone } from '../../hooks/useLandscapePhone.ts';

/** Страница выполнения упражнения — единственная, где ландшафт разрешён. */
const EXERCISE_SESSION_PATTERN =
  '/challenges/:challengeId/exercise/:challengeExerciseId';

/**
 * Полноэкранный оверлей «Поверните телефон вертикально» для всех страниц,
 * кроме страницы выполнения упражнения. Монтируется один раз в App.tsx.
 */
export function OrientationLockOverlay() {
  const location = useLocation();
  const isLandscapePhone = useLandscapePhone();

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
