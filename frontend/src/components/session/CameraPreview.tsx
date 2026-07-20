import type { CSSProperties, ReactNode } from 'react';
import { CameraOff, Loader2 } from 'lucide-react';
import type { CameraStatus } from '../../hooks/useCameraStream.ts';
import type { CvFeedbackMessage } from '../../types/session.types.ts';
import { CameraSetupOverlay } from './CameraSetupOverlay.tsx';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  status: CameraStatus;
  errorMessage: string | null;
  activeWarning: CvFeedbackMessage | null;
  showPoseOverlay?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function CameraPreview({
  videoRef,
  overlayCanvasRef,
  status,
  errorMessage,
  activeWarning,
  showPoseOverlay = true,
  className = '',
  style,
  children,
}: CameraPreviewProps) {
  const showVideo = status === 'active';
  const shouldShowPoseOverlay = showVideo && showPoseOverlay;
  const hasWarning = showVideo && Boolean(activeWarning?.text);
  const warningIsCameraFraming = activeWarning?.type === 'camera';

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] bg-[#2d414a] ${className}`}
      style={style}
    >
      <video
        ref={videoRef}
        autoPlay
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
          shouldShowPoseOverlay ? 'opacity-100' : 'opacity-0'
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
                : 'Проверьте камеру'}
            </p>
            <p className="text-white/60 text-sm max-w-xs mx-auto">
              {errorMessage ??
                'Разрешите доступ к камере, чтобы CV начал считывание автоматически'}
            </p>
          </div>
        </div>
      )}

      {showVideo && (
        <>
          {children}

          {/* Внутренняя красная рамка — только на десктопе; на мобилке
              состояние показывает внешняя оранжевая рамка страницы. */}
          {hasWarning && (
            <div
              className={`max-lg:hidden absolute inset-0 z-10 rounded-[18px] border-red-500 pointer-events-none ${
                warningIsCameraFraming ? 'border-[8px]' : 'border-[5px]'
              }`}
              aria-hidden="true"
            />
          )}

          <div className="absolute top-0 inset-x-0 z-20 flex justify-center p-4 pointer-events-none">
            {hasWarning && (
              <CameraSetupOverlay
                message={activeWarning?.text ?? null}
                type={activeWarning?.type}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
