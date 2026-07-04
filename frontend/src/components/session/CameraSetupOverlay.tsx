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

const LABEL_BY_TYPE: Record<CvFeedbackType, string> = {
  camera: 'Проверьте камеру',
  lighting: 'Проверьте освещение',
  posture: 'Встаньте в позу',
  general: 'Подсказка',
};

/** Compact warning banner shown at the top of the camera (does not cover the frame). */
export function CameraSetupOverlay({ message, type = 'camera' }: CameraSetupOverlayProps) {
  if (!message) return null;

  const Icon = ICON_BY_TYPE[type];

  return (
    <div
      className="flex items-start gap-2.5 rounded-2xl border border-red-400/60 bg-red-600/90 text-white px-3.5 py-2.5 shadow-lg backdrop-blur-sm animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80 leading-none mb-1">
          {LABEL_BY_TYPE[type]}
        </p>
        <p className="text-xs sm:text-sm font-semibold leading-snug">{message}</p>
      </div>
    </div>
  );
}
