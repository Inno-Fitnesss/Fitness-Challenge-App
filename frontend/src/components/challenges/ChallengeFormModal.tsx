import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { challengeApi, exerciseApi } from '../../api/challengeApi.ts';
import { parseApiError } from '../../utils/parseApiError.ts';
import { isValidIsoDate, todayIso } from '../../utils/dateFormat.ts';
import { DateField } from '../ui/DateField.tsx';
import type { ApiExercise } from '../../types/api.types.ts';
import {
  ChallengeExerciseRow,
  createEmptyExerciseRow,
  isExerciseRowValid,
  type ExerciseRowData,
} from './ChallengeExerciseRow.tsx';
import { SchedulePicker, type ScheduleMode } from './SchedulePicker.tsx';
import { generateId } from '../../utils/generateId.ts';
import { CHALLENGE_NAME_MAX_LENGTH, CHALLENGE_DESCRIPTION_MAX_LENGTH } from '../../constants/challengeLimits.ts';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.ts';
import type { AxiosError } from 'axios';

interface ChallengeFormModalProps {
  mode: 'create' | 'edit';
  challengeId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormSnapshot {
  name: string;
  startDate: string;
  endDate: string;
  isUnlimited: boolean;
  description: string;
  scheduleMode: ScheduleMode;
  scheduleDays: number[];
  rows: Array<{ exerciseId: number | null; goal: number }>;
}

function isFormValid(
  name: string,
  startDate: string,
  endDate: string,
  isUnlimited: boolean,
  description: string,
  rows: ExerciseRowData[],
  exercises: ApiExercise[],
  scheduleMode: ScheduleMode,
  scheduleDays: number[],
  isCreate: boolean,
): boolean {
  if (!name.trim() || name.trim().length > CHALLENGE_NAME_MAX_LENGTH) return false;
  if (description.length > CHALLENGE_DESCRIPTION_MAX_LENGTH) return false;
  if (!isValidIsoDate(startDate)) return false;
  if (isCreate && startDate < todayIso()) return false;
  if (!isUnlimited) {
    if (!isValidIsoDate(endDate)) return false;
    if (endDate < startDate) return false;
  }
  if (scheduleMode === 'weekly' && scheduleDays.length === 0) return false;
  const validRows = rows.filter((row) => isExerciseRowValid(row, exercises));
  if (validRows.length === 0) return false;
  const ids = validRows.map((r) => r.exerciseId);
  return new Set(ids).size === ids.length;
}

function getDefaultFormState() {
  return {
    name: '',
    startDate: todayIso(),
    endDate: '',
    isUnlimited: false,
    description: '',
    scheduleMode: 'daily' as ScheduleMode,
    scheduleDays: [] as number[],
    rows: [createEmptyExerciseRow()],
  };
}

function snapshotFromState(
  name: string,
  startDate: string,
  endDate: string,
  isUnlimited: boolean,
  description: string,
  scheduleMode: ScheduleMode,
  scheduleDays: number[],
  rows: ExerciseRowData[],
): FormSnapshot {
  return {
    name,
    startDate,
    endDate,
    isUnlimited,
    description,
    scheduleMode,
    scheduleDays: [...scheduleDays].sort((a, b) => a - b),
    rows: rows.map((row) => ({ exerciseId: row.exerciseId, goal: row.goal })),
  };
}

function snapshotsEqual(a: FormSnapshot, b: FormSnapshot): boolean {
  if (
    a.name !== b.name ||
    a.startDate !== b.startDate ||
    a.endDate !== b.endDate ||
    a.isUnlimited !== b.isUnlimited ||
    a.description !== b.description ||
    a.scheduleMode !== b.scheduleMode
  ) {
    return false;
  }

  if (a.scheduleDays.length !== b.scheduleDays.length) return false;
  if (a.scheduleDays.some((day, index) => day !== b.scheduleDays[index])) return false;

  if (a.rows.length !== b.rows.length) return false;
  return a.rows.every(
    (row, index) =>
      row.exerciseId === b.rows[index].exerciseId && row.goal === b.rows[index].goal,
  );
}

function hasUnsavedCreateContent(snapshot: FormSnapshot): boolean {
  if (snapshot.name.trim()) return true;
  if (snapshot.description.trim()) return true;
  if (snapshot.isUnlimited) return true;
  if (snapshot.endDate) return true;
  if (snapshot.scheduleMode === 'weekly' && snapshot.scheduleDays.length > 0) return true;
  return snapshot.rows.some((row) => row.exerciseId !== null || row.goal > 0);
}

export function ChallengeFormModal({ mode, challengeId, onClose, onSuccess }: ChallengeFormModalProps) {
  const isEdit = mode === 'edit';
  const initialSnapshotRef = useRef<FormSnapshot | null>(null);

  useBodyScrollLock(true);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [description, setDescription] = useState('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('daily');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [rows, setRows] = useState<ExerciseRowData[]>([createEmptyExerciseRow()]);
  const [exercises, setExercises] = useState<ApiExercise[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const currentSnapshot = useMemo(
    () =>
      snapshotFromState(
        name,
        startDate,
        endDate,
        isUnlimited,
        description,
        scheduleMode,
        scheduleDays,
        rows,
      ),
    [name, startDate, endDate, isUnlimited, description, scheduleMode, scheduleDays, rows],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (isLoading) return false;
    if (isEdit) {
      if (!initialSnapshotRef.current) return false;
      return !snapshotsEqual(currentSnapshot, initialSnapshotRef.current);
    }
    return hasUnsavedCreateContent(currentSnapshot);
  }, [currentSnapshot, isEdit, isLoading]);

  const valid = useMemo(
    () =>
      isFormValid(
        name,
        startDate,
        endDate,
        isUnlimited,
        description,
        rows,
        exercises,
        scheduleMode,
        scheduleDays,
        !isEdit,
      ),
    [name, startDate, endDate, isUnlimited, description, rows, exercises, scheduleMode, scheduleDays, isEdit],
  );

  const usedExerciseIds = useMemo(() => {
    const ids = new Set<number>();
    rows.forEach((r) => {
      if (r.exerciseId !== null) ids.add(r.exerciseId);
    });
    return ids;
  }, [rows]);

  const confirmClose = useCallback(() => {
    setShowDiscardConfirm(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (isSubmitting) return;
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, isSubmitting, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isSubmitting) return;
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return;
      }
      requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSubmitting, requestClose, showDiscardConfirm]);

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
          if (!detail.is_private) {
            setError('Публичный челлендж нельзя редактировать');
            return;
          }

          const loadedName = detail.name.slice(0, CHALLENGE_NAME_MAX_LENGTH);
          const loadedDescription = (detail.description ?? '').slice(0, CHALLENGE_DESCRIPTION_MAX_LENGTH);
          const loadedStartDate = detail.start_date;
          const loadedIsUnlimited = !detail.end_date;
          const loadedEndDate = detail.end_date ?? '';
          const loadedScheduleMode = detail.schedule_type;
          const loadedScheduleDays = detail.schedule_days ?? [];
          const loadedRows =
            detail.exercises.length > 0
              ? detail.exercises.map((ex) => ({
                  rowId: generateId(),
                  exerciseId: ex.exercise_id,
                  goal: ex.goal,
                }))
              : [createEmptyExerciseRow()];

          setName(loadedName);
          setDescription(loadedDescription);
          setStartDate(loadedStartDate);
          setIsUnlimited(loadedIsUnlimited);
          setEndDate(loadedEndDate);
          setScheduleMode(loadedScheduleMode);
          setScheduleDays(loadedScheduleDays);
          setRows(loadedRows);

          initialSnapshotRef.current = snapshotFromState(
            loadedName,
            loadedStartDate,
            loadedEndDate,
            loadedIsUnlimited,
            loadedDescription,
            loadedScheduleMode,
            loadedScheduleDays,
            loadedRows,
          );
        } else {
          const defaults = getDefaultFormState();
          setStartDate(defaults.startDate);
          initialSnapshotRef.current = null;
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

  const handleStartDateChange = (iso: string) => {
    let next = iso;
    if (!isEdit && next && isValidIsoDate(next) && next < todayIso()) {
      next = todayIso();
    }
    setStartDate(next);
    if (!isUnlimited && endDate && next && endDate < next) {
      setEndDate('');
    }
  };

  const handleUnlimitedChange = (checked: boolean) => {
    setIsUnlimited(checked);
    if (checked) setEndDate('');
  };

  const handleSubmit = async () => {
    if (!valid || isSubmitting) return;

    const exercisePayload = rows
      .filter((row) => isExerciseRowValid(row, exercises))
      .map((r) => ({ exercise_id: r.exerciseId!, goal: r.goal }));

    const endDatePayload = isUnlimited ? null : endDate;

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && challengeId != null) {
        await challengeApi.update(challengeId, {
          name: name.trim(),
          description: description.trim() || null,
          schedule_type: scheduleMode,
          schedule_days: scheduleMode === 'weekly' ? scheduleDays : null,
          start_date: startDate,
          end_date: endDatePayload,
          exercises: exercisePayload,
        });
      } else {
        await challengeApi.create({
          name: name.trim(),
          description: description.trim() || null,
          schedule_type: scheduleMode,
          schedule_days: scheduleMode === 'weekly' ? scheduleDays : undefined,
          start_date: startDate,
          end_date: endDatePayload,
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
        onClick={requestClose}
        disabled={isSubmitting}
        className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-2xl hover:bg-brand-hover transition-colors disabled:opacity-50"
      >
        {isEdit ? 'Отменить' : 'Закрыть'}
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
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Редактировать челлендж' : 'Создать челлендж'}
    >
      <button
        type="button"
        aria-label="Закрыть"
        disabled={isSubmitting}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={requestClose}
      />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-start sm:justify-center sm:p-6 pointer-events-none">
        <div
          className="pointer-events-auto relative flex flex-col w-full max-w-full sm:max-w-3xl mx-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-modal animate-fade-in
            max-h-[min(92dvh,100%)] sm:max-h-[calc(100dvh-3rem)] sm:my-8 min-h-0 min-w-0 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/30 rounded-t-3xl sm:rounded-3xl">
            <div
              role="alertdialog"
              aria-labelledby="discard-title"
              aria-describedby="discard-desc"
              className="w-full max-w-sm bg-white rounded-2xl shadow-modal p-5 sm:p-6"
            >
              <h3 id="discard-title" className="text-base font-bold text-neutral-text mb-2">
                Выйти без сохранения?
              </h3>
              <p id="discard-desc" className="text-sm text-neutral-secondary mb-5">
                Вы не сохранили челлендж — введённые данные не будут сохранены.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-neutral-text bg-neutral-card rounded-xl hover:bg-neutral-border/60 transition-colors"
                >
                  Остаться
                </button>
                <button
                  type="button"
                  onClick={confirmClose}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand-hover transition-colors"
                >
                  Выйти
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 modal-safe-x pt-4 sm:pt-6 pb-4 sm:pb-4 border-b border-neutral-border/60 sm:border-0">
          <div className="w-10 h-1 bg-neutral-border rounded-full mx-auto mb-4 sm:hidden" aria-hidden />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-w-0 w-full">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value.slice(0, CHALLENGE_NAME_MAX_LENGTH))
                }
                placeholder="Название"
                disabled={isLoading}
                maxLength={CHALLENGE_NAME_MAX_LENGTH}
                className="w-full min-w-0 max-w-full px-4 py-3 border border-neutral-border rounded-2xl text-sm sm:text-base text-neutral-text placeholder:text-neutral-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-neutral-card break-words"
                autoFocus
              />
              <p className="mt-1 text-xs text-neutral-muted text-right">
                {name.length}/{CHALLENGE_NAME_MAX_LENGTH}
              </p>
            </div>
            <div className="hidden sm:flex gap-3 flex-shrink-0">{actionButtons}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain modal-safe-x py-4 sm:py-2 min-w-0">
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-500 break-words">
              {error}
            </p>
          )}

          {isLoading ? (
            <p className="text-sm text-neutral-muted py-8">Загрузка...</p>
          ) : (
            <div className="space-y-5 sm:space-y-6 pb-2 min-w-0 w-full">
              <section className="min-w-0">
                <h2 className="text-sm font-bold text-neutral-text mb-3">Длительность</h2>
                <div className="space-y-4">
                  <DateField
                    id="start-date"
                    label="Дата начала"
                    value={startDate}
                    onChange={handleStartDateChange}
                    min={isEdit ? undefined : todayIso()}
                    disabled={isLoading}
                    required
                    hint={!isEdit ? 'Не раньше сегодняшнего дня' : undefined}
                  />

                  <label className="flex items-start gap-3 p-4 rounded-2xl border border-neutral-border bg-neutral-card/40 cursor-pointer hover:border-brand/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => handleUnlimitedChange(e.target.checked)}
                      disabled={isLoading}
                      className="mt-0.5 w-5 h-5 rounded-md border-2 border-neutral-border text-brand focus:ring-2 focus:ring-brand/20 cursor-pointer"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-text">
                        Бессрочный челлендж
                      </span>
                      <span className="block text-xs text-neutral-muted mt-0.5">
                        Без даты окончания — завершите вручную, когда захотите
                      </span>
                    </span>
                  </label>

                  {!isUnlimited && (
                    <DateField
                      id="end-date"
                      label="Дата окончания"
                      value={endDate}
                      onChange={setEndDate}
                      min={startDate && isValidIsoDate(startDate) ? startDate : undefined}
                      disabled={isLoading}
                      required
                    />
                  )}
                </div>
              </section>

              <SchedulePicker
                mode={scheduleMode}
                selectedDays={scheduleDays}
                onModeChange={handleScheduleModeChange}
                onDaysChange={setScheduleDays}
              />

              <section className="min-w-0">
                <h2 className="text-sm font-bold text-neutral-text mb-3">Описание</h2>
                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value.slice(0, CHALLENGE_DESCRIPTION_MAX_LENGTH))
                  }
                  maxLength={CHALLENGE_DESCRIPTION_MAX_LENGTH}
                  rows={4}
                  placeholder="Необязательно"
                  className="w-full min-w-0 max-w-full px-4 py-3 border border-neutral-border rounded-2xl text-sm text-neutral-text placeholder:text-neutral-muted resize-none break-words overflow-x-hidden focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
                <p className="mt-1 text-xs text-neutral-muted text-right">
                  {description.length}/{CHALLENGE_DESCRIPTION_MAX_LENGTH}
                </p>
              </section>

              <section className="border border-neutral-border rounded-2xl p-4 sm:p-5 min-w-0 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <span className="text-sm text-neutral-muted">Упражнения</span>
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={rows.length >= exercises.length}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-brand text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-50 w-full sm:w-auto"
                  >
                    <Plus size={14} />
                    Добавить упражнение
                  </button>
                </div>

                <div className="flex flex-col gap-3 min-w-0">
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

        <div className="flex-shrink-0 sm:hidden flex gap-2 modal-safe-x pt-4 border-t border-neutral-border bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
          {actionButtons}
        </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use ChallengeFormModal */
export function CreateChallengeModal(props: Omit<ChallengeFormModalProps, 'mode'>) {
  return <ChallengeFormModal mode="create" {...props} />;
}
