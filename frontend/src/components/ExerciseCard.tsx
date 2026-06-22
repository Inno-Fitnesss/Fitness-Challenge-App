import { Minus, Plus, Trash2 } from 'lucide-react';
import type { Exercise } from '../types/challenge.ts';

interface ExerciseCardProps {
  exercise: Exercise;
  onRepsChange: (id: string, reps: number) => void;
  onRemove: (id: string) => void;
}

export function ExerciseCard({ exercise, onRepsChange, onRemove }: ExerciseCardProps) {
  const handleDecrement = () => {
    if (exercise.reps > 1) onRepsChange(exercise.id, exercise.reps - 1);
  };

  const handleIncrement = () => {
    onRepsChange(exercise.id, exercise.reps + 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) onRepsChange(exercise.id, val);
  };

  return (
    <div className="group flex items-center gap-4 bg-white border border-neutral-border rounded-[20px] p-4 transition-all duration-200 hover:shadow-card hover:border-brand/30 animate-slide-up">
      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-neutral-card rounded-2xl text-2xl">
        {exercise.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-text font-semibold truncate">{exercise.name}</p>
        <p className="text-xs text-neutral-secondary mt-0.5 truncate">{exercise.description}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleDecrement}
          aria-label="Уменьшить количество"
          className="w-7 h-7 flex items-center justify-center rounded-full border border-neutral-border text-neutral-secondary hover:border-brand hover:text-brand hover:bg-brand/5 transition-all duration-150"
        >
          <Minus size={12} />
        </button>

        <input
          type="number"
          value={exercise.reps}
          onChange={handleInputChange}
          aria-label="Количество повторений"
          className="w-14 text-center text-sm font-semibold text-neutral-text border border-neutral-border rounded-lg py-1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all duration-150"
        />

        <button
          type="button"
          onClick={handleIncrement}
          aria-label="Увеличить количество"
          className="w-7 h-7 flex items-center justify-center rounded-full border border-neutral-border text-neutral-secondary hover:border-brand hover:text-brand hover:bg-brand/5 transition-all duration-150"
        >
          <Plus size={12} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onRemove(exercise.id)}
        aria-label={`Удалить ${exercise.name}`}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-neutral-secondary opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all duration-150"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
