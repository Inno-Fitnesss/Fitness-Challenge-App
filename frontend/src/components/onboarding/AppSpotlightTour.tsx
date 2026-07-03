import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_TOUR_STEPS } from '../../data/appOnboardingTour.ts';
import { waitForTourTarget } from '../../utils/tourTarget.ts';
import { SpotlightOverlay } from './SpotlightOverlay.tsx';

interface AppSpotlightTourProps {
  onComplete: () => void;
}

function routesMatch(currentPath: string, currentSearch: string, targetRoute: string): boolean {
  const [targetPath, targetQuery = ''] = targetRoute.split('?');
  if (currentPath !== targetPath) return false;
  if (!targetQuery) return true;

  const expected = new URLSearchParams(targetQuery);
  const actual = new URLSearchParams(currentSearch);
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

export function AppSpotlightTour({ onComplete }: AppSpotlightTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const step = APP_TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === APP_TOUR_STEPS.length - 1;

  useEffect(() => {
    let cancelled = false;

    const prepareStep = async () => {
      setIsReady(false);

      if (step.route && !routesMatch(location.pathname, location.search, step.route)) {
        navigate(step.route);
        return;
      }

      if (step.target) {
        const element = await waitForTourTarget(step.target);
        if (cancelled) return;
        element?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        await new Promise((resolve) => window.setTimeout(resolve, 280));
      }

      if (!cancelled) setIsReady(true);
    };

    void prepareStep();

    return () => {
      cancelled = true;
    };
  }, [stepIndex, step.route, step.target, location.pathname, location.search, navigate]);

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex((prev) => prev + 1);
  }, [isLast, onComplete]);

  const handleBack = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  if (!isReady) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-lime/30 border-t-lime rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SpotlightOverlay
      targetId={step.target}
      title={step.title}
      description={step.description}
      placement={step.placement}
      stepIndex={stepIndex}
      totalSteps={APP_TOUR_STEPS.length}
      isFirst={isFirst}
      isLast={isLast}
      onBack={handleBack}
      onNext={handleNext}
      onSkip={onComplete}
    />
  );
}
