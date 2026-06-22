import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { ChallengeForm } from '../components/ChallengeForm';
import { ChallengePreview } from '../components/ChallengePreview';
import type { ChallengeFormValues, Exercise } from '../types/challenge';

export function ChallengeCreatePage() {
  const [formValues, setFormValues] = useState<Partial<ChallengeFormValues>>({
    type: 'individual',
    privacy: 'public',
  });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'published' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (values: ChallengeFormValues, exs: Exercise[], status: 'draft' | 'published') => {
    setIsSubmitting(true);
    setSubmitStatus(status);
    try {
      await new Promise<void>((res) => setTimeout(res, 1200));
      console.log('Challenge created:', { ...values, exercises: exs, status });
      setToast({
        message: status === 'published' ? 'Челлендж опубликован!' : 'Черновик сохранён',
        type: 'success',
      });
    } catch {
      setToast({ message: 'Что-то пошло не так. Попробуйте ещё раз.', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setSubmitStatus(null);
      setTimeout(() => setToast(null), 3500);
    }
  };

  return (
    <PageContainer>
      <Link
        to="/challenges?tab=mine"
        className="inline-flex items-center gap-1 text-sm text-neutral-muted hover:text-brand mb-5 sm:mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Назад к челленджам
      </Link>

      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text mb-2">Создать челлендж</h1>
        <p className="text-sm sm:text-base text-neutral-secondary">
          Мотивируйте участников поддерживать спортивную активность между тренировками.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        <div className="flex-1 min-w-0 w-full">
          <ChallengeForm
            onValuesChange={setFormValues}
            onExercisesChange={setExercises}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitStatus={submitStatus}
          />
        </div>

        <div className="hidden lg:block w-80 flex-shrink-0">
          <ChallengePreview data={{ ...formValues }} exercises={exercises} />
        </div>

        <div className="lg:hidden w-full">
          <h2 className="text-lg font-bold text-neutral-text mb-4">Предпросмотр</h2>
          <ChallengePreview data={{ ...formValues }} exercises={exercises} />
        </div>
      </div>

      {toast && (
        <div
          role="alert"
          className={`
            fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-modal
            text-sm font-semibold animate-slide-up
            ${toast.type === 'success' ? 'bg-lime-light text-lime-hover' : 'bg-red-50 text-red-700 border border-red-200'}
          `}
        >
          {toast.type === 'success' ? '✅' : '❌'}
          {toast.message}
        </div>
      )}
    </PageContainer>
  );
}
