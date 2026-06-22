import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { Button } from '../components/ui/Button.tsx';

export function ChallengeEditPage() {
  return (
    <PageContainer>
      <Link
        to="/challenges?tab=mine"
        className="inline-flex items-center gap-1 text-sm text-neutral-muted hover:text-brand mb-5 sm:mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Назад к челленджам
      </Link>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text mb-2">Редактирование челленджа</h1>
      <p className="text-neutral-secondary mb-6 sm:mb-8">
        Страница в разработке — будет дополнена в следующем заходе.
      </p>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-card p-6 sm:p-8 max-w-xl">
        <p className="text-sm text-neutral-muted mb-6">
          Здесь появится форма редактирования с предзаполненными данными челленджа.
        </p>
        <Link to="/challenges/create">
          <Button variant="secondary" size="md" fullWidth className="sm:w-auto">
            Пока использовать страницу создания
          </Button>
        </Link>
      </div>
    </PageContainer>
  );
}
