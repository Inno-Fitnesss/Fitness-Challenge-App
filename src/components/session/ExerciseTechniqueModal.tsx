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
      <div className="absolute inset-0 flex items-center justify-center modal-safe-x py-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-lg max-h-[90dvh] overflow-y-auto overflow-x-hidden bg-white rounded-3xl shadow-modal p-6 sm:p-8 min-w-0"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="text-center mb-5">
          <h2 id="technique-modal-title" className="text-xl font-extrabold text-neutral-text">
            {content.title}
          </h2>
          <p className="text-sm text-neutral-muted mt-1">{content.techniqueTitle}</p>
        </header>

        <div className="relative mb-5 rounded-2xl overflow-hidden aspect-video bg-neutral-text shadow-card">
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
                  className="w-16 h-16 rounded-full bg-lime text-neutral-text flex items-center justify-center shadow-card hover:bg-lime-hover transition-colors"
                  aria-label="Воспроизвести видео с техникой"
                >
                  <Play size={28} className="ml-1" fill="currentColor" />
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

        <section className="mb-5">
          <ul className="space-y-2 text-sm text-neutral-secondary">
            {content.techniqueTips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="text-brand font-bold">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-6">
          <h3 className="text-sm font-bold text-neutral-text mb-3">
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
        </section>

        <label className="flex items-center gap-3 mb-5 cursor-pointer select-none">
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
  );
}
