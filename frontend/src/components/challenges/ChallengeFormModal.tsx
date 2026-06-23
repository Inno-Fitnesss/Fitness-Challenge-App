import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { challengeApi, exerciseApi } from '../../api/challengeApi.ts';
import { parseApiError } from '../../utils/parseApiError.ts';
import { displayToIso, formatDateInput, isoToDisplay } from '../../utils/dateFormat.ts';
import type { ApiExercise } from '../../types/api.types.ts';
import {
  ChallengeExerciseRow,
  createEmptyExerciseRow,
  isExerciseRowValid,
  type ExerciseRowData,
} from './ChallengeExerciseRow.tsx';
import { SchedulePicker, type ScheduleMode } from './SchedulePicker.tsx';
import type { AxiosError } from 'axios';

interface ChallengeFormModalProps {
  mode: 'create' | 'edit';
  challengeId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

function isFormValid(
  name: string,
  startDate: string,
  endDate: string,
  rows: ExerciseRowData[],
  scheduleMode: ScheduleMode,
  scheduleDays: number[],
): boolean {
  if (!name.trim()) return false;
  const startIso = displayToIso(startDate);
  const endIso = displayToIso(endDate);
  if (!startIso || !endIso) return false;
  if (endIso < startIso) return false;
  if (scheduleMode === 'weekly' && scheduleDays.length === 0) return false;
  const validRows = rows.filter(isExerciseRowValid);
  if (validRows.length === 0) return false;
  const ids = validRows.map((r) => r.exerciseId);
  return new Set(ids).size === ids.length;
}

export function ChallengeFormModal({ mode, challengeId, onClose, onSuccess }: ChallengeFormModalProps) {
  const isEdit = mode === 'edit';
  const overlayRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('daily');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [rows, setRows] = useState<ExerciseRowData[]>([createEmptyExerciseRow()]);
  const [exercises, setExercises] = useState<ApiExercise[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(
    () => isFormValid(name, startDate, endDate, rows, scheduleMode, scheduleDays),
    [name, startDate, endDate, rows, scheduleMode, scheduleDays],
  );

  const usedExerciseIds = useMemo(() => {
    const ids = new Set<number>();
    rows.forEach((r) => {
      if (r.exerciseId !== null) ids.add(r.exerciseId);
    });
    return ids;
  }, [rows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isSubmitting]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await exerciseApi.list();
        if (cancelled) return;
        setExercises(list);

        if (isEdit && challengeId != null) {
          const detail = await challengeApi.getDetail(challengeId);
          if (cancelled) return;

          setName(detail.name);
          setDescription(detail.description ?? '');
          setStartDate(isoToDisplay(detail.start_date));
          setEndDate(detail.end_date ? isoToDisplay(detail.end_date) : '');
          setScheduleMode(detail.schedule_type);
          setScheduleDays(detail.schedule_days ?? []);
          setRows(
            detail.exercises.length > 0
              ? detail.exercises.map((ex) => ({
                  rowId: crypto.randomUUID(),
                  exerciseId: ex.exercise_id,
                  goal: ex.goal,
                }))
              : [createEmptyExerciseRow()],
          );
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = parseApiError(err as AxiosError);
          setError(apiErr.message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, challengeId]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current && !isSubmitting) onClose();
  };

  const updateRow = useCallback((rowId: string, patch: Partial<ExerciseRowData>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.rowId !== rowId)));
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyExerciseRow()]);
  };

  const handleScheduleModeChange = (next: ScheduleMode) => {
    setScheduleMode(next);
    if (next === 'daily') setScheduleDays([]);
  };

  const handleSubmit = async () => {
    if (!valid || isSubmitting) return;

    const startIso = displayToIso(startDate)!;
    const endIso = displayToIso(endDate)!;
    const exercisePayload = rows
      .filter(isExerciseRowValid)
      .map((r) => ({ exercise_id: r.exerciseId!, goal: r.goal }));

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && challengeId != null) {
        await challengeApi.update(challengeId, {
          name: name.trim(),
          description: description.trim() || null,
          schedule_type: scheduleMode,
          schedule_days: scheduleMode === 'weekly' ? scheduleDays : null,
          start_date: startIso,
          end_date: endIso,
          exercises: exercisePayload,
        });
      } else {
        await challengeApi.create({
          name: name.trim(),
          description: description.trim() || null,
          schedule_type: scheduleMode,
          schedule_days: scheduleMode === 'weekly' ? scheduleDays : undefined,
          start_date: startIso,
          end_date: endIso,
          is_private: true,
          exercises: exercisePayload,
        });
      }
      onSuccess();
    } catch (err) {
      const apiErr = parseApiError(err as AxiosError);
      setError(apiErr.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel = isEdit
    ? isSubmitting ? 'Сохраняем...' : 'Сохранить'
    : isSubmitting ? 'Создаём...' : 'Создать';

  const actionButtons = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-2xl hover:bg-brand-hover transition-colors disabled:opacity-50"
      >
        Отменить
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!valid || isSubmitting || isLoading}
        className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 text-sm font-semibold rounded-2xl transition-colors disabled:cursor-not-allowed ${
          valid && !isLoading
            ? 'bg-lime text-neutral-text hover:bg-lime-hover'
            : 'bg-neutral-border text-neutral-secondary'
        }`}
      >
        {submitLabel}
      </button>
    </>
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:p-6 bg-black/40 backdrop-blur-[2px] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Редактировать челлендж' : 'Создать челлендж'}
      onClick={handleOverlayClick}
    >
      <div
        className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-modal animate-slide-up sm:animate-scale-in
          max-h-[92dvh] sm:max-h-[calc(100dvh-3rem)] flex flex-col sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-6 sm:pb-4 border-b border-neutral-border/60 sm:border-0">
          <div className="w-10 h-1 bg-neutral-border rounded-full mx-auto mb-4 sm:hidden" aria-hidden />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название"
              disabled={isLoading}
              className="flex-1 min-w-0 px-4 py-3 border border-neutral-border rounded-2xl text-sm sm:text-base text-neutral-text placeholder:text-neutral-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-neutral-card"
              autoFocus
            />
            <div className="hidden sm:flex gap-3 flex-shrink-0">{actionButtons}</div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-2">
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-500">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-neutral-muted py-8">Загрузка...</p>
          ) : (
            <div className="space-y-6 sm:space-y-8 pb-2">
              <section>
                <h2 className="text-sm font-bold text-neutral-text mb-3">Длительность</h2>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start-date" className="block text-xs text-neutral-secondary mb-1.5">
                      Дата начала
                    </label>
                    <input
                      id="start-date"
                      type="text"
                      inputMode="numeric"
                      value={startDate}
                      onChange={(e) => setStartDate(formatDateInput(e.target.value))}
                      placeholder="дд.мм.гггг"
                      maxLength={10}
                      className="w-full px-4 py-2.5 border border-neutral-border rounded-xl text-sm text-neutral-text placeholder:text-neutral-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                    />
                  </div>
                  <div>
                    <label htmlFor="end-date" className="block text-xs text-neutral-secondary mb-1.5">
                      Дата окончания
                    </label>
                    <input
                      id="end-date"
                      type="text"
                      inputMode="numeric"
                      value={endDate}
                      onChange={(e) => setEndDate(formatDateInput(e.target.value))}
                      placeholder="дд.мм.гггг"
                      maxLength={10}
                      className="w-full px-4 py-2.5 border border-neutral-border rounded-xl text-sm text-neutral-text placeholder:text-neutral-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                    />
                  </div>
                </div>
              </section>

              <SchedulePicker
                mode={scheduleMode}
                selectedDays={scheduleDays}
                onModeChange={handleScheduleModeChange}
                onDaysChange={setScheduleDays}
              />

              <section>
                <h2 className="text-sm font-bold text-neutral-text mb-3">Описание</h2>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-neutral-border rounded-2xl text-sm text-neutral-text placeholder:text-neutral-muted resize-none focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </section>

              <section className="border border-neutral-border rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 mb-4">
                  <span className="text-sm text-neutral-muted">Упражнения</span>
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={rows.length >= exercises.length}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-brand text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-50 w-full xs:w-auto"
                  >
                    <Plus size={14} />
                    Добавить упражнение
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                  {rows.map((row) => (
                    <ChallengeExerciseRow
                      key={row.rowId}
                      row={row}
                      exercises={exercises}
                      usedExerciseIds={usedExerciseIds}
                      onChange={updateRow}
                      onRemove={removeRow}
                      canRemove={rows.length > 1}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Mobile sticky footer */}
        <div className="flex-shrink-0 sm:hidden flex gap-2 p-4 border-t border-neutral-border bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
          {actionButtons}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use ChallengeFormModal */
export function CreateChallengeModal(props: Omit<ChallengeFormModalProps, 'mode'>) {
  return <ChallengeFormModal mode="create" {...props} />;
}
