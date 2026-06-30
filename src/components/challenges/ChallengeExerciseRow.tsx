import { ChevronDown } from 'lucide-react';
import type { ApiExercise } from '../../types/api.types.ts';
import {
  clampRepsGoal,
  combinePlankGoal,
  DEFAULT_PLANK_SECONDS,
  DEFAULT_REPS_GOAL,
  MAX_PLANK_MINUTES,
  MAX_PLANK_TOTAL_SECONDS,
  MAX_REPS_GOAL,
  splitPlankGoal,
} from '../../constants/challengeLimits.ts';
import { generateId } from '../../utils/generateId.ts';

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
  return metric === 'seconds' ? 'время' : 'повторений';
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
  const plankParts =
    metric === 'seconds' && row.goal > 0
      ? splitPlankGoal(row.goal)
      : { minutes: 0, seconds: DEFAULT_PLANK_SECONDS };

  const handleExerciseChange = (exerciseId: number) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const defaultGoal =
      exercise?.metric === 'seconds' ? DEFAULT_PLANK_SECONDS : DEFAULT_REPS_GOAL;
    onChange(row.rowId, { exerciseId, goal: defaultGoal });
  };

  const handleRepsChange = (raw: string) => {
    const value = parseInt(raw, 10);
    if (!isNaN(value) && value > 0) {
      onChange(row.rowId, { goal: clampRepsGoal(value) });
    } else if (raw === '') {
      onChange(row.rowId, { goal: 0 });
    }
  };

  const handlePlankMinutesChange = (raw: string) => {
    const minutes = raw === '' ? 0 : parseInt(raw, 10);
    if (isNaN(minutes)) return;
    onChange(row.rowId, {
      goal: combinePlankGoal(minutes, plankParts.seconds),
    });
  };

  const handlePlankSecondsChange = (raw: string) => {
    const seconds = raw === '' ? 0 : parseInt(raw, 10);
    if (isNaN(seconds)) return;
    onChange(row.rowId, {
      goal: combinePlankGoal(plankParts.minutes, seconds),
    });
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 bg-white border border-neutral-border rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 w-full sm:w-auto sm:min-w-[220px] sm:flex-1 sm:max-w-[360px]">
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

      {selected?.metric === 'seconds' ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            min={0}
            max={MAX_PLANK_MINUTES}
            value={plankParts.minutes}
            onChange={(e) => handlePlankMinutesChange(e.target.value)}
            disabled={!selected}
            aria-label="Минуты"
            className="w-10 sm:w-12 text-center text-sm font-medium text-neutral-text border border-neutral-border rounded-xl py-1.5 focus:outline-none focus:border-brand disabled:bg-neutral-card disabled:text-neutral-muted"
          />
          <span className="text-xs text-neutral-muted">м</span>
          <input
            type="number"
            min={0}
            max={59}
            value={plankParts.seconds}
            onChange={(e) => handlePlankSecondsChange(e.target.value)}
            disabled={!selected}
            aria-label="Секунды"
            className="w-10 sm:w-12 text-center text-sm font-medium text-neutral-text border border-neutral-border rounded-xl py-1.5 focus:outline-none focus:border-brand disabled:bg-neutral-card disabled:text-neutral-muted"
          />
          <span className="text-xs text-neutral-muted">с</span>
        </div>
      ) : (
        <input
          type="number"
          min={1}
          max={MAX_REPS_GOAL}
          value={selected && row.goal > 0 ? row.goal : ''}
          onChange={(e) => handleRepsChange(e.target.value)}
          disabled={!selected}
          aria-label="Цель"
          className="w-14 sm:w-16 text-center text-sm font-medium text-neutral-text border border-neutral-border rounded-xl py-1.5 focus:outline-none focus:border-brand disabled:bg-neutral-card disabled:text-neutral-muted"
        />
      )}

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
    rowId: generateId(),
    exerciseId: null,
    goal: 0,
  };
}

export function isExerciseRowValid(
  row: ExerciseRowData,
  exercises: ApiExercise[],
): boolean {
  if (row.exerciseId === null || row.goal <= 0) return false;
  const exercise = exercises.find((item) => item.id === row.exerciseId);
  if (!exercise) return false;
  if (exercise.metric === 'seconds') {
    return row.goal >= 1 && row.goal <= MAX_PLANK_TOTAL_SECONDS;
  }
  return row.goal >= 1 && row.goal <= MAX_REPS_GOAL;
}
