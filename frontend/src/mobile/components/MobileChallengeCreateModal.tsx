import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { challengeApi, exerciseApi } from '../../api/challengeApi.ts';
import { CHALLENGE_DESCRIPTION_MAX_LENGTH, CHALLENGE_NAME_MAX_LENGTH } from '../../constants/challengeLimits.ts';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';
import type { ApiExercise } from '../../types/api.types.ts';
import { isValidIsoDate, todayIso } from '../../utils/dateFormat.ts';
import { generateId } from '../../utils/generateId.ts';
import { parseApiError } from '../../utils/parseApiError.ts';
import type { AxiosError } from 'axios';

interface MobileChallengeCreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface MobileExerciseRow {
  rowId: string;
  exerciseId: number | '';
  goal: number;
}

function createExerciseRow(): MobileExerciseRow {
  return {
    rowId: generateId(),
    exerciseId: '',
    goal: 0,
  };
}

function DateInput({
  id,
  label,
  value,
  min,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[12px] font-medium text-neutral-muted" htmlFor={id}>
      <span className="mb-1 block">{label}</span>
      <span className="relative block">
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="date-field-input h-[30px] w-full rounded-[4px] border border-neutral-muted/60 bg-white px-2 pr-9 text-[13px] text-neutral-text outline-none focus:border-brand disabled:bg-neutral-card"
        />
        <CalendarDays
          size={17}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-muted"
        />
      </span>
    </label>
  );
}

export function MobileChallengeCreateModal({
  onClose,
  onSuccess,
}: MobileChallengeCreateModalProps) {
  useBodyScrollLock(true);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<ApiExercise[]>([]);
  const [rows, setRows] = useState<MobileExerciseRow[]>([createExerciseRow()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await exerciseApi.list();
        if (!cancelled) setExercises(list);
      } catch (err) {
        if (!cancelled) setError(parseApiError(err as AxiosError).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const validRows = useMemo(
    () => rows.filter((row) => row.exerciseId !== '' && row.goal > 0),
    [rows],
  );

  const usedExerciseIds = useMemo(
    () => new Set(validRows.map((row) => row.exerciseId)),
    [validRows],
  );

  const isFormValid =
    name.trim().length > 0 &&
    name.trim().length <= CHALLENGE_NAME_MAX_LENGTH &&
    description.length <= CHALLENGE_DESCRIPTION_MAX_LENGTH &&
    isValidIsoDate(startDate) &&
    startDate >= todayIso() &&
    (isUnlimited || (isValidIsoDate(endDate) && endDate >= startDate)) &&
    validRows.length > 0 &&
    usedExerciseIds.size === validRows.length;

  const updateRow = (rowId: string, patch: Partial<MobileExerciseRow>) => {
    setRows((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.rowId !== rowId)));
  };

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await challengeApi.create({
        name: name.trim(),
        description: description.trim() || null,
        schedule_type: 'daily',
        schedule_days: null,
        start_date: startDate,
        end_date: isUnlimited ? null : endDate,
        is_private: true,
        exercises: validRows.map((row) => ({
          exercise_id: Number(row.exerciseId),
          goal: row.goal,
        })),
      });
      onSuccess();
    } catch (err) {
      setError(parseApiError(err as AxiosError).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-7 py-8">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0"
        onClick={onClose}
        disabled={isSubmitting}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Создание соревнования"
        className="relative flex max-h-[min(74dvh,574px)] w-full max-w-[322px] flex-col rounded-[14px] bg-white px-3 py-6 shadow-modal"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {error && (
            <p className="mb-3 rounded-[6px] bg-red-50 px-2 py-2 text-[12px] font-semibold text-red-500">
              {error}
            </p>
          )}

          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, CHALLENGE_NAME_MAX_LENGTH))}
            maxLength={CHALLENGE_NAME_MAX_LENGTH}
            placeholder="название"
            className="mb-4 h-[30px] w-full rounded-[4px] border border-neutral-muted/60 px-2 text-[13px] text-neutral-text outline-none placeholder:text-neutral-muted focus:border-brand"
            autoFocus
          />

          <DateInput
            id="mobile-start-date"
            label="Дата"
            value={startDate}
            min={todayIso()}
            disabled={isLoading}
            onChange={(value) => {
              const next = value && value < todayIso() ? todayIso() : value;
              setStartDate(next);
              if (endDate && next && endDate < next) setEndDate('');
            }}
          />

          <label className="mt-2 flex items-center gap-2 text-[14px] font-medium text-[#4c4a66]">
            <input
              type="checkbox"
              checked={isUnlimited}
              onChange={(event) => {
                setIsUnlimited(event.target.checked);
                if (event.target.checked) setEndDate('');
              }}
              className="h-[22px] w-[22px] rounded-sm border-neutral-muted text-brand focus:ring-brand/20"
            />
            Сделать бессрочным
          </label>

          {!isUnlimited && (
            <div className="mt-2">
              <DateInput
                id="mobile-end-date"
                label="Дата окончания"
                value={endDate}
                min={startDate}
                disabled={isLoading}
                onChange={setEndDate}
              />
            </div>
          )}

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value.slice(0, CHALLENGE_DESCRIPTION_MAX_LENGTH))
            }
            maxLength={CHALLENGE_DESCRIPTION_MAX_LENGTH}
            placeholder="описание (необязательно)"
            className="mt-4 h-[85px] w-full resize-none rounded-[6px] border border-neutral-muted/60 px-2 py-2 text-[13px] text-neutral-text outline-none placeholder:text-neutral-muted focus:border-brand"
          />

          <section className="mt-3 min-h-[190px] rounded-[6px] border border-neutral-muted/60 p-2">
            <p className="mb-2 text-[12px] text-neutral-muted">упражнения</p>
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, createExerciseRow()])}
              disabled={rows.length >= exercises.length || isLoading}
              className="mb-3 flex h-5 w-full items-center justify-center gap-1 rounded-[4px] bg-brand text-[13px] font-semibold text-white disabled:opacity-50"
            >
              <Plus size={16} />
              Добавить упражнение
            </button>

            {isLoading ? (
              <p className="py-4 text-center text-[12px] font-semibold text-neutral-muted">
                Загрузка...
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.rowId} className="grid grid-cols-[1fr_58px_28px] gap-2">
                    <select
                      value={row.exerciseId}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          exerciseId: event.target.value ? Number(event.target.value) : '',
                        })
                      }
                      className="h-8 min-w-0 rounded-[4px] border border-neutral-border bg-white px-2 text-[12px] outline-none focus:border-brand"
                    >
                      <option value="">выберите</option>
                      {exercises.map((exercise) => (
                        <option
                          key={exercise.id}
                          value={exercise.id}
                          disabled={usedExerciseIds.has(exercise.id) && exercise.id !== row.exerciseId}
                        >
                          {exercise.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={row.goal || ''}
                      onChange={(event) =>
                        updateRow(row.rowId, { goal: Math.max(0, Number(event.target.value)) })
                      }
                      placeholder="цель"
                      className="h-8 rounded-[4px] border border-neutral-border px-2 text-[12px] outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.rowId)}
                      disabled={rows.length === 1}
                      aria-label="Удалить упражнение"
                      className="grid h-8 w-7 place-items-center rounded-[4px] text-neutral-muted disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-5 px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-[38px] rounded-full bg-[#eb6944] text-[14px] font-semibold text-white disabled:opacity-50"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!isFormValid || isSubmitting || isLoading}
            className="h-[38px] rounded-full bg-lime text-[14px] font-semibold text-white disabled:bg-neutral-border disabled:text-neutral-muted"
          >
            {isSubmitting ? 'Создаём...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
