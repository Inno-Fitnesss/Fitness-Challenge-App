import type { ExerciseTemplate } from '../types/challenge';

export const EXERCISE_TEMPLATES: ExerciseTemplate[] = [
  {
    id: 'pushups',
    name: 'Отжимания',
    description: 'Классическое упражнение для грудных мышц и трицепсов',
    icon: '💪',
    defaultReps: 50,
  },
  {
    id: 'squats',
    name: 'Приседания',
    description: 'Базовое упражнение для укрепления ног и ягодиц',
    icon: '🦵',
    defaultReps: 60,
  },
  {
    id: 'plank',
    name: 'Планка',
    description: 'Статическое упражнение для укрепления кора',
    icon: '🧘',
    defaultReps: 30,
  },
  {
    id: 'lunges',
    name: 'Выпады',
    description: 'Упражнение для баланса и силы ног',
    icon: '🏃',
    defaultReps: 40,
  },
  {
    id: 'burpees',
    name: 'Берпи',
    description: 'Интенсивное кардио-упражнение на всё тело',
    icon: '🔥',
    defaultReps: 20,
  },
  {
    id: 'crunches',
    name: 'Скручивания на пресс',
    description: 'Классическое упражнение для прямых мышц живота',
    icon: '⚡',
    defaultReps: 50,
  },
  {
    id: 'pullups',
    name: 'Подтягивания',
    description: 'Упражнение для спины и бицепсов на турнике',
    icon: '🎯',
    defaultReps: 15,
  },
  {
    id: 'jumps',
    name: 'Прыжки',
    description: 'Прыжки на месте для кардио и координации',
    icon: '🚀',
    defaultReps: 60,
  },
];
