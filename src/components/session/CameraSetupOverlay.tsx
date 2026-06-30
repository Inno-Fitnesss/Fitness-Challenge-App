import { AlertTriangle, Camera, Lightbulb } from 'lucide-react';
import type { CvFeedbackType } from '../../types/session.types.ts';

interface CameraSetupOverlayProps {
  message: string | null;
  type?: CvFeedbackType;
}

const ICON_BY_TYPE: Record<CvFeedbackType, typeof Camera> = {
  camera: Camera,
  lighting: Lightbulb,
  posture: AlertTriangle,
  general: AlertTriangle,
};

export function CameraSetupOverlay({ message, type = 'camera' }: CameraSetupOverlayProps) {
  if (!message) return null;

  const Icon = ICON_BY_TYPE[type];

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8 pointer-events-none">
      <div
        className="w-full max-w-md rounded-2xl border-2 border-red-400/80 bg-red-600/90 text-white px-5 py-4 sm:px-6 sm:py-5 shadow-2xl backdrop-blur-sm"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80 mb-1">
              Проверьте камеру
            </p>
            <p className="text-sm sm:text-base font-bold leading-snug">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
