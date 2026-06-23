import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CvFeedbackMessage,
  CvSessionBridge,
  CvSessionStats,
  ExerciseMetric,
  SessionStatus,
} from '../types/session.types.ts';

const DEMO_FEEDBACK: Omit<CvFeedbackMessage, 'id' | 'timestamp'>[] = [
  {
    type: 'camera',
    severity: 'info',
    text: 'Поставьте камеру на уровень пояса и отойдите на 2–3 метра, чтобы в кадр попало всё тело.',
  },
  {
    type: 'lighting',
    severity: 'warning',
    text: 'Освещение сзади создаёт силуэт — повернитесь лицом к окну или лампе.',
  },
  {
    type: 'posture',
    severity: 'warning',
    text: 'Держите спину ровной, не округляйте плечи.',
  },
  {
    type: 'general',
    severity: 'success',
    text: 'Хороший ракурс — CV-модуль сможет точнее считать повторения.',
  },
];

interface UseCvSessionOptions {
  metric: ExerciseMetric;
  goal: number;
  isRunning: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  bridge?: CvSessionBridge;
}

interface UseCvSessionResult {
  stats: CvSessionStats;
  feedback: CvFeedbackMessage[];
  status: SessionStatus;
  cvConnected: boolean;
  registerBridge: (bridge: CvSessionBridge) => void;
  resetSession: () => void;
}

function createFeedback(
  message: Omit<CvFeedbackMessage, 'id' | 'timestamp'>,
): CvFeedbackMessage {
  return {
    ...message,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
}

export function useCvSession({
  metric,
  goal,
  isRunning,
  videoRef,
  bridge,
}: UseCvSessionOptions): UseCvSessionResult {
  const bridgeRef = useRef<CvSessionBridge | undefined>(bridge);
  const [stats, setStats] = useState<CvSessionStats>({
    reps: 0,
    cleanReps: 0,
    elapsedSeconds: 0,
    formQuality: 72,
  });
  const [feedback, setFeedback] = useState<CvFeedbackMessage[]>([
    createFeedback(DEMO_FEEDBACK[0]),
  ]);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [cvConnected, setCvConnected] = useState(false);
  const demoIndexRef = useRef(1);

  const registerBridge = useCallback((nextBridge: CvSessionBridge) => {
    bridgeRef.current = nextBridge;
    setCvConnected(true);
  }, []);

  const resetSession = useCallback(() => {
    setStats({ reps: 0, cleanReps: 0, elapsedSeconds: 0, formQuality: 72 });
    setFeedback([createFeedback(DEMO_FEEDBACK[0])]);
    setStatus('idle');
    demoIndexRef.current = 1;
  }, []);

  useEffect(() => {
    bridgeRef.current = bridge;
    if (bridge?.onFrame || bridge?.onStatsUpdate || bridge?.onFeedback) {
      setCvConnected(true);
    }
  }, [bridge]);

  useEffect(() => {
    if (!isRunning) {
      setStatus((prev) => (prev === 'running' ? 'paused' : prev));
      return;
    }

    setStatus('running');

    const tick = window.setInterval(() => {
      if (metric === 'seconds') {
        setStats((prev) => {
          const elapsedSeconds = Math.min(prev.elapsedSeconds + 1, goal);
          bridgeRef.current?.onStatsUpdate?.({ elapsedSeconds });
          return { ...prev, elapsedSeconds };
        });
      }

      if (!cvConnected && demoIndexRef.current < DEMO_FEEDBACK.length) {
        const message = DEMO_FEEDBACK[demoIndexRef.current];
        demoIndexRef.current += 1;
        const entry = createFeedback(message);
        setFeedback((prev) => [entry, ...prev].slice(0, 6));
        bridgeRef.current?.onFeedback?.(message);
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [isRunning, metric, goal, cvConnected]);

  useEffect(() => {
    if (!isRunning || !bridgeRef.current?.onFrame) return;

    let frameId = 0;
    const loop = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        bridgeRef.current?.onFrame?.(video);
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isRunning, videoRef]);

  return { stats, feedback, status, cvConnected, registerBridge, resetSession };
}
