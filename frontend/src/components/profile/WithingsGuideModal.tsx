import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  WITHINGS_APP_STORE_URL,
  WITHINGS_GUIDE_STEPS,
  WITHINGS_GUIDE_TITLE,
  WITHINGS_PLAY_STORE_URL,
} from '../../data/withingsGuide.ts';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';

function AndroidGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M6.5 8.5v6.2c0 .5.4.9.9.9h.7v2.6a1.3 1.3 0 0 0 2.6 0v-2.6h1.6v2.6a1.3 1.3 0 0 0 2.6 0v-2.6h.7c.5 0 .9-.4.9-.9V8.5H6.5Zm-1.9 0a1.1 1.1 0 0 0-1.1 1.1v4.3a1.1 1.1 0 0 0 2.2 0V9.6c0-.6-.5-1.1-1.1-1.1Zm14.8 0a1.1 1.1 0 0 0-1.1 1.1v4.3a1.1 1.1 0 0 0 2.2 0V9.6c0-.6-.5-1.1-1.1-1.1ZM8.9 4.4l-.8-1.4a.35.35 0 0 1 .6-.35l.85 1.47a5.9 5.9 0 0 1 4.9 0l.85-1.47a.35.35 0 0 1 .6.35l-.8 1.4A5.1 5.1 0 0 1 17.5 7.7H6.5A5.1 5.1 0 0 1 8.9 4.4Zm.55 1.5a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Zm5.1 0a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.9c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.9.9-3.6 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-1.1 2.7-2.2.9-1.2 1.2-2.4 1.2-2.5-.1 0-2.5-1-2.5-3.6Zm-2.3-6.6c.6-.7 1-1.7.9-2.7-.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2Z" />
    </svg>
  );
}

function StepImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="w-full aspect-[3/4] max-h-[46vh] rounded-2xl overflow-hidden bg-neutral-card flex items-center justify-center">
      {failed ? (
        <p className="text-xs text-neutral-muted px-6 text-center">Скриншот скоро появится</p>
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

interface WithingsGuideModalProps {
  onClose: () => void;
}

export function WithingsGuideModal({ onClose }: WithingsGuideModalProps) {
  useBodyScrollLock(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const stepCount = WITHINGS_GUIDE_STEPS.length;
  const isLastStep = activeIndex === stepCount - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goToStep = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(stepCount - 1, index));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' });
    setActiveIndex(clamped);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex((prev) => (prev === index ? prev : index));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="withings-guide-title">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 top-0 h-[100dvh] flex items-end justify-center sm:items-center modal-safe-x sm:py-4 pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col w-full max-w-md sm:max-w-lg max-h-[92dvh] bg-white rounded-3xl shadow-modal min-w-0 min-h-0 overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex-shrink-0 relative px-5 sm:px-6 pt-4 sm:pt-6 pb-2 text-center">
            <div className="w-10 h-1 bg-neutral-border rounded-full mx-auto mb-3 sm:hidden" aria-hidden />
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="absolute top-3 right-3 p-2 rounded-xl text-neutral-muted hover:text-neutral-secondary hover:bg-neutral-card transition-colors"
            >
              <X size={18} />
            </button>
            <h2 id="withings-guide-title" className="text-lg sm:text-xl font-extrabold text-neutral-text px-8">
              {WITHINGS_GUIDE_TITLE}
            </h2>
          </header>

          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {WITHINGS_GUIDE_STEPS.map((step, index) => (
              <div
                key={index}
                className="w-full flex-shrink-0 snap-start flex flex-col items-center gap-5 px-6 sm:px-8 py-4 overflow-y-auto"
              >
                <div className="text-center">
                  <p className="text-sm sm:text-base font-semibold text-neutral-text">{step.description}</p>
                  {step.highlight && (
                    <p className="text-sm sm:text-base font-semibold text-brand mt-1">{step.highlight}</p>
                  )}
                </div>

                {step.showDownloadButtons ? (
                  <div className="flex flex-col items-center gap-5 w-full">
                    <img src="/icons/withings_icon.png" alt="Withings" className="w-24 h-24 object-contain" />
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                      <a
                        href={WITHINGS_PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-lime text-white text-sm font-semibold hover:bg-lime-hover transition-colors"
                      >
                        <AndroidGlyph />
                        Для Android
                      </a>
                      <a
                        href={WITHINGS_APP_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-lime text-white text-sm font-semibold hover:bg-lime-hover transition-colors"
                      >
                        <AppleGlyph />
                        Для iPhone
                      </a>
                    </div>
                  </div>
                ) : (
                  step.image && <StepImage src={step.image} alt={step.description} />
                )}
              </div>
            ))}
          </div>

          <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => goToStep(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Назад"
              className="w-11 h-11 rounded-full border border-neutral-border text-neutral-secondary flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none hover:bg-neutral-card transition-colors"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-2">
              {WITHINGS_GUIDE_STEPS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToStep(index)}
                  aria-label={`Шаг ${index + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    index === activeIndex ? 'w-6 bg-brand' : 'w-2 bg-neutral-border'
                  }`}
                />
              ))}
            </div>

            {isLastStep ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Готово"
                className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shadow-card hover:bg-brand-hover transition-colors"
              >
                <Check size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToStep(activeIndex + 1)}
                aria-label="Далее"
                className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shadow-card hover:bg-brand-hover transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
