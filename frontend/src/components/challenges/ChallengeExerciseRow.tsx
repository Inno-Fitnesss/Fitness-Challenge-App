import { ChevronDown } from 'lucide-react';
import type { ApiExercise } from '../../types/api.types.ts';

export interface ExerciseRowData {
  rowId: string;
  exerciseId: number | null;
  goal: number;
}

interface ChallengeExerciseRowProps {
  row: ExerciseRowData;
  exercises: ApiExercise[];
  usedExerciseIds: Set<number>;
  onChange: (rowId: string, patch: Partial<ExerciseRowData>) => void;
  onRemove: (rowId: string) => void;
  canRemove: boolean;
}

function metricLabel(metric: ApiExercise['metric']): string {
  return metric === 'seconds' ? 'минут' : 'повторений';
}

function displayGoal(metric: ApiExercise['metric'] | undefined, goal: number): number {
  if (metric === 'seconds') return goal > 0 ? Math.round(goal / 60) : 0;
  return goal;
}

function storeGoal(metric: ApiExercise['metric'] | undefined, value: number): number {
  if (metric === 'seconds') return value * 60;
  return value;
}

export function ChallengeExerciseRow({
  row,
  exercises,
  usedExerciseIds,
  onChange,
  onRemove,
  canRemove,
}: ChallengeExerciseRowProps) {
  const selected = exercises.find((e) => e.id === row.exerciseId);
  const metric = selected?.metric;

  const handleExerciseChange = (exerciseId: number) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const defaultGoal = exercise?.metric === 'seconds' ? 120 : 50;
    onChange(row.rowId, { exerciseId, goal: defaultGoal });
  };

  const handleGoalChange = (raw: string) => {
    const value = parseInt(raw, 10);
    if (!isNaN(value) && value > 0) {
      onChange(row.rowId, { goal: storeGoal(metric, value) });
    } else if (raw === '') {
      onChange(row.rowId, { goal: 0 });
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 bg-white border border-neutral-border rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 w-full sm:w-auto sm:min-w-[220px] sm:flex-1 sm:max-w-[320px]">
      <div className="relative flex-1 min-w-0">
        <select
          value={row.exerciseId ?? ''}
          onChange={(e) => handleExerciseChange(Number(e.target.value))}
          className="w-full appearance-none bg-transparent text-sm text-neutral-text pr-6 focus:outline-none cursor-pointer truncate lowercase"
          aria-label="Упражнение"
        >
          <option value="" disabled>
            выберите
          </option>
          {exercises.map((exercise) => {
            const disabled =
              exercise.id !== row.exerciseId && usedExerciseIds.has(exercise.id);
            return (
              <option key={exercise.id} value={exercise.id} disabled={disabled}>
                {exercise.name.toLowerCase()}
              </option>
            );
          })}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-muted pointer-events-none"
        />
      </div>

      {selected && (
        <span className="text-xs text-neutral-muted whitespace-nowrap flex-shrink-0">
          {metricLabel(selected.metric)}
        </span>
      )}

      <input
        type="number"
        min={1}
        value={selected ? displayGoal(metric, row.goal) || '' : ''}
        onChange={(e) => handleGoalChange(e.target.value)}
        disabled={!selected}
        aria-label="Цель"
        className="w-14 sm:w-16 text-center text-sm font-medium text-neutral-text border border-neutral-border rounded-xl py-1.5 focus:outline-none focus:border-brand disabled:bg-neutral-card disabled:text-neutral-muted"
      />

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(row.rowId)}
          aria-label="Удалить упражнение"
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-neutral-muted hover:text-red-500 hover:bg-red-50 transition-colors text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function createEmptyExerciseRow(): ExerciseRowData {
  return {
    rowId: crypto.randomUUID(),
    exerciseId: null,
    goal: 0,
  };
}

export function isExerciseRowValid(row: ExerciseRowData): boolean {
  return row.exerciseId !== null && row.goal > 0;
}
