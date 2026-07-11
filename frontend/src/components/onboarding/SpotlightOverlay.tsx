import { useLayoutEffect, useState } from 'react';
import type { TourPlacement } from '../../data/appOnboardingTour.ts';
import { findTourTarget, getSpotlightRect } from '../../utils/tourTarget.ts';
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

type ResolvedPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'fixed-bottom';

interface TooltipPosition {
  top: number;
  left: number;
  maxWidth: number;
  placement: ResolvedPlacement;
}

const OVERLAY_COLOR = 'rgba(55, 65, 81, 0.82)';
const MARGIN = 16;

// Компактный тултип на телефоне: занижаем оценку высоты и ширину,
// чтобы позиционирование не резервировало лишнее место на маленьком экране.
function tooltipEstimatedHeight(): number {
  return window.innerWidth < 640 ? 200 : 260;
}

function tooltipMaxWidth(): number {
  return Math.min(window.innerWidth < 640 ? 320 : 360, window.innerWidth - MARGIN * 2);
}

function resolvePlacement(
  rect: DOMRect | null,
  preferred: TourPlacement,
): ResolvedPlacement {
  if (!rect || preferred === 'center') return 'center';

  if (rect.height > window.innerHeight * 0.45) {
    return 'fixed-bottom';
  }

  const estimatedHeight = tooltipEstimatedHeight();
  const spaceBelow = window.innerHeight - rect.bottom - MARGIN;
  const spaceAbove = rect.top - MARGIN;

  const flipIfNeeded = (choice: 'top' | 'bottom'): 'top' | 'bottom' => {
    if (choice === 'bottom' && spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      return 'top';
    }
    if (choice === 'top' && spaceAbove < estimatedHeight && spaceBelow > spaceAbove) {
      return 'bottom';
    }
    return choice;
  };

  if (preferred !== 'auto') {
    if (preferred === 'top' || preferred === 'bottom') {
      return flipIfNeeded(preferred);
    }
    if (preferred === 'left' || preferred === 'right') {
      return preferred;
    }
    return 'bottom';
  }

  const spaceRight = window.innerWidth - rect.right;

  if (rect.top > window.innerHeight * 0.65) return 'top';
  if (spaceRight > 320 && rect.left < 200) return 'right';
  if (spaceBelow > estimatedHeight) return 'bottom';
  if (spaceAbove > estimatedHeight) return 'top';
  return 'fixed-bottom';
}

function getTooltipPosition(
  rect: DOMRect | null,
  placement: ResolvedPlacement,
): TooltipPosition {
  const tooltipWidth = tooltipMaxWidth();
  const estimatedHeight = tooltipEstimatedHeight();

  if (!rect || placement === 'center') {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      maxWidth: tooltipWidth,
      placement: 'center',
    };
  }

  if (placement === 'fixed-bottom') {
    return {
      top: window.innerHeight - MARGIN,
      left: window.innerWidth / 2,
      maxWidth: tooltipWidth,
      placement: 'fixed-bottom',
    };
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'top':
      top = rect.top - MARGIN;
      left = rect.left + rect.width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2;
      left = rect.left - MARGIN;
      break;
    case 'right':
      top = rect.top + rect.height / 2;
      left = rect.right + MARGIN;
      break;
    default:
      top = rect.bottom + MARGIN;
      left = rect.left + rect.width / 2;
      break;
  }

  left = Math.min(
    Math.max(left, MARGIN + tooltipWidth / 2),
    window.innerWidth - MARGIN - tooltipWidth / 2,
  );

  if (placement === 'bottom') {
    top = Math.min(top, window.innerHeight - estimatedHeight - MARGIN);
  } else if (placement === 'top') {
    top = Math.max(top, estimatedHeight + MARGIN);
  } else if (placement === 'left' || placement === 'right') {
    top = Math.min(
      Math.max(top, estimatedHeight / 2 + MARGIN),
      window.innerHeight - estimatedHeight / 2 - MARGIN,
    );
  }

  return { top, left, maxWidth: tooltipWidth, placement };
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

  const resolvedPlacement = resolvePlacement(rect, placement);
  const tooltip = getTooltipPosition(rect, resolvedPlacement);
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
