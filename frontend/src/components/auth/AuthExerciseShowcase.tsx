import { useCallback, useEffect, useState } from 'react';

const SHOWCASE_SLIDES = [
  {
    id: 'pushups',
    src: '/auth/showcase-pushups.png',
    label: 'Отжимания',
    alt: 'Отжимания с отслеживанием техники через камеру',
  },
  {
    id: 'plank',
    src: '/auth/showcase-plank.png',
    label: 'Планка',
    alt: 'Планка с отслеживанием техники через камеру',
  },
  {
    id: 'squats',
    src: '/auth/showcase-squats.png',
    label: 'Приседания',
    alt: 'Приседания с отслеживанием техники через камеру',
  },
] as const;

const AUTO_INTERVAL_MS = 4500;

interface AuthExerciseShowcaseProps {
  className?: string;
  showDots?: boolean;
  onSlideChange?: (index: number) => void;
}

/** Зацикленная карусель скриншотов упражнений на экране входа/регистрации. */
export function AuthExerciseShowcase({
  className = '',
  showDots = true,
  onSlideChange,
}: AuthExerciseShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = useCallback((index: number) => {
    setActiveIndex((index + SHOWCASE_SLIDES.length) % SHOWCASE_SLIDES.length);
  }, []);

  useEffect(() => {
    onSlideChange?.(activeIndex);
  }, [activeIndex, onSlideChange]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % SHOWCASE_SLIDES.length);
    }, AUTO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={className}>
      <div className="relative w-full aspect-[1024/559] rounded-3xl overflow-hidden bg-neutral-card shadow-card">
        {SHOWCASE_SLIDES.map((slide, index) => (
          <img
            key={slide.id}
            src={slide.src}
            alt={slide.alt}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
              index === activeIndex ? 'opacity-100' : 'opacity-0'
            }`}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}

        <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {SHOWCASE_SLIDES[activeIndex].label}
        </div>
      </div>

      {showDots && (
        <div className="flex justify-center gap-2 mt-4" role="tablist" aria-label="Примеры упражнений">
          {SHOWCASE_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={slide.label}
              onClick={() => goTo(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex ? 'w-6 bg-brand' : 'w-2 bg-neutral-border hover:bg-neutral-muted'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { SHOWCASE_SLIDES };
