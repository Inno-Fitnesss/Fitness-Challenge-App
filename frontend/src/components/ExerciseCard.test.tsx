import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseCard } from './ExerciseCard.tsx';
import type { Exercise } from '../types/challenge.ts';

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1',
    name: 'Приседания',
    description: '20 повторений',
    icon: '🏋️',
    reps: 10,
    ...overrides,
  };
}

/**
 * ExerciseCard is a fully controlled component (`value={exercise.reps}`).
 * A bare `vi.fn()` as onRepsChange doesn't update anything, so after each
 * keystroke React snaps the input back to the original `reps` prop —
 * exactly like it would if a real parent forgot to update state. To
 * exercise typing the way it's actually used in the app, this tiny wrapper
 * plays the role of that real parent: it holds `reps` in state and feeds
 * the updated value back down, so the controlled input behaves the way it
 * does in production.
 */
function ControlledHarness({
  onRepsChange,
  onRemove,
}: {
  onRepsChange: (id: string, reps: number) => void;
  onRemove: (id: string) => void;
}) {
  const [exercise, setExercise] = useState(makeExercise({ reps: 10 }));
  return (
    <ExerciseCard
      exercise={exercise}
      onRepsChange={(id, reps) => {
        setExercise((prev) => ({ ...prev, reps }));
        onRepsChange(id, reps);
      }}
      onRemove={onRemove}
    />
  );
}

describe('ExerciseCard', () => {
  it('renders the exercise name, description and current reps', () => {
    render(
      <ExerciseCard exercise={makeExercise()} onRepsChange={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByText('Приседания')).toBeInTheDocument();
    expect(screen.getByText('20 повторений')).toBeInTheDocument();
    expect(screen.getByLabelText('Количество повторений')).toHaveValue(10);
  });

  it('increments reps when the plus button is clicked', async () => {
    const user = userEvent.setup();
    const onRepsChange = vi.fn();
    render(
      <ExerciseCard exercise={makeExercise({ reps: 10 })} onRepsChange={onRepsChange} onRemove={vi.fn()} />,
    );
    await user.click(screen.getByLabelText('Увеличить количество'));
    expect(onRepsChange).toHaveBeenCalledWith('ex-1', 11);
  });

  it('decrements reps when the minus button is clicked', async () => {
    const user = userEvent.setup();
    const onRepsChange = vi.fn();
    render(
      <ExerciseCard exercise={makeExercise({ reps: 10 })} onRepsChange={onRepsChange} onRemove={vi.fn()} />,
    );
    await user.click(screen.getByLabelText('Уменьшить количество'));
    expect(onRepsChange).toHaveBeenCalledWith('ex-1', 9);
  });

  it('refuses to decrement below 1 (no zero/negative reps)', async () => {
    const user = userEvent.setup();
    const onRepsChange = vi.fn();
    render(
      <ExerciseCard exercise={makeExercise({ reps: 1 })} onRepsChange={onRepsChange} onRemove={vi.fn()} />,
    );
    await user.click(screen.getByLabelText('Уменьшить количество'));
    expect(onRepsChange).not.toHaveBeenCalled();
  });

  it('calls onRemove with the exercise id when the delete button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <ExerciseCard exercise={makeExercise({ id: 'ex-42' })} onRepsChange={vi.fn()} onRemove={onRemove} />,
    );
    await user.click(screen.getByLabelText('Удалить Приседания'));
    expect(onRemove).toHaveBeenCalledWith('ex-42');
  });

  it('typing a valid positive number into the input calls onRepsChange (via a stateful parent, like in production)', () => {
    // NOTE: userEvent.clear()/type() rely on setSelectionRange, which
    // <input type="number"> does not support in real browsers or jsdom —
    // that's a testing-library limitation with numeric inputs, not
    // something the component does wrong. fireEvent.change sets the value
    // directly, the same way the browser's own number-input widget does.
    const onRepsChange = vi.fn();
    render(<ControlledHarness onRepsChange={onRepsChange} onRemove={vi.fn()} />);
    const input = screen.getByLabelText('Количество повторений');
    fireEvent.change(input, { target: { value: '25' } });
    expect(onRepsChange).toHaveBeenLastCalledWith('ex-1', 25);
    expect(input).toHaveValue(25);
  });

  it('does NOT call onRepsChange while the input is cleared to empty (avoids NaN)', () => {
    const onRepsChange = vi.fn();
    render(
      <ExerciseCard exercise={makeExercise({ reps: 10 })} onRepsChange={onRepsChange} onRemove={vi.fn()} />,
    );
    const input = screen.getByLabelText('Количество повторений');
    fireEvent.change(input, { target: { value: '' } });
    expect(onRepsChange).not.toHaveBeenCalled();
  });
});