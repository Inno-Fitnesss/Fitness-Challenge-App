import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, AlertCircle, Dumbbell } from 'lucide-react';
import type { Resolver } from 'react-hook-form';
import { ExerciseCard } from './ExerciseCard.tsx';
import { ExerciseSelectorModal } from './ExerciseSelectorModal.tsx';
import type { Exercise, ChallengeFormValues, ExerciseTemplate } from '../types/challenge.ts';

const CURRENT_YEAR = new Date().getFullYear();
const MAX_DATE_YEAR = CURRENT_YEAR + 10;

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateBounds() {
  return {
    today: formatDateInput(new Date()),
    maxDate: `${MAX_DATE_YEAR}-12-31`,
  };
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [y, m, d] = value.split('-').map(Number);
  if (y < CURRENT_YEAR || y > MAX_DATE_YEAR) return false;

  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

const dateSchema = (label: string) =>
  z
    .string()
    .min(1, `Укажите ${label}`)
    .refine(
      isValidCalendarDate,
      `Введите корректную дату (год от ${CURRENT_YEAR} до ${MAX_DATE_YEAR})`,
    );

const schema = z.object({
  title: z.string().min(3, 'Минимум 3 символа').max(100, 'Максимум 100 символов'),
  description: z.string().max(500, 'Максимум 500 символов').default(''),
  startDate: dateSchema('дату начала'),
  endDate: dateSchema('дату окончания'),
  type: z.enum(['individual', 'team']),
  goal: z.preprocess((v) => Number(v), z.number().min(1, 'Цель должна быть больше 0').max(1_000_000)) as z.ZodType<number>,
  privacy: z.enum(['public', 'private']),
}).refine(
  (data) => !data.startDate || !data.endDate || data.endDate > data.startDate,
  { message: 'Дата окончания должна быть позже даты начала', path: ['endDate'] }
);

interface ChallengeFormProps {
  onValuesChange: (values: Partial<ChallengeFormValues>) => void;
  onExercisesChange: (exercises: Exercise[]) => void;
  onSubmit: (values: ChallengeFormValues, exercises: Exercise[], status: 'draft' | 'published') => void;
  isSubmitting: boolean;
  submitStatus: 'draft' | 'published' | null;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <AlertCircle size={11} />
      {message}
    </p>
  );
}

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-neutral-text mb-1.5">
      {children}
      {required && <span className="text-brand ml-0.5">*</span>}
    </label>
  );
}

const inputClass = (hasError: boolean) =>
  `w-full px-4 py-3 border rounded-2xl text-sm text-neutral-text placeholder:text-neutral-secondary bg-white
  focus:outline-none focus:ring-2 transition-all duration-150
  ${hasError
    ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
    : 'border-neutral-border focus:border-brand focus:ring-brand/10 hover:border-brand/40'
  }`;

const selectClass = (hasError: boolean) =>
  `${inputClass(hasError)} appearance-none cursor-pointer pr-11 bg-no-repeat bg-[length:1.25rem_1.25rem] bg-[right_1rem_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236B7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]`;

export function ChallengeForm({ onValuesChange, onExercisesChange, onSubmit, isSubmitting, submitStatus }: ChallengeFormProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ChallengeFormValues>({
    resolver: zodResolver(schema) as Resolver<ChallengeFormValues>,
    defaultValues: {
      type: 'individual',
      privacy: 'public',
      goal: 1000,
      description: '',
    },
    mode: 'onChange',
  });

  const watchedValues = watch();

  useMemo(() => {
    onValuesChange(watchedValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedValues)]);

  const selectedIds = useMemo(() => exercises.map((e) => e.id), [exercises]);

  const handleSelectExercise = (template: ExerciseTemplate) => {
    setExercises((prev) => {
      const exists = prev.find((e) => e.id === template.id);
      let next: Exercise[];
      if (exists) {
        next = prev.filter((e) => e.id !== template.id);
      } else {
        next = [...prev, { id: template.id, name: template.name, description: template.description, icon: template.icon, reps: template.defaultReps }];
      }
      onExercisesChange(next);
      return next;
    });
  };

  const handleRepsChange = (id: string, reps: number) => {
    setExercises((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, reps } : e));
      onExercisesChange(next);
      return next;
    });
  };

  const handleRemove = (id: string) => {
    setExercises((prev) => {
      const next = prev.filter((e) => e.id !== id);
      onExercisesChange(next);
      return next;
    });
  };

  const descValue = watch('description') ?? '';
  const startDateValue = watch('startDate');
  const { today, maxDate } = getDateBounds();
  const endDateMin =
    startDateValue && isValidCalendarDate(startDateValue) ? startDateValue : today;

  const handleFormSubmit = (status: 'draft' | 'published') => {
    handleSubmit((values) => onSubmit(values, exercises, status))();
  };

  return (
    <>
      <form noValidate className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div className="bg-white rounded-3xl shadow-card border border-neutral-border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold text-neutral-text">Основная информация</h2>

          <div>
            <Label htmlFor="title" required>Название челленджа</Label>
            <input
              id="title"
              type="text"
              placeholder="Например: 30 дней отжиманий"
              {...register('title')}
              className={inputClass(!!errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
            />
            <FieldError message={errors.title?.message} />
          </div>

          <div>
            <Label htmlFor="description">Описание</Label>
            <textarea
              id="description"
              rows={4}
              placeholder="Опишите цели и правила челленджа..."
              {...register('description')}
              className={`${inputClass(!!errors.description)} resize-none`}
            />
            <div className="flex justify-between items-center mt-1">
              <FieldError message={errors.description?.message} />
              <span className={`text-xs ml-auto ${descValue.length > 450 ? 'text-amber-500' : 'text-neutral-secondary'}`}>
                {descValue.length}/500
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate" required>Дата начала</Label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <input
                    id="startDate"
                    type="date"
                    min={today}
                    max={maxDate}
                    value={field.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value || isValidCalendarDate(value)) {
                        field.onChange(value);
                      }
                    }}
                    onBlur={(e) => {
                      field.onBlur();
                      if (e.target.value && !isValidCalendarDate(e.target.value)) {
                        field.onChange('');
                      }
                    }}
                    className={inputClass(!!errors.startDate)}
                  />
                )}
              />
              <FieldError message={errors.startDate?.message} />
            </div>
            <div>
              <Label htmlFor="endDate" required>Дата окончания</Label>
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <input
                    id="endDate"
                    type="date"
                    min={endDateMin}
                    max={maxDate}
                    value={field.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value || isValidCalendarDate(value)) {
                        field.onChange(value);
                      }
                    }}
                    onBlur={(e) => {
                      field.onBlur();
                      if (e.target.value && !isValidCalendarDate(e.target.value)) {
                        field.onChange('');
                      }
                    }}
                    className={inputClass(!!errors.endDate)}
                  />
                )}
              />
              <FieldError message={errors.endDate?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type" required>Тип челленджа</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <select id="type" {...field} className={selectClass(!!errors.type)}>
                    <option value="individual">Индивидуальный</option>
                    <option value="team">Командный</option>
                  </select>
                )}
              />
              <FieldError message={errors.type?.message} />
            </div>

            <div>
              <Label htmlFor="goal" required>Цель (повторений)</Label>
              <input
                id="goal"
                type="number"
                min={1}
                placeholder="Например: 1000"
                {...register('goal')}
                className={inputClass(!!errors.goal)}
              />
              <FieldError message={errors.goal?.message} />
            </div>
          </div>

          <div>
            <Label htmlFor="privacy-group" required>Приватность</Label>
            <div id="privacy-group" role="radiogroup" aria-label="Приватность" className="flex gap-3">
              {(['public', 'private'] as const).map((val) => (
                <Controller
                  key={val}
                  name="privacy"
                  control={control}
                  render={({ field }) => {
                    const checked = field.value === val;
                    return (
                      <label
                        className={`
                          flex items-center gap-2.5 flex-1 px-4 py-3 rounded-2xl border-2 cursor-pointer
                          transition-all duration-150 select-none
                          ${checked
                            ? 'border-brand bg-brand/5'
                            : 'border-neutral-border hover:border-brand/40 hover:bg-brand/3'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name="privacy"
                          value={val}
                          checked={checked}
                          onChange={() => field.onChange(val)}
                          className="sr-only"
                        />
                        <span
                          className={`
                            w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all
                            ${checked ? 'border-brand' : 'border-neutral-border'}
                          `}
                        >
                          {checked && <span className="w-2 h-2 rounded-full bg-brand" />}
                        </span>
                        <span className={`text-sm font-semibold ${checked ? 'text-brand' : 'text-neutral-text'}`}>
                          {val === 'public' ? 'Публичный' : 'Приватный'}
                        </span>
                      </label>
                    );
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-card border border-neutral-border p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand/10 rounded-2xl flex items-center justify-center">
                <Dumbbell size={18} className="text-brand" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-text">Упражнения</h2>
                {exercises.length > 0 && (
                  <p className="text-xs text-neutral-secondary">{exercises.length} добавлено</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-2xl
                hover:bg-brand-hover active:scale-95 transition-all duration-150 shadow-sm hover:shadow-md"
            >
              <Plus size={15} />
              Добавить упражнение
            </button>
          </div>

          {exercises.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-neutral-border rounded-2xl">
              <div className="text-4xl">🏋️</div>
              <div className="text-center">
                <p className="text-sm font-semibold text-neutral-text">Упражнения не добавлены</p>
                <p className="text-xs text-neutral-secondary mt-1">Нажмите кнопку выше, чтобы добавить упражнения</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  onRepsChange={handleRepsChange}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-card border border-neutral-border p-6 md:p-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => handleFormSubmit('draft')}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3.5 border-2 border-brand text-brand text-sm font-semibold rounded-2xl
                hover:bg-brand/5 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && submitStatus === 'draft' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                  Сохраняем...
                </span>
              ) : 'Сохранить как черновик'}
            </button>

            <button
              type="button"
              onClick={() => handleFormSubmit('published')}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3.5 bg-brand text-white text-sm font-semibold rounded-2xl
                hover:bg-brand-hover active:scale-[0.98] transition-all duration-150 shadow-sm hover:shadow-md
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && submitStatus === 'published' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Публикуем...
                </span>
              ) : 'Опубликовать челлендж'}
            </button>
          </div>
        </div>
      </form>

      {showModal && (
        <ExerciseSelectorModal
          selectedIds={selectedIds}
          onSelect={handleSelectExercise}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
