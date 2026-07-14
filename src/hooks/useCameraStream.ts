import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

interface UseCameraStreamResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  errorMessage: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

// Мобильные (тач) устройства: под вертикальный видео-блок 3:4 запрашиваем у
// камеры кадр 4:3 — так object-cover почти ничего не обрезает. Десктоп
// остаётся на 16:9.
function isCoarsePointerDevice(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

function buildVideoConstraints(): MediaTrackConstraints {
  if (isCoarsePointerDevice()) {
    return {
      facingMode: 'user',
      width: { ideal: 960 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 4 / 3 },
    };
  }
  return {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timeoutId: number | undefined;
    let cleanup = () => {};

    const handleReady = () => {
      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0
      ) {
        cleanup();
        resolve();
      }
    };

    cleanup = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('playing', handleReady);
    };

    video.addEventListener('loadeddata', handleReady);
    video.addEventListener('canplay', handleReady);
    video.addEventListener('playing', handleReady);
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Camera video frame timeout'));
    }, 6000);
    handleReady();
  });
}

export function useCameraStream(): UseCameraStreamResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopCamera = useCallback((nextStatus: CameraStatus = 'idle') => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus(nextStatus);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMessage('Браузер не поддерживает доступ к камере');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);

    try {
      stopCamera('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildVideoConstraints(),
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        throw new Error('Camera preview is not ready');
      }

      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      await waitForVideoFrame(video);
      setStatus('active');
    } catch (err) {
      stopCamera();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMessage('Разрешите доступ к камере в настройках браузера');
      } else if (name === 'NotFoundError') {
        setStatus('error');
        setErrorMessage('Камера не найдена на этом устройстве');
      } else {
        setStatus('error');
        setErrorMessage('Не удалось запустить камеру');
      }
    }
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, status, errorMessage, startCamera, stopCamera };
}
