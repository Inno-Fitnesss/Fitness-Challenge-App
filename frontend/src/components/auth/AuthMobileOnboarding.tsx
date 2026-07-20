import { useRef, useState } from 'react';
import { BookOpen, CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { AuthBrandMark } from './AuthBrandMark.tsx';
import { AuthExerciseShowcase } from './AuthExerciseShowcase.tsx';
import { AuthStaggeredFeatures } from './AuthStaggeredFeatures.tsx';
import { Button } from '../ui/Button.tsx';

interface OnboardingSlide {
  id: string;
  headline: string;
  features: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'training',
    headline: 'Поддерживайте форму даже вне занятий с тренером',
    features: [
      'создавайте челленджи или участвуйте в чужих',
      'отслеживайте приседания, отжимания и планку',
    ],
  },
  {
    id: 'progress',
    headline: 'Следите за прогрессом каждый день',
    features: [
      'ведите серию активных дней и не теряйте темп',
      'отмечайте тренировки в недельном календаре',
    ],
  },
  {
    id: 'knowledge',
    headline: 'Тренируйтесь с умом',
    features: [
      'читайте статьи о технике упражнений',
      'подключайте шагомер и следите за активностью',
    ],
  },
];

interface AuthMobileOnboardingProps {
  /** «начать» — переход к форме регистрации */
  onStart: () => void;
  /** «у меня уже есть аккаунт» — переход к форме входа */
  onSignIn: () => void;
}

/**
 * Вводный экран для мобильной версии (< lg): карусель с преимуществами
 * приложения и кнопки перехода к регистрации/входу. До авторизации.
 */
export function AuthMobileOnboarding({ onStart, onSignIn }: AuthMobileOnboardingProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const slide = SLIDES[slideIndex];

  const goTo = (next: number) => {
    setSlideIndex((next + SLIDES.length) % SLIDES.length);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 48) {
      goTo(slideIndex + (delta < 0 ? 1 : -1));
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-lg mx-auto px-4 sm:px-6 py-8">
      <div className="flex justify-center mb-8">
        <AuthBrandMark />
      </div>

      <div
        className="flex-1 flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div key={slide.id} className="animate-fade-in">
          <h1 className="text-2xl font-extrabold text-neutral-text leading-snug mb-6">
            {slide.headline}
          </h1>

          {slideIndex === 0 ? (
            <div className="mb-4 -mx-1">
              <AuthExerciseShowcase onSlideChange={setShowcaseIndex} />
            </div>
          ) : (
          <div className="flex items-center gap-1 mb-4 -mx-2">
            <button
              type="button"
              onClick={() => goTo(slideIndex - 1)}
              aria-label="Предыдущий слайд"
              className="p-1 flex-shrink-0 text-neutral-muted hover:text-neutral-text transition-colors duration-150"
            >
              <ChevronLeft size={28} />
            </button>

            <div className="flex-1 min-w-0">
                <div className="aspect-[16/10] rounded-3xl overflow-hidden shadow-card relative">
                  {slideIndex === 1 ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-lime-light to-lime/40">
                      <CalendarCheck size={72} strokeWidth={1.5} className="text-lime-hover" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-light to-accent/50">
                      <BookOpen size={72} strokeWidth={1.5} className="text-brand" />
                    </div>
                  )}
                </div>
            </div>

            <button
              type="button"
              onClick={() => goTo(slideIndex + 1)}
              aria-label="Следующий слайд"
              className="p-1 flex-shrink-0 text-neutral-muted hover:text-neutral-text transition-colors duration-150"
            >
              <ChevronRight size={28} />
            </button>
          </div>
          )}

          <div className="flex justify-center gap-1.5 mb-6" aria-hidden="true">
            {SLIDES.map((item, index) => (
              <span
                key={item.id}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  index === slideIndex ? 'w-5 bg-brand' : 'w-1.5 bg-neutral-border'
                }`}
              />
            ))}
          </div>

          <AuthStaggeredFeatures
            features={slide.features}
            animationKey={slideIndex === 0 ? showcaseIndex : slideIndex}
          />
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <Button fullWidth className="rounded-full py-3.5" onClick={onStart}>
          начать
        </Button>
        <Button variant="lime" fullWidth className="rounded-full py-3.5" onClick={onSignIn}>
          у меня уже есть аккаунт
        </Button>
      </div>
    </div>
  );
}
