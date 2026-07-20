import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Info, RotateCcw } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { challengeApi } from '../api/challengeApi.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useStreakCelebration } from '../context/StreakCelebrationContext.tsx';
import { resolveExerciseReturnPath } from '../utils/exerciseNavigation.ts';
import { todayIso } from '../utils/dateFormat.ts';
import { CameraPreview } from '../components/session/CameraPreview.tsx';
import { ExerciseTechniqueModal } from '../components/session/ExerciseTechniqueModal.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Toast } from '../components/ui/Toast.tsx';
import { CAMERA_PRIVACY_TEXT } from '../components/session/CameraPrivacyNotice.tsx';
import { getExerciseTechniqueContent } from '../data/exerciseTechnique.ts';
import { useCameraStream } from '../hooks/useCameraStream.ts';
import { useCvSession } from '../hooks/useCvSession.ts';
import { useLandscapePhone } from '../hooks/useLandscapePhone.ts';
import type { CvSessionStats, ExerciseMetric, ExerciseSessionContext } from '../types/session.types.ts';
import {
  isExerciseOnboardingDismissed,
  setExerciseOnboardingDismissed,
} from '../utils/exerciseOnboardingStorage.ts';

/** Account UI-flag key for "don't show the technique modal again" per exercise. */
function techniqueDismissFlagKey(exerciseKey: string): string {
  return `technique_dismissed:${exerciseKey}`;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSessionValue(metric: ExerciseMetric, stats: CvSessionStats): number {
  return metric === 'seconds' ? stats.elapsedSeconds : stats.cleanReps;
}

function formatSessionValue(metric: ExerciseMetric, value: number): string {
  return metric === 'seconds' ? formatDuration(value) : String(value);
}

const REP_CONFIRM_SOUND_URL = '/sounds/rep-confirm.wav';
const COMPLETION_SOUND_URL = '/sounds/completion-ta-da.wav';

function createSessionAudio(src: string, volume: number): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;

  try {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = volume;
    return audio;
  } catch {
    return null;
  }
}

function unlockSessionAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;

  const wasMuted = audio.muted;
  const volume = audio.volume;
  audio.muted = true;
  audio.load();
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
    })
    .catch(() => undefined)
    .finally(() => {
      audio.muted = wasMuted;
      audio.volume = volume;
    });
}

function playSessionAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  } catch {
    return;
  }
}

function disposeSessionAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;

  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch {
    return;
  }
}

export function ExerciseSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshProfile, setUiFlag } = useAuth();
  const { triggerCelebration } = useStreakCelebration();
  const { challengeId, challengeExerciseId } = useParams<{
    challengeId: string;
    challengeExerciseId: string;
  }>();

  const [context, setContext] = useState<ExerciseSessionContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTechniqueOpen, setIsTechniqueOpen] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [privacyToastVisible, setPrivacyToastVisible] = useState(false);
  const privacyToastShownRef = useRef(false);
  const repSoundRef = useRef<HTMLAudioElement | null>(null);
  const completionSoundRef = useRef<HTMLAudioElement | null>(null);
  const lastCleanRepsRef = useRef(0);
  const hasPlayedCompletionSoundRef = useRef(false);
  const soundSessionKeyRef = useRef<string | null>(null);

  const { videoRef, status: cameraStatus, errorMessage, startCamera, stopCamera } =
    useCameraStream();
  const isLandscapePhone = useLandscapePhone();

  const parsedChallengeId = Number(challengeId);
  const parsedExerciseId = Number(challengeExerciseId);

  const returnPath = useMemo(
    () => resolveExerciseReturnPath(searchParams, parsedChallengeId),
    [parsedChallengeId, searchParams],
  );

  const techniqueContent = useMemo(
    () =>
      context
        ? getExerciseTechniqueContent(context.exerciseName, context.metric)
        : null,
    [context],
  );

  const {
    stats,
    activeWarning,
    overlayCanvasRef,
    resetSession,
  } = useCvSession({
    exerciseName: context?.exerciseName ?? '',
    metric: context?.metric ?? 'reps',
    isRunning: Boolean(context) && isRunning,
    cameraActive: cameraStatus === 'active',
    videoRef,
  });

  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const soundSessionKey = context
    ? `${context.challengeId}:${context.challengeExerciseId}:${context.metric}:${context.goal}`
    : null;

  const getRepSound = useCallback(() => {
    if (!repSoundRef.current) {
      repSoundRef.current = createSessionAudio(REP_CONFIRM_SOUND_URL, 0.72);
    }
    return repSoundRef.current;
  }, []);

  const getCompletionSound = useCallback(() => {
    if (!completionSoundRef.current) {
      completionSoundRef.current = createSessionAudio(COMPLETION_SOUND_URL, 0.82);
    }
    return completionSoundRef.current;
  }, []);

  const prepareAudio = useCallback(() => {
    unlockSessionAudio(getRepSound());
    unlockSessionAudio(getCompletionSound());
  }, [getCompletionSound, getRepSound]);

  const playRepSound = useCallback(() => {
    playSessionAudio(getRepSound());
  }, [getRepSound]);

  const playCompletionSound = useCallback(() => {
    playSessionAudio(getCompletionSound());
  }, [getCompletionSound]);

  useEffect(() => {
    window.addEventListener('pointerdown', prepareAudio, { once: true });
    window.addEventListener('keydown', prepareAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prepareAudio);
      window.removeEventListener('keydown', prepareAudio);
      disposeSessionAudio(repSoundRef.current);
      disposeSessionAudio(completionSoundRef.current);
      repSoundRef.current = null;
      completionSoundRef.current = null;
    };
  }, [prepareAudio]);

  useEffect(() => {
    if (!context || !soundSessionKey) {
      soundSessionKeyRef.current = null;
      hasPlayedCompletionSoundRef.current = false;
      lastCleanRepsRef.current = stats.cleanReps;
      return;
    }

    if (soundSessionKeyRef.current !== soundSessionKey) {
      soundSessionKeyRef.current = soundSessionKey;
      hasPlayedCompletionSoundRef.current = false;
      lastCleanRepsRef.current = stats.cleanReps;
      return;
    }

    if (context.metric === 'reps' && stats.cleanReps > lastCleanRepsRef.current) {
      playRepSound();
    }

    lastCleanRepsRef.current = stats.cleanReps;

    const completionValue =
      context.metric === 'seconds' ? stats.elapsedSeconds : stats.cleanReps;
    if (
      completionValue >= context.goal &&
      !hasPlayedCompletionSoundRef.current
    ) {
      hasPlayedCompletionSoundRef.current = true;
      playCompletionSound();
    }
  }, [
    context,
    playCompletionSound,
    playRepSound,
    soundSessionKey,
    stats.cleanReps,
    stats.elapsedSeconds,
  ]);

  useEffect(() => {
    if (!Number.isFinite(parsedChallengeId) || !Number.isFinite(parsedExerciseId)) {
      setLoadError('Неверная ссылка на упражнение');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    challengeApi
      .getDetail(parsedChallengeId)
      .then((detail) => {
        if (cancelled) return;

        const exercise = detail.exercises.find(
          (item) => item.challenge_exercise_id === parsedExerciseId,
        );

        if (!exercise) {
          setLoadError('Упражнение не найдено в этом челлендже');
          return;
        }

        if (detail.status === 'archived') {
          setLoadError('Челлендж в архиве. Сначала возобновите его, чтобы начать выполнение.');
          return;
        }

        if (detail.end_date && detail.end_date < todayIso()) {
          setLoadError('Срок челленджа истёк. Челлендж должен быть в архиве.');
          return;
        }

        setContext({
          challengeId: parsedChallengeId,
          challengeExerciseId: parsedExerciseId,
          exerciseName: exercise.name,
          metric: exercise.metric,
          goal: exercise.goal,
          completedToday: exercise.clean_today ?? 0,
          challengeTitle: detail.name,
        });
        setIsRunning(true);
      })
      .catch((err: { message?: string }) => {
        if (!cancelled) {
          setLoadError(err.message ?? 'Не удалось загрузить данные упражнения');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [parsedChallengeId, parsedExerciseId]);

  useEffect(() => {
    if (isLoading || !context) return;
    startCamera();
    if (!privacyToastShownRef.current) {
      privacyToastShownRef.current = true;
      setPrivacyToastVisible(true);
    }
  }, [context, isLoading, startCamera]);

  useEffect(() => {
    if (!techniqueContent || isLoading) return;
    // Account-level flag is the source of truth (follows the user across
    // devices); localStorage is only an offline fallback for the same device.
    const flagKey = techniqueDismissFlagKey(techniqueContent.exerciseKey);
    const dismissed =
      Boolean(user?.uiFlags?.[flagKey]) ||
      isExerciseOnboardingDismissed(techniqueContent.exerciseKey);
    if (dismissed) return;
    setIsTechniqueOpen(true);
  }, [techniqueContent, isLoading, user?.uiFlags]);

  const handleCloseTechnique = useCallback(
    (dontShowAgain: boolean) => {
      if (techniqueContent && dontShowAgain) {
        setExerciseOnboardingDismissed(techniqueContent.exerciseKey, true);
        void setUiFlag(techniqueDismissFlagKey(techniqueContent.exerciseKey), true);
      }
      setIsTechniqueOpen(false);
    },
    [techniqueContent, setUiFlag],
  );

  const handleShowTechnique = useCallback(() => {
    setIsTechniqueOpen(true);
  }, []);

  const toggleSkeleton = useCallback(() => {
    setShowSkeleton((current) => !current);
  }, []);

  const currentValue = context ? getSessionValue(context.metric, stats) : 0;
  const goalReached = useMemo(() => {
    if (!context) return false;
    return currentValue >= context.goal;
  }, [context, currentValue]);
  const sessionProgress = context?.goal
    ? Math.min(100, (currentValue / context.goal) * 100)
    : 0;

  useEffect(() => {
    if (goalReached && isRunning) {
      setIsRunning(false);
    }
  }, [goalReached, isRunning]);

  const handleBack = useCallback(() => {
    stopCamera();
    navigate(returnPath);
  }, [navigate, returnPath, stopCamera]);

  const handleFinish = useCallback(async () => {
    if (!context) return;

    const currentStats = statsRef.current;

    setIsFinishing(true);
    setIsRunning(false);
    setSaveError(null);

    try {
      const measuredValue =
        context.metric === 'seconds'
          ? currentStats.elapsedSeconds
          : currentStats.reps;
      const goalMet =
        context.metric === 'seconds'
          ? currentStats.elapsedSeconds >= context.goal
          : currentStats.cleanReps >= context.goal;
      const cleanValue = goalMet
        ? context.metric === 'seconds'
          ? currentStats.elapsedSeconds
          : currentStats.cleanReps
        : 0;

      const previousStreak = user?.streakCurrent ?? 0;

      const result = await challengeApi.submitSession(context.challengeId, {
        challenge_exercise_id: context.challengeExerciseId,
        total_reps: measuredValue,
        clean_reps: cleanValue,
        duration_seconds:
          context.metric === 'seconds' ? currentStats.elapsedSeconds : null,
      });

      if (result.user_streak > previousStreak) {
        triggerCelebration(previousStreak, result.user_streak);
      }

      await refreshProfile();
      stopCamera();
      navigate(returnPath);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : error &&
              typeof error === 'object' &&
              'message' in error &&
              typeof error.message === 'string'
            ? error.message
            : 'Не удалось сохранить результат упражнения';
      setSaveError(message);
    } finally {
      setIsFinishing(false);
    }
  }, [
    context,
    navigate,
    returnPath,
    refreshProfile,
    stopCamera,
    user,
    triggerCelebration,
  ]);

  const handleRestart = useCallback(() => {
    hasPlayedCompletionSoundRef.current = false;
    lastCleanRepsRef.current = 0;
    resetSession();
    setSaveError(null);
    setIsRunning(true);
  }, [resetSession]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-card flex items-center justify-center">
        <p className="text-neutral-muted text-sm">Загрузка сессии…</p>
      </div>
    );
  }

  if (loadError || !context) {
    return (
      <div className="min-h-screen bg-neutral-card flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-500 text-sm" role="alert">{loadError ?? 'Сессия недоступна'}</p>
        <Button variant="secondary" onClick={() => navigate(returnPath)}>
          Назад
        </Button>
      </div>
    );
  }

  const currentDisplay = formatSessionValue(context.metric, currentValue);
  const goalDisplay = formatSessionValue(context.metric, context.goal);
  const progressTrackClassName = 'bg-[#D7D7D7]/85';
  const progressFillClassName = goalReached ? 'bg-[#8ED726]' : 'bg-[#9AE52E]';
  // Мобильная цветная рамка-состояние вокруг камеры: зелёная — упражнение
  // завершено, оранжевая — CV-предупреждение, иначе прозрачная.
  const mobileFrameClassName = goalReached
    ? 'max-lg:bg-[#9AE52E]'
    : activeWarning
      ? 'max-lg:bg-[#F0764A]'
      : 'max-lg:bg-transparent';
  // В ландшафте нет места под рамку-паддинг — статус показываем кольцом
  // поверх полноэкранного видео вместо цветного фона вокруг него.
  const landscapeRingClassName = goalReached
    ? 'ring-[#9AE52E]'
    : activeWarning
      ? 'ring-[#F0764A]'
      : 'ring-transparent';

  return (
    <div className="h-[100dvh] overflow-hidden bg-white max-lg:flex max-lg:flex-col">
      {/* Мобильная шапка (< lg, портрет): назад, название, счётчик, полоса прогресса.
          В ландшафте её заменяют плавающие элементы поверх камеры (см. ниже). */}
      {!isLandscapePhone && (
        <header className="bg-white lg:hidden">
          <div className="flex h-[60px] items-center gap-2 px-4">
            <button
              type="button"
              onClick={handleBack}
              className="-ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-neutral-muted transition-colors active:bg-neutral-card"
              aria-label="Назад"
            >
              <ArrowLeft className="h-6 w-6" strokeWidth={2.4} />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[21px] font-extrabold leading-tight text-neutral-text">
              {context.exerciseName}
            </h1>
            <p
              className="flex-shrink-0 whitespace-nowrap tabular-nums"
              aria-label={`Прогресс: ${currentDisplay} из ${goalDisplay}`}
            >
              <span className="text-[13px] font-semibold text-neutral-muted">
                выполнено
              </span>{' '}
              <span className="text-lg font-extrabold text-neutral-text">
                {currentDisplay} / {goalDisplay}
              </span>
            </p>
          </div>
          <div className={`h-2 w-full ${progressTrackClassName}`}>
            <div
              className={`h-full rounded-r-full transition-[width] duration-500 ${progressFillClassName}`}
              style={{ width: `${sessionProgress}%` }}
            />
          </div>
        </header>
      )}

      {/* Десктопная шапка (lg+) — без изменений */}
      <header className="max-lg:hidden h-[56px] border-b border-neutral-border/80 bg-white sm:h-[60px]">
        <div className="mx-auto grid h-full w-full max-w-[1920px] grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:gap-4 sm:px-7 lg:px-12">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-muted transition-colors hover:bg-neutral-card hover:text-neutral-text"
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
            </button>

            <div className="h-8 w-8 rounded-lg bg-lime" aria-hidden="true" />

            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold leading-none text-neutral-muted">
                {context.challengeTitle}
              </p>
              <h1 className="mt-0.5 truncate text-base font-extrabold leading-tight text-neutral-text">
                {context.exerciseName}
              </h1>
            </div>
        </div>
      </header>

      <main
        className={`flex w-full flex-col transition-colors duration-500 max-lg:min-h-0 max-lg:flex-1 lg:h-[calc(100dvh-60px)] lg:px-12 lg:py-2 ${
          isLandscapePhone ? '' : 'max-lg:px-3 max-lg:pb-3'
        } ${goalReached ? 'bg-[#F3FFE2]' : 'bg-[#F2F3F5]'}`}
      >
        {/* Мобильные кнопки «Инструкция» / «Сбросить счётчик» (только портрет —
            в ландшафте те же действия доступны как плавающие иконки над камерой) */}
        {!isLandscapePhone && (
          <div className="grid grid-cols-2 gap-3 pt-3 lg:hidden">
            <button
              type="button"
              onClick={handleShowTechnique}
              className="flex h-11 items-center justify-center rounded-xl border border-[#BCDE68] bg-[#F8F4EC] px-3 text-[15px] font-semibold text-[#93C83D] transition-colors active:bg-[#F0F2DE]"
            >
              Инструкция
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="flex h-11 items-center justify-center rounded-xl border border-[#F6A97F] bg-[#FBF3EC] px-3 text-[15px] font-semibold text-[#F2652D] transition-colors active:bg-[#F8E8DB]"
            >
              Сбросить счётчик
            </button>
          </div>
        )}

        <div className="max-lg:hidden mx-auto w-full max-w-[1920px]">
          <div
            className={`h-2 w-full overflow-hidden rounded-full ${progressTrackClassName}`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${progressFillClassName}`}
              style={{ width: `${sessionProgress}%` }}
            />
          </div>
        </div>

        <section
          className={
            isLandscapePhone
              ? 'flex min-h-0 flex-1'
              : 'flex min-h-0 flex-1 max-lg:flex-col max-lg:pt-3 lg:items-center lg:pb-1.5 lg:pt-5'
          }
        >
          {/* Мобильная рамка-состояние (оранжевая/зелёная); на lg+ — нейтральная обёртка.
              В ландшафте рамки-паддинга нет — статус вместо неё показывает кольцо
              поверх полноэкранного видео (см. landscapeRingClassName ниже). */}
          <div
            className={
              isLandscapePhone
                ? 'relative h-full w-full overflow-hidden'
                : `max-lg:min-h-0 max-lg:flex-1 max-lg:rounded-[28px] max-lg:p-2 max-lg:transition-colors max-lg:duration-300 ${mobileFrameClassName} lg:w-full`
            }
          >
            {/* Мобильный тёмный блок: видео заполняет его целиком без рамки
                (и в портрете, и в ландшафте) — на lg+ отдельная 16:9 обёртка */}
            <div
              className={
                isLandscapePhone
                  ? `relative h-full w-full overflow-hidden ring-4 ring-inset transition-colors duration-300 ${landscapeRingClassName}`
                  : 'relative max-lg:h-full max-lg:w-full max-lg:overflow-hidden max-lg:rounded-[20px] max-lg:bg-[#2d414a]'
              }
            >
              <CameraPreview
                videoRef={videoRef}
                overlayCanvasRef={overlayCanvasRef}
                status={cameraStatus}
                errorMessage={errorMessage}
                activeWarning={activeWarning}
                showPoseOverlay={showSkeleton}
                className={
                  isLandscapePhone
                    ? 'h-full w-full rounded-none'
                    : 'mx-auto max-lg:h-full max-lg:w-full lg:aspect-video lg:w-full lg:max-w-[min(1840px,max(320px,calc((100dvh_-_150px)_*_1.7778)))]'
                }
              >
                {isLandscapePhone ? (
                  <>
                    {/* Верхняя плавающая панель: назад + название + прогресс */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 bg-gradient-to-b from-black/45 to-transparent p-2.5">
                      <div className="pointer-events-auto flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBack}
                          aria-label="Назад"
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50"
                        >
                          <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
                        </button>
                        <span className="min-w-0 truncate rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-md">
                          {context.exerciseName}
                        </span>
                        <span className="flex-shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-bold tabular-nums text-white backdrop-blur-md">
                          {currentDisplay} / {goalDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Правая колонка: скелет / инструкция / сброс */}
                    <div className="pointer-events-none absolute right-2.5 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2">
                      <button
                        type="button"
                        onClick={toggleSkeleton}
                        aria-label={showSkeleton ? 'Скрыть скелет' : 'Показать скелет'}
                        title={showSkeleton ? 'Скрыть скелет' : 'Показать скелет'}
                        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50"
                      >
                        {showSkeleton ? (
                          <EyeOff className="h-5 w-5" strokeWidth={2.4} />
                        ) : (
                          <Eye className="h-5 w-5" strokeWidth={2.4} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleShowTechnique}
                        aria-label="Инструкция"
                        title="Инструкция"
                        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50"
                      >
                        <Info className="h-5 w-5" strokeWidth={2.4} />
                      </button>
                      <button
                        type="button"
                        onClick={handleRestart}
                        aria-label="Сбросить счётчик"
                        title="Сбросить счётчик"
                        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/50"
                      >
                        <RotateCcw className="h-5 w-5" strokeWidth={2.4} />
                      </button>
                    </div>

                    {/* Нижняя плавающая панель: ошибка сохранения + «Сохранить и выйти» */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 bg-gradient-to-t from-black/45 to-transparent p-2.5">
                      {saveError && (
                        <div
                          className="pointer-events-auto rounded-full border border-red-300 bg-red-50/95 px-4 py-1.5 text-center text-xs font-semibold text-red-600 backdrop-blur-md"
                          role="alert"
                        >
                          {saveError}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleFinish}
                        disabled={!goalReached || isFinishing}
                        className="pointer-events-auto flex h-10 items-center justify-center rounded-full bg-[#9AE52E] px-6 text-sm font-bold text-white shadow-lg transition-colors active:bg-[#8ED726] disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/70"
                      >
                        {isFinishing ? 'Сохраняем…' : 'Сохранить и выйти'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={toggleSkeleton}
                    className="pointer-events-auto absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/80"
                    aria-label={showSkeleton ? 'Скрыть скелет' : 'Показать скелет'}
                    title={showSkeleton ? 'Скрыть скелет' : 'Показать скелет'}
                  >
                    {showSkeleton ? (
                      <EyeOff className="h-5 w-5" strokeWidth={2.4} />
                    ) : (
                      <Eye className="h-5 w-5" strokeWidth={2.4} />
                    )}
                  </button>
                )}

                <div
                  className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
                  aria-label={`Выполнено ${currentDisplay}`}
                >
                  <span className="tabular-nums text-[clamp(5rem,22vw,8rem)] font-black leading-none text-white/80 drop-shadow-[0_8px_24px_rgba(0,0,0,0.72)] lg:text-[clamp(6rem,12vw,11rem)]">
                    {currentDisplay}
                  </span>
                </div>
              </CameraPreview>
            </div>
          </div>
        </section>

        {/* Мобильная кнопка «Сохранить и выйти» (только портрет — в ландшафте
            она встроена в нижнюю плавающую панель над камерой) */}
        {!isLandscapePhone && (
          <div className="pt-3 lg:hidden">
            {saveError && (
              <div
                className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600"
                role="alert"
              >
                {saveError}
              </div>
            )}
            <button
              type="button"
              onClick={handleFinish}
              disabled={!goalReached || isFinishing}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#9AE52E] text-lg font-bold text-white transition-colors active:bg-[#8ED726] disabled:cursor-not-allowed disabled:bg-[#D6F0A8]"
            >
              {isFinishing ? 'Сохраняем…' : 'Сохранить и выйти'}
            </button>
          </div>
        )}

        <footer className="max-lg:hidden rounded-2xl bg-white/70 p-2 shadow-sm backdrop-blur-sm sm:p-2.5">
          {saveError && (
            <div
              className="mx-auto mb-3 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-600"
              role="alert"
            >
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-6 lg:gap-16">
            <button
              type="button"
              onClick={handleRestart}
              className="flex h-9 w-full items-center justify-center rounded-xl bg-[#E2E2E2] px-4 text-sm font-bold text-[#1f2937] transition-colors hover:bg-[#D4D4D4] sm:h-10 sm:text-base"
            >
              Сбросить счётчик
            </button>

            <button
              type="button"
              onClick={handleShowTechnique}
              className="flex h-9 w-full items-center justify-center rounded-xl bg-[#FF7A14] px-4 text-sm font-bold text-white transition-colors hover:bg-[#F06C00] sm:h-10 sm:text-base"
            >
              Как поставить камеру?
            </button>

            <button
              type="button"
              onClick={handleFinish}
              disabled={!goalReached || isFinishing}
              className="flex h-9 w-full items-center justify-center rounded-xl bg-[#9AE52E] px-4 text-sm font-bold text-white transition-colors hover:bg-[#8ED726] disabled:cursor-not-allowed disabled:bg-[#CFEFA0] disabled:text-white/80 sm:h-10 sm:text-base"
            >
              {isFinishing ? 'Сохраняем…' : 'Завершить'}
            </button>
          </div>
        </footer>
      </main>

      {isTechniqueOpen && techniqueContent && (
        <ExerciseTechniqueModal
          content={techniqueContent}
          onClose={handleCloseTechnique}
        />
      )}

      {privacyToastVisible && (
        <Toast
          message={CAMERA_PRIVACY_TEXT}
          type="info"
          duration={6000}
          onClose={() => setPrivacyToastVisible(false)}
        />
      )}
    </div>
  );
}
