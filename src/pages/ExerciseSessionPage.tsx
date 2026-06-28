import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pause, Play, Square } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { challengeApi } from '../api/challengeApi.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { resolveExerciseReturnPath } from '../utils/exerciseNavigation.ts';
import { AiFeedbackPanel } from '../components/session/AiFeedbackPanel.tsx';
import { CameraPreview } from '../components/session/CameraPreview.tsx';
import { SessionStatsCard } from '../components/session/SessionStatsCard.tsx';
import { Button } from '../components/ui/Button.tsx';
import { BrandLogoLink } from '../components/ui/BrandLogoLink.tsx';
import { useCameraStream } from '../hooks/useCameraStream.ts';
import { useCvSession } from '../hooks/useCvSession.ts';
import type { ExerciseSessionContext } from '../types/session.types.ts';

function SessionHeader({
  title,
  challengeTitle,
  onBack,
}: {
  title: string;
  challengeTitle: string;
  onBack: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-neutral-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2.5 rounded-xl text-neutral-muted hover:text-neutral-text hover:bg-neutral-card transition-colors"
          aria-label="Назад"
        >
          <ArrowLeft size={20} />
        </button>
        <BrandLogoLink
          showText={false}
          iconClassName="w-8 h-8 rounded-lg bg-lime flex-shrink-0"
          className="inline-flex flex-shrink-0 hover:opacity-90 transition-opacity"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-muted truncate">{challengeTitle}</p>
          <h1 className="text-base sm:text-lg font-extrabold text-neutral-text truncate">{title}</h1>
        </div>
      </div>
    </header>
  );
}

export function ExerciseSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProfile } = useAuth();
  const { challengeId, challengeExerciseId } = useParams<{
    challengeId: string;
    challengeExerciseId: string;
  }>();

  const [context, setContext] = useState<ExerciseSessionContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { videoRef, status: cameraStatus, errorMessage, startCamera, stopCamera } =
    useCameraStream();

  const parsedChallengeId = Number(challengeId);
  const parsedExerciseId = Number(challengeExerciseId);

  const returnPath = useMemo(
    () => resolveExerciseReturnPath(searchParams, parsedChallengeId),
    [parsedChallengeId, searchParams],
  );

  const {
    stats,
    feedback,
    analysisStatus,
    cvConnected,
    overlayCanvasRef,
    resetSession,
  } = useCvSession({
    exerciseName: context?.exerciseName ?? '',
    metric: context?.metric ?? 'reps',
    isRunning,
    videoRef,
  });

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

        setContext({
          challengeId: parsedChallengeId,
          challengeExerciseId: parsedExerciseId,
          exerciseName: exercise.name,
          metric: exercise.metric,
          goal: exercise.goal,
          completedToday: exercise.clean_today ?? 0,
          challengeTitle: detail.name,
        });
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
    startCamera();
  }, [startCamera]);

  const goalReached = useMemo(() => {
    if (!context) return false;
    if (context.metric === 'seconds') {
      return stats.elapsedSeconds >= context.goal;
    }
    return stats.cleanReps >= context.goal;
  }, [context, stats.cleanReps, stats.elapsedSeconds]);

  useEffect(() => {
    if (goalReached && isRunning) {
      setIsRunning(false);
    }
  }, [goalReached, isRunning]);

  const handleBack = useCallback(() => {
    stopCamera();
    navigate(returnPath);
  }, [navigate, returnPath, stopCamera]);

  const handleToggleSession = useCallback(() => {
    setSaveError(null);
    if (cameraStatus !== 'active') {
      void startCamera();
      return;
    }
    setIsRunning((prev) => !prev);
  }, [cameraStatus, startCamera]);

  const handleFinish = useCallback(async () => {
    if (!context) return;

    setIsFinishing(true);
    setIsRunning(false);
    setSaveError(null);

    try {
      const measuredValue =
        context.metric === 'seconds'
          ? stats.elapsedSeconds
          : stats.reps;
      const cleanValue =
        context.metric === 'seconds'
          ? stats.elapsedSeconds
          : stats.cleanReps;

      await challengeApi.submitSession(context.challengeId, {
        challenge_exercise_id: context.challengeExerciseId,
        total_reps: measuredValue,
        clean_reps: cleanValue,
        duration_seconds:
          context.metric === 'seconds' ? stats.elapsedSeconds : null,
      });

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
    returnPath,
    refreshProfile,
    stopCamera,
  ]);

  const handleRestart = useCallback(() => {
    resetSession();
    setIsRunning(false);
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

  return (
    <div className="min-h-screen bg-neutral-card flex flex-col">
      <SessionHeader
        title={context.exerciseName}
        challengeTitle={context.challengeTitle}
        onBack={handleBack}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px] gap-5 lg:gap-6">
          <div className="space-y-5">
            <CameraPreview
              videoRef={videoRef}
              overlayCanvasRef={overlayCanvasRef}
              status={cameraStatus}
              errorMessage={errorMessage}
              isSessionActive={isRunning}
              analysisStatus={analysisStatus}
              cvConnected={cvConnected}
              onStartCamera={startCamera}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant={isRunning ? 'secondary' : 'primary'}
                size="lg"
                fullWidth
                onClick={handleToggleSession}
                disabled={cameraStatus === 'requesting'}
              >
                {isRunning ? (
                  <>
                    <Pause size={18} />
                    Пауза
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    {goalReached ? 'Продолжить' : 'Начать'}
                  </>
                )}
              </Button>
              <Button
                variant="lime"
                size="lg"
                fullWidth
                onClick={handleFinish}
                isLoading={isFinishing}
                disabled={!isRunning && stats.reps === 0 && stats.elapsedSeconds === 0}
              >
                <Square size={16} />
                Завершить
              </Button>
            </div>

            {saveError && (
              <div
                className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 text-center"
                role="alert"
              >
                {saveError}
              </div>
            )}

            {goalReached && (
              <div className="rounded-2xl bg-lime-pale border border-lime/30 px-4 py-3 text-sm text-lime-hover font-medium text-center">
                Цель достигнута! Можно завершить сессию или продолжить для улучшения результата.
              </div>
            )}

            <div className="lg:hidden">
              <SessionStatsCard
                exerciseName={context.exerciseName}
                metric={context.metric}
                goal={context.goal}
                completedToday={context.completedToday}
                stats={stats}
                isRunning={isRunning}
              />
            </div>

            <AiFeedbackPanel messages={feedback} cvConnected={cvConnected} />
          </div>

          <aside className="hidden lg:block space-y-5">
            <SessionStatsCard
              exerciseName={context.exerciseName}
              metric={context.metric}
              goal={context.goal}
              completedToday={context.completedToday}
              stats={stats}
              isRunning={isRunning}
            />

            <div className="rounded-3xl bg-white border border-neutral-border/60 shadow-card p-5 text-sm text-neutral-secondary space-y-3">
              <p className="font-semibold text-neutral-text">Перед началом</p>
              <ul className="space-y-2 text-xs leading-relaxed">
                <li>• В кадре должны быть видны ключевые точки тела</li>
                <li>• Избегайте сильной подсветки сзади</li>
                <li>• Держите телефон или ноутбук на стабильной поверхности</li>
              </ul>
              <button
                type="button"
                onClick={handleRestart}
                className="text-xs font-semibold text-brand hover:text-brand-hover"
              >
                Сбросить счётчик
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
