import type { TourPlacement } from '../../data/appOnboardingTour.ts';

/**
 * Чистая (без обращений к DOM/`window`) геометрия тултипа онбординг-тура.
 *
 * Вынесено из SpotlightOverlay, чтобы:
 *   1) переиспользовать одну и ту же математику в компоненте;
 *   2) покрыть unit-тестом инвариант «плашка всегда влезает в экран с
 *      отступом» без запуска браузера (см. tourTooltipPosition.test.ts).
 *
 * Все функции принимают размеры вьюпорта явным параметром, а не читают
 * `window.innerWidth/Height`.
 */

export type ResolvedPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'fixed-bottom';

export interface Viewport {
  width: number;
  height: number;
}

/** Минимальный набор полей DOMRect, который нужен позиционированию. */
export interface TargetRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface TooltipPosition {
  top: number;
  left: number;
  maxWidth: number;
  placement: ResolvedPlacement;
}

/** Итоговый горизонтальный bounding box плашки на экране (после CSS-трансформа). */
export interface TooltipBox {
  left: number;
  right: number;
  width: number;
  top: number;
  placement: ResolvedPlacement;
}

/** Обязательный отступ плашки от края экрана. */
export const TOOLTIP_MARGIN = 16;

// Компактный тултип на телефоне: занижаем оценку высоты и ширину,
// чтобы позиционирование не резервировало лишнее место на маленьком экране.
export function tooltipEstimatedHeight(viewport: Viewport): number {
  return viewport.width < 640 ? 200 : 260;
}

export function tooltipMaxWidth(viewport: Viewport): number {
  return Math.min(
    viewport.width < 640 ? 320 : 360,
    viewport.width - TOOLTIP_MARGIN * 2,
  );
}

/**
 * Границы для точки привязки `left` (в координатах экрана), при которых
 * плашка целиком помещается в [MARGIN, width - MARGIN]. Границы зависят от
 * CSS-трансформа плейсмента: top/bottom/center центрируются по anchor
 * (`-translate-x-1/2`), left привязан правым краём (`-translate-x-full`),
 * right — левым (без сдвига по X).
 */
function horizontalAnchorBounds(
  placement: ResolvedPlacement,
  width: number,
  viewport: Viewport,
): [min: number, max: number] {
  const lo = TOOLTIP_MARGIN;
  const hi = viewport.width - TOOLTIP_MARGIN;

  switch (placement) {
    case 'left':
      // anchor — правый край блока
      return [lo + width, hi];
    case 'right':
      // anchor — левый край блока
      return [lo, hi - width];
    default:
      // центрируется по anchor
      return [lo + width / 2, hi - width / 2];
  }
}

export function resolvePlacement(
  rect: TargetRect | null,
  preferred: TourPlacement,
  viewport: Viewport,
): ResolvedPlacement {
  if (!rect || preferred === 'center') return 'center';

  if (rect.height > viewport.height * 0.45) {
    return 'fixed-bottom';
  }

  const estimatedHeight = tooltipEstimatedHeight(viewport);
  const spaceBelow = viewport.height - rect.bottom - TOOLTIP_MARGIN;
  const spaceAbove = rect.top - TOOLTIP_MARGIN;

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
      // Боковой плейсмент оставляем только если сбоку реально помещается
      // вся ширина плашки с отступом — иначе она вылезла бы за край экрана
      // (или её пришлось бы наложить на цель). Тогда уводим вертикально.
      const tooltipWidth = tooltipMaxWidth(viewport);
      const sideSpace =
        preferred === 'left'
          ? rect.left - TOOLTIP_MARGIN
          : viewport.width - rect.right - TOOLTIP_MARGIN;
      if (sideSpace >= tooltipWidth + TOOLTIP_MARGIN) {
        return preferred;
      }
      return flipIfNeeded(spaceBelow >= spaceAbove ? 'bottom' : 'top');
    }
    return 'bottom';
  }

  const spaceRight = viewport.width - rect.right;

  if (rect.top > viewport.height * 0.65) return 'top';
  if (spaceRight > 320 && rect.left < 200) return 'right';
  if (spaceBelow > estimatedHeight) return 'bottom';
  if (spaceAbove > estimatedHeight) return 'top';
  return 'fixed-bottom';
}

export function getTooltipPosition(
  rect: TargetRect | null,
  placement: ResolvedPlacement,
  viewport: Viewport,
): TooltipPosition {
  const tooltipWidth = tooltipMaxWidth(viewport);
  const estimatedHeight = tooltipEstimatedHeight(viewport);

  if (!rect || placement === 'center') {
    return {
      top: viewport.height / 2,
      left: viewport.width / 2,
      maxWidth: tooltipWidth,
      placement: 'center',
    };
  }

  if (placement === 'fixed-bottom') {
    return {
      top: viewport.height - TOOLTIP_MARGIN,
      left: viewport.width / 2,
      maxWidth: tooltipWidth,
      placement: 'fixed-bottom',
    };
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'top':
      top = rect.top - TOOLTIP_MARGIN;
      left = rect.left + rect.width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2;
      left = rect.left - TOOLTIP_MARGIN;
      break;
    case 'right':
      top = rect.top + rect.height / 2;
      left = rect.right + TOOLTIP_MARGIN;
      break;
    default:
      top = rect.bottom + TOOLTIP_MARGIN;
      left = rect.left + rect.width / 2;
      break;
  }

  const [minLeft, maxLeft] = horizontalAnchorBounds(placement, tooltipWidth, viewport);
  left = Math.min(Math.max(left, minLeft), maxLeft);

  if (placement === 'bottom') {
    top = Math.min(top, viewport.height - estimatedHeight - TOOLTIP_MARGIN);
  } else if (placement === 'top') {
    top = Math.max(top, estimatedHeight + TOOLTIP_MARGIN);
  } else if (placement === 'left' || placement === 'right') {
    top = Math.min(
      Math.max(top, estimatedHeight / 2 + TOOLTIP_MARGIN),
      viewport.height - estimatedHeight / 2 - TOOLTIP_MARGIN,
    );
  }

  return { top, left, maxWidth: tooltipWidth, placement };
}

/**
 * Итоговый горизонтальный bounding box плашки на экране с учётом
 * CSS-трансформа плейсмента. Используется в тесте для проверки инварианта
 * «плашка влезает в экран с отступом» и может пригодиться для отладки.
 */
export function computeTooltipBox(
  rect: TargetRect | null,
  preferred: TourPlacement,
  viewport: Viewport,
): TooltipBox {
  const placement = resolvePlacement(rect, preferred, viewport);
  const pos = getTooltipPosition(rect, placement, viewport);
  const width = pos.maxWidth;

  let left: number;
  switch (pos.placement) {
    case 'center':
    case 'fixed-bottom':
      left = viewport.width / 2 - width / 2;
      break;
    case 'left':
      // -translate-x-full: anchor — правый край
      left = pos.left - width;
      break;
    case 'right':
      // без сдвига по X: anchor — левый край
      left = pos.left;
      break;
    default:
      // -translate-x-1/2: anchor по центру
      left = pos.left - width / 2;
      break;
  }

  return { left, right: left + width, width, top: pos.top, placement: pos.placement };
}
