import { describe, it, expect } from 'vitest';
import { APP_TOUR_STEPS } from '../../data/appOnboardingTour.ts';
import {
  computeTooltipBox,
  TOOLTIP_MARGIN,
  type TargetRect,
  type Viewport,
} from './tourTooltipPosition.ts';

/**
 * Регрессия на баг «плашка тура не влезает в экран» (стрик-шаг с
 * placement:'left' уезжал за левый край на телефоне).
 *
 * Инвариант, который проверяем: при ЛЮБОМ положении цели и на любом из
 * типовых экранов итоговый bounding box плашки по горизонтали остаётся
 * внутри [MARGIN, width - MARGIN] — то есть не прилипает к краю и не
 * вылезает за него.
 */

// Типовые вьюпорты: узкие телефоны, обычные телефоны, планшет, десктоп.
const VIEWPORTS: Array<Viewport & { name: string }> = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'iPhone 12 mini', width: 360, height: 780 },
  { name: 'iPhone 12/13/14', width: 390, height: 844 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 800 },
];

/** Прямоугольник цели фиксированного размера с левым-верхним углом в (x, y). */
function targetAt(x: number, y: number, w = 120, h = 64): TargetRect {
  return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
}

/**
 * Сетка положений цели по экрану: углы, края и центр. Именно на краях
 * (цель у самого края, а плашка уходит в противоположную сторону)
 * проявлялся баг.
 */
function targetGrid(viewport: Viewport): TargetRect[] {
  const w = 120;
  const h = 64;
  const xs = [0, viewport.width / 2 - w / 2, viewport.width - w];
  const ys = [0, viewport.height / 2 - h / 2, viewport.height - h];
  const rects: TargetRect[] = [];
  for (const x of xs) {
    for (const y of ys) {
      rects.push(targetAt(x, y, w, h));
    }
  }
  return rects;
}

describe('tour tooltip fits on screen', () => {
  for (const viewport of VIEWPORTS) {
    for (const step of APP_TOUR_STEPS) {
      it(`«${step.title}» (${step.placement ?? 'auto'}) влезает на ${viewport.name}`, () => {
        // center-шаги привязаны к серёдке экрана и не зависят от цели.
        const rects = step.placement === 'center' ? [null] : targetGrid(viewport);

        for (const rect of rects) {
          const box = computeTooltipBox(rect, step.placement ?? 'auto', viewport);

          expect(
            box.left,
            `left ${box.left.toFixed(1)} < отступ (${step.title}, ${box.placement}, ${viewport.name})`,
          ).toBeGreaterThanOrEqual(TOOLTIP_MARGIN - 0.5);

          expect(
            box.right,
            `right ${box.right.toFixed(1)} > ${viewport.width - TOOLTIP_MARGIN} (${step.title}, ${box.placement}, ${viewport.name})`,
          ).toBeLessThanOrEqual(viewport.width - TOOLTIP_MARGIN + 0.5);

          // Плашка не шире доступной ширины экрана за вычетом отступов.
          expect(box.width).toBeLessThanOrEqual(viewport.width - TOOLTIP_MARGIN * 2 + 0.5);
        }
      });
    }
  }

  it('воспроизводит исходный баг: стрик у правого края на телефоне не вылезает влево', () => {
    const viewport: Viewport = { width: 390, height: 844 };
    // Виджет стрика — в правой части шапки дашборда.
    const streak = targetAt(210, 90, 150, 70);
    const box = computeTooltipBox(streak, 'left', viewport);

    expect(box.left).toBeGreaterThanOrEqual(TOOLTIP_MARGIN - 0.5);
    expect(box.right).toBeLessThanOrEqual(viewport.width - TOOLTIP_MARGIN + 0.5);
  });
});
