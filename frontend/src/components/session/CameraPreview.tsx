import { Camera, CameraOff, Loader2 } from 'lucide-react';
import type { CameraStatus } from '../../hooks/useCameraStream.ts';
import { Button } from '../ui/Button.tsx';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  status: CameraStatus;
  errorMessage: string | null;
  isSessionActive: boolean;
  analysisStatus: string;
  cvConnected: boolean;
  onStartCamera: () => void;
}

export function CameraPreview({
  videoRef,
  overlayCanvasRef,
  status,
  errorMessage,
  isSessionActive,
  analysisStatus,
  cvConnected,
  onStartCamera,
}: CameraPreviewProps) {
  const showVideo = status === 'active';

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden bg-neutral-text shadow-card">
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
          showVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <canvas
        ref={overlayCanvasRef}
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none ${
          showVideo && isSessionActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
            {status === 'requesting' ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <CameraOff className="w-8 h-8 text-white/70" />
            )}
          </div>
          <div>
            <p className="text-white font-semibold mb-1">
              {status === 'requesting'
                ? 'Подключаем камеру…'
                : 'Камера не активна'}
            </p>
            <p className="text-white/60 text-sm max-w-xs">
              {errorMessage ??
                'Нажмите кнопку ниже, чтобы включить видеопоток'}
            </p>
          </div>
          {status !== 'requesting' && (
            <Button
              variant="primary"
              size="md"
              onClick={onStartCamera}
              className="mt-2"
            >
              <Camera size={16} />
              Включить камеру
            </Button>
          )}
        </div>
      )}

      {showVideo && (
        <>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-6 sm:inset-10 border-2 border-white/20 rounded-2xl" />
            <div className="absolute top-1/2 left-6 right-6 h-px bg-white/10" />
            <div className="absolute left-1/2 top-6 bottom-6 w-px bg-white/10" />
          </div>

          <div className="absolute top-4 left-4 flex items-center gap-2">
            {isSessionActive && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/90 text-white text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-black/50 text-white/90 text-xs font-medium backdrop-blur-sm">
              {cvConnected ? 'CV подключён' : 'CV ожидает запуска'}
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex justify-center">
            <span className="max-w-full px-3 py-1.5 rounded-xl bg-black/60 text-white text-xs font-medium text-center backdrop-blur-sm">
              {analysisStatus}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
