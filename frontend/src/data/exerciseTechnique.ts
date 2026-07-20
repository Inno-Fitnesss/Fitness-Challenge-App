import type { CvExercise } from '../cv/poseCvEngine.ts';
import { detectExercise } from '../cv/poseCvEngine.ts';
import type { ExerciseMetric } from '../types/session.types.ts';

export interface ExerciseTechniqueContent {
  exerciseKey: string;
  title: string;
  techniqueTitle: string;
  techniqueTips: string[];
  setupTips: string[];
  /** Optional hosted video URL — add when assets are ready */
  videoUrl?: string;
  posterGradient: string;
}

const DEFAULT_TECHNIQUE: Omit<ExerciseTechniqueContent, 'exerciseKey' | 'title'> = {
  techniqueTitle: 'Техника выполнения',
  techniqueTips: [
    'Выполняйте движение плавно и под контролем',
    'Следите за дыханием',
    'Держите корпус в стабильном положении',
  ],
  setupTips: [
    'Держите телефон или ноутбук неподвижно',
    'Убедитесь, что вас хорошо видно',
    'Встаньте так, чтобы всё тело попадало в кадр',
  ],
  posterGradient: 'from-brand/80 to-accent/80',
};

const TECHNIQUE_BY_EXERCISE: Record<CvExercise, Omit<ExerciseTechniqueContent, 'exerciseKey' | 'title'>> = {
  pushup: {
    techniqueTitle: 'Техника выполнения',
    techniqueTips: [
      'Руки на ширине плеч',
      'Корпус — прямая линия от плеч до стоп',
      'Опускайтесь до угла в локтях около 90°',
      'Не прогибайте поясницу и не поднимайте таз',
    ],
    setupTips: [
      'Держите телефон или ноутбук неподвижно',
      'Убедитесь, что вас хорошо видно',
      'Встаньте боком, как на видео — должны быть видны плечи, таз и стопы',
    ],
    videoUrl: '/exercise-videos/pushup.mp4',
    posterGradient: 'from-violet-500/90 to-fuchsia-600/90',
  },
  squat: {
    techniqueTitle: 'Техника выполнения',
    techniqueTips: [
      'Ноги на ширине плеч, носки слегка развёрнуты',
      'Спина прямая, взгляд вперёд',
      'Опускайтесь до параллели бёдер с полом',
      'Колени не выходят далеко за носки',
    ],
    setupTips: [
      'Держите телефон или ноутбук неподвижно',
      'Убедитесь, что вас хорошо видно',
      'Встаньте боком к камере — должны быть видны бедро, колено и стопа',
    ],
    videoUrl: '/exercise-videos/squat.mp4',
    posterGradient: 'from-emerald-500/90 to-teal-600/90',
  },
  plank: {
    techniqueTitle: 'Техника выполнения',
    techniqueTips: [
      'Опора на предплечья или ладони',
      'Тело — прямая линия, таз не провисает',
      'Напрягите пресс и ягодицы',
      'Дышите ровно, не задерживайте дыхание',
    ],
    setupTips: [
      'Держите телефон или ноутбук неподвижно',
      'Убедитесь, что вас хорошо видно',
      'Встаньте боком — плечи, таз и стопы должны быть в одной плоскости',
    ],
    videoUrl: '/exercise-videos/plank.mp4',
    posterGradient: 'from-sky-500/90 to-blue-600/90',
  },
  unsupported: DEFAULT_TECHNIQUE,
};

export function getExerciseTechniqueKey(
  exerciseName: string,
  metric: ExerciseMetric,
): string {
  const detected = detectExercise(exerciseName, metric);
  if (detected !== 'unsupported') return detected;
  return exerciseName.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, '-');
}

export function getExerciseTechniqueContent(
  exerciseName: string,
  metric: ExerciseMetric,
): ExerciseTechniqueContent {
  const detected = detectExercise(exerciseName, metric);
  const template = TECHNIQUE_BY_EXERCISE[detected] ?? DEFAULT_TECHNIQUE;

  return {
    exerciseKey: getExerciseTechniqueKey(exerciseName, metric),
    title: exerciseName,
    ...template,
  };
}
