// Общий, переиспользуемый механизм сегментации повтора по фазам движения.
//
// В отличие от одного числового порога (угол сустава > X = "верх") — здесь
// каждый кадр классифицируется через KNN относительно банка эталонных поз
// по каждой фазе, а повтор засчитывается, когда фазы прошли в правильном
// порядке (цепочка чекпоинтов). Валидировано на 100 реальных видео пушапа
// (ml/validate_knn_phase_segmentation.py — 100% точность на отложенных
// данных). Рассчитано на расширение: составные упражнения (например, бёрпи)
// используют более длинную цепочку фаз с собственным банком эталонов, тот же
// код без изменений.

export interface PhaseBank {
  featureMean: readonly number[];
  featureStd: readonly number[];
  phases: Readonly<Record<string, readonly (readonly number[])[]>>;
}

function euclideanDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Возвращается, когда поза не похожа ни на одну известную фазу (см. maxDistance). */
export const PHASE_NONE = 'none';

/**
 * k-NN классификация текущего кадра относительно банка эталонных фаз.
 *
 * `maxDistance`, если задан, — порог отказа: если среднее расстояние до k
 * ближайших эталонов больше этого значения, поза считается не похожей ни на
 * одну известную фазу (возвращается PHASE_NONE), а не насильно
 * приписывается ближайшему классу. Это отсекает совсем другую позу
 * (например, "сидя сгибает локоть" вместо реального упора лёжа) — без этого
 * KNN обязан был бы выбрать top/bottom даже для позы, вообще не похожей ни
 * на одно из двух.
 */
export function classifyPhaseKnn(
  features: readonly number[],
  bank: PhaseBank,
  k = 3,
  maxDistance?: number,
): string {
  const normalized = features.map(
    (value, i) => (value - bank.featureMean[i]) / bank.featureStd[i],
  );

  const distances: Array<{ dist: number; phase: string }> = [];
  for (const [phase, refs] of Object.entries(bank.phases)) {
    for (const ref of refs) {
      // Эталоны в банке хранятся в исходных единицах (градусы) для
      // читаемости — нормализуем их тем же mean/std, что и текущий кадр,
      // иначе сравнение бессмысленно (разный масштаб).
      const normalizedRef = ref.map(
        (value, i) => (value - bank.featureMean[i]) / bank.featureStd[i],
      );
      distances.push({ dist: euclideanDistance(normalizedRef, normalized), phase });
    }
  }
  distances.sort((a, b) => a.dist - b.dist);

  const nearest = distances.slice(0, k);
  if (maxDistance !== undefined) {
    const meanDistance = nearest.reduce((sum, d) => sum + d.dist, 0) / nearest.length;
    if (meanDistance > maxDistance) return PHASE_NONE;
  }

  const votes: Record<string, number> = {};
  for (const { phase } of nearest) {
    votes[phase] = (votes[phase] ?? 0) + 1;
  }
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Повтор засчитывается, когда классифицированные фазы прошли `cycle` по
 * порядку (например, ['top', 'bottom', 'top'] для пушапа/приседа; для
 * составного движения — более длинная цепочка). Гистерезис
 * (`stableFramesRequired`) отбрасывает дрожание классификации на отдельных
 * шумных кадрах.
 */
export class PhaseSequenceCounter {
  private cycleIndex = 0;
  private pendingPhase: string | null = null;
  private stableCount = 0;

  constructor(
    private readonly cycle: readonly string[],
    private readonly stableFramesRequired = 2,
  ) {}

  /**
   * Обработать классифицированную фазу текущего кадра.
   * `onWindowStart` вызывается каждый раз, когда начинается отслеживание
   * нового повтора (в том числе сразу после засчитанного) — в этот момент
   * стоит сбрасывать признаки, накопленные за предыдущее окно.
   * Возвращает true, если именно на этом кадре цикл завершился (повтор
   * засчитан).
   */
  update(phase: string, onWindowStart?: () => void): boolean {
    if (phase === this.pendingPhase) {
      this.stableCount += 1;
    } else {
      this.pendingPhase = phase;
      this.stableCount = 1;
    }
    if (this.stableCount < this.stableFramesRequired) return false;
    if (phase !== this.cycle[this.cycleIndex]) return false;

    this.cycleIndex += 1;
    if (this.cycleIndex >= this.cycle.length) {
      this.cycleIndex = 1;
      onWindowStart?.();
      return true;
    }
    if (this.cycleIndex === 1) {
      onWindowStart?.();
    }
    return false;
  }

  reset(): void {
    this.cycleIndex = 0;
    this.pendingPhase = null;
    this.stableCount = 0;
  }
}
