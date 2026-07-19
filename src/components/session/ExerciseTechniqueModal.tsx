import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { ExerciseTechniqueContent } from '../../data/exerciseTechnique.ts';
import { Button } from '../ui/Button.tsx';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';

interface ExerciseTechniqueModalProps {
  content: ExerciseTechniqueContent;
  isSavingPreference?: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

export function ExerciseTechniqueModal({
  content,
  isSavingPreference = false,
  onClose,
}: ExerciseTechniqueModalProps) {
  useBodyScrollLock(true);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingPreference) {
        onClose(dontShowAgain);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dontShowAgain, isSavingPreference, onClose]);

  const handlePlay = () => {
    if (content.videoUrl && videoRef.current) {
      setIsVideoPlaying(true);
      void videoRef.current.play();
      return;
    }
    setIsVideoPlaying(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="technique-modal-title"
    >
      <button
        type="button"
        aria-label="Закрыть"
        disabled={isSavingPreference}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!isSavingPreference) onClose(dontShowAgain);
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[100dvh] flex items-end justify-center sm:items-center modal-safe-x sm:py-4 pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col w-full max-w-lg max-h-[90dvh] sm:max-h-[85dvh] bg-white rounded-3xl shadow-modal min-w-0 min-h-0 overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Fixed header — always visible so the exercise being explained is clear */}
          <header className="flex-shrink-0 px-5 sm:px-6 pt-3 sm:pt-6 pb-3 text-center">
            <div className="w-10 h-1 bg-neutral-border rounded-full mx-auto mb-3 sm:hidden" aria-hidden />
            <h2 id="technique-modal-title" className="text-lg sm:text-xl font-extrabold text-neutral-text">
              {content.title}
            </h2>
            <p className="text-sm text-neutral-muted mt-0.5">{content.techniqueTitle}</p>
          </header>

          {/* Scrollable body — video + tips, size-limited so the footer never leaves the screen */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 sm:px-6 pb-4">
            <div className="relative mb-4 rounded-2xl overflow-hidden aspect-video bg-neutral-text shadow-card">
              {content.videoUrl && isVideoPlaying ? (
                <video
                  ref={videoRef}
                  src={content.videoUrl}
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${content.posterGradient}`}
                    aria-hidden="true"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handlePlay}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-lime text-neutral-text flex items-center justify-center shadow-card hover:bg-lime-hover transition-colors"
                      aria-label="Воспроизвести видео с техникой"
                    >
                      <Play size={26} className="ml-1" fill="currentColor" />
                    </button>
                  </div>
                  {!content.videoUrl && isVideoPlaying && (
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-black/60 text-white text-xs text-center">
                      Видео для этого упражнения скоро появится. Пока ориентируйтесь на подсказки ниже.
                    </div>
                  )}
                </>
              )}
            </div>

            <ul className="space-y-2 text-sm text-neutral-secondary mb-4">
              {content.techniqueTips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="text-brand font-bold">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-sm font-bold text-neutral-text mb-2">
              Для корректной работы приложения:
            </h3>
            <ul className="space-y-2 text-sm text-neutral-secondary">
              {content.setupTips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="text-brand font-bold">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Fixed footer — the two things the user actually needs are always in reach */}
          <div className="flex-shrink-0 border-t border-neutral-border/60 bg-white px-5 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5">
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.target.checked)}
                disabled={isSavingPreference}
                className="w-4 h-4 rounded border-neutral-border text-brand focus:ring-brand/30"
              />
              <span className="text-sm text-neutral-secondary">Больше не показывать</span>
            </label>

            <Button
              variant="lime"
              size="lg"
              fullWidth
              onClick={() => onClose(dontShowAgain)}
              isLoading={isSavingPreference}
            >
              Понятно
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
