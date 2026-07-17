import { useLayoutEffect, useState } from 'react';
import type { TourPlacement } from '../../data/appOnboardingTour.ts';
import { findTourTarget, getSpotlightRect } from '../../utils/tourTarget.ts';
import {
  getTooltipPosition,
  resolvePlacement,
  type ResolvedPlacement,
  type Viewport,
} from './tourTooltipPosition.ts';
import { Button } from '../ui/Button.tsx';

interface SpotlightOverlayProps {
  targetId?: string;
  title: string;
  description: string;
  placement?: TourPlacement;
  stepIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

const OVERLAY_COLOR = 'rgba(55, 65, 81, 0.82)';

function currentViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

function tooltipTransformClass(placement: ResolvedPlacement): string {
  switch (placement) {
    case 'center':
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    case 'top':
      return '-translate-x-1/2 -translate-y-full';
    case 'left':
      return '-translate-y-1/2 -translate-x-full';
    case 'right':
      return '-translate-y-1/2';
    case 'fixed-bottom':
      return 'left-1/2 -translate-x-1/2 -translate-y-full';
    default:
      return '-translate-x-1/2';
  }
}

export function SpotlightOverlay({
  targetId,
  title,
  description,
  placement = 'auto',
  stepIndex,
  totalSteps,
  isFirst,
  isLast,
  onBack,
  onNext,
  onSkip,
}: SpotlightOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      if (!targetId) {
        setRect(null);
        return;
      }
      const element = findTourTarget(targetId);
      if (!element) {
        setRect(null);
        return;
      }
      setRect(getSpotlightRect(element));
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [targetId]);

  const viewport = currentViewport();
  const resolvedPlacement = resolvePlacement(rect, placement, viewport);
  const tooltip = getTooltipPosition(rect, resolvedPlacement, viewport);
  const isCenter = tooltip.placement === 'center';
  const isFixedBottom = tooltip.placement === 'fixed-bottom';

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="absolute rounded-2xl pointer-events-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: `0 0 0 9999px ${OVERLAY_COLOR}`,
          }}
        />
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: OVERLAY_COLOR }} />
      )}

      <div
        className={`absolute z-[101] ${
          isFixedBottom
            ? 'left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] w-[min(360px,calc(100%-2rem))]'
            : isCenter
              ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4'
              : `px-0 ${tooltipTransformClass(tooltip.placement)}`
        }`}
        style={
          isFixedBottom
            ? undefined
            : isCenter
              ? { maxWidth: tooltip.maxWidth }
              : {
                  top: tooltip.top,
                  left: tooltip.left,
                  width: tooltip.maxWidth,
                  maxWidth: tooltip.maxWidth,
                }
        }
      >
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-modal p-4 sm:p-6 pointer-events-auto">
          <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3">
            <p className="text-[11px] sm:text-xs font-semibold text-brand uppercase tracking-wide">
              Шаг {stepIndex + 1} из {totalSteps}
            </p>
            <button
              type="button"
              onClick={onSkip}
              className="text-[11px] sm:text-xs font-medium text-neutral-muted hover:text-neutral-secondary"
            >
              Пропустить
            </button>
          </div>

          <h2 id="tour-title" className="text-base sm:text-xl font-extrabold text-neutral-text mb-1.5 sm:mb-2">
            {title}
          </h2>
          <p className="text-[13px] sm:text-sm text-neutral-secondary leading-relaxed mb-4 sm:mb-5">
            {description}
          </p>

          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="secondary" size="md" fullWidth onClick={onBack}>
                Назад
              </Button>
            )}
            <Button variant="primary" size="md" fullWidth onClick={onNext}>
              {isLast ? 'Завершить' : 'Дальше'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
