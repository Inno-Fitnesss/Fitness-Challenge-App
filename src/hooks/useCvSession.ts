import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createPoseRuntime,
  detectExercise,
  drawPose,
  ExerciseAnalyzer,
  getInferenceIntervalMs,
  preloadPoseRuntime,
  type CvFeedbackInput,
  type PoseRuntime,
} from '../cv/poseCvEngine.ts';
import type {
  CvFeedbackMessage,
  CvSessionStats,
  ExerciseMetric,
  SessionStatus,
} from '../types/session.types.ts';
import { generateId } from '../utils/generateId.ts';

interface UseCvSessionOptions {
  exerciseName: string;
  metric: ExerciseMetric;
  isRunning: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

interface UseCvSessionResult {
  stats: CvSessionStats;
  feedback: CvFeedbackMessage[];
  status: SessionStatus;
  analysisStatus: string;
  cvConnected: boolean;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  resetSession: () => void;
}

const EMPTY_STATS: CvSessionStats = {
  reps: 0,
  cleanReps: 0,
  elapsedSeconds: 0,
  formQuality: 0,
};

function createFeedback(message: CvFeedbackInput): CvFeedbackMessage {
  return {
    ...message,
    id: generateId(),
    timestamp: Date.now(),
  };
}

function statsAreEqual(
  current: CvSessionStats,
  next: CvSessionStats,
): boolean {
  return (
    current.reps === next.reps &&
    current.cleanReps === next.cleanReps &&
    current.elapsedSeconds === next.elapsedSeconds &&
    current.formQuality === next.formQuality
  );
}

export function useCvSession({
  exerciseName,
  metric,
  isRunning,
  videoRef,
}: UseCvSessionOptions): UseCvSessionResult {
  const exercise = useMemo(
    () => detectExercise(exerciseName, metric),
    [exerciseName, metric],
  );
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<PoseRuntime | null>(null);
  const runtimePromiseRef = useRef<Promise<PoseRuntime> | null>(null);
  const analyzerRef = useRef(new ExerciseAnalyzer(exercise));
  const lastFeedbackRef = useRef<{ text: string; timestamp: number } | null>(
    null,
  );
  const [stats, setStats] = useState<CvSessionStats>(EMPTY_STATS);
  const [feedback, setFeedback] = useState<CvFeedbackMessage[]>([]);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [analysisStatus, setAnalysisStatus] = useState(
    'Нажмите «Начать», чтобы запустить анализ',
  );
  const [cvConnected, setCvConnected] = useState(false);

  useEffect(() => {
    preloadPoseRuntime();
  }, []);

  const emitFeedback = useCallback((message: CvFeedbackInput) => {
    const now = Date.now();
    const previous = lastFeedbackRef.current;
    if (previous?.text === message.text && now - previous.timestamp < 4000) {
      return;
    }
    lastFeedbackRef.current = { text: message.text, timestamp: now };
    setFeedback((current) => [createFeedback(message), ...current].slice(0, 6));
  }, []);

  const ensureRuntime = useCallback(async (): Promise<PoseRuntime> => {
    if (runtimeRef.current) return runtimeRef.current;
    if (!runtimePromiseRef.current) {
      runtimePromiseRef.current = createPoseRuntime();
    }
    try {
      const runtime = await runtimePromiseRef.current;
      runtimeRef.current = runtime;
      setCvConnected(true);
      return runtime;
    } catch (error) {
      runtimePromiseRef.current = null;
      throw error;
    }
  }, []);

  const resetSession = useCallback(() => {
    analyzerRef.current.reset();
    setStats(EMPTY_STATS);
    setFeedback([]);
    setStatus('idle');
    setAnalysisStatus('Счётчик сброшен');
    lastFeedbackRef.current = null;
  }, []);

  useEffect(() => {
    analyzerRef.current = new ExerciseAnalyzer(exercise);
    setStats(EMPTY_STATS);
    setFeedback([]);
    lastFeedbackRef.current = null;

    if (exercise === 'unsupported') {
      setAnalysisStatus('Это упражнение пока не поддерживается CV');
      emitFeedback({
        type: 'general',
        severity: 'info',
        text: 'Автоматический подсчёт доступен для отжиманий, приседаний и планки.',
      });
    } else {
      setAnalysisStatus('Нажмите «Начать», чтобы запустить анализ');
    }
  }, [exercise, emitFeedback]);

  useEffect(() => {
    if (!isRunning) {
      setStatus((current) => (current === 'running' ? 'paused' : current));
      return;
    }

    if (exercise === 'unsupported') {
      setStatus('paused');
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let lastVideoTime = -1;
    let lastInferenceAt = 0;
    const overlayCanvas = overlayCanvasRef.current;

    const run = async () => {
      setStatus('calibrating');
      setAnalysisStatus('Загрузка MediaPipe и модели…');

      try {
        const runtime = await ensureRuntime();
        if (cancelled) return;

        setStatus('running');
        setAnalysisStatus('Ищу человека в кадре');

        const loop = (timestamp: number) => {
          if (cancelled) return;
          frameId = requestAnimationFrame(loop);

          const video = videoRef.current;
          if (
            !video ||
            video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
            video.currentTime === lastVideoTime ||
            timestamp - lastInferenceAt < getInferenceIntervalMs()
          ) {
            return;
          }

          lastVideoTime = video.currentTime;
          lastInferenceAt = timestamp;

          try {
            const result = runtime.landmarker.detectForVideo(
              video,
              performance.now(),
            );
            const landmarks = result.landmarks?.[0];
            const worldLandmarks = result.worldLandmarks?.[0];
            if (overlayCanvas) {
              drawPose(runtime, overlayCanvas, video, landmarks);
            }

            const analysis = landmarks
              ? analyzerRef.current.analyze(landmarks, worldLandmarks, timestamp)
              : analyzerRef.current.noPose();

            setStats((current) =>
              statsAreEqual(current, analysis.stats)
                ? current
                : analysis.stats,
            );
            setAnalysisStatus(analysis.status);
            if (analysis.feedback) emitFeedback(analysis.feedback);
          } catch (error) {
            console.error('CV frame processing failed', error);
            setStatus('paused');
            setAnalysisStatus('Ошибка обработки кадра');
            emitFeedback({
              type: 'general',
              severity: 'warning',
              text: 'Не удалось обработать кадр. Перезапустите сессию.',
            });
            cancelled = true;
          }
        };

        frameId = requestAnimationFrame(loop);
      } catch (error) {
        console.error('MediaPipe initialization failed', error);
        if (cancelled) return;
        setCvConnected(false);
        setStatus('paused');
        setAnalysisStatus('Не удалось загрузить CV-модель');
        emitFeedback({
          type: 'general',
          severity: 'warning',
          text: 'Проверьте подключение к интернету и обновите страницу.',
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      overlayCanvas
        ?.getContext('2d')
        ?.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    };
  }, [emitFeedback, ensureRuntime, exercise, isRunning, videoRef]);

  return {
    stats,
    feedback,
    status,
    analysisStatus,
    cvConnected,
    overlayCanvasRef,
    resetSession,
  };
}
