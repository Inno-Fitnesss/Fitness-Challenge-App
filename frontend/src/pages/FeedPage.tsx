import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { ArticleFeedCard } from '../components/articles/ArticleFeedCard.tsx';
import {
  ALL_ARTICLES,
  CATEGORY_LABELS,
  type ArticleCategory,
} from '../data/articles.ts';

type FilterValue = ArticleCategory | 'all';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'exercise', label: CATEGORY_LABELS.exercise },
  { value: 'guide', label: CATEGORY_LABELS.guide },
  { value: 'nutrition', label: CATEGORY_LABELS.nutrition },
  { value: 'recovery', label: CATEGORY_LABELS.recovery },
  { value: 'motivation', label: CATEGORY_LABELS.motivation },
];

export function FeedPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');

  const articles = useMemo(() => {
    if (activeFilter === 'all') return ALL_ARTICLES;
    return ALL_ARTICLES.filter((article) => article.category === activeFilter);
  }, [activeFilter]);

  return (
    <PageContainer>
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text">Лента</h1>
        <p className="text-sm text-neutral-muted mt-1">
          Статьи о тренировках, питании и восстановлении
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                active
                  ? 'bg-brand text-white'
                  : 'bg-white text-neutral-secondary hover:text-neutral-text border border-neutral-border'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {articles.length === 0 ? (
        <p className="text-neutral-muted text-sm py-8">В этой категории пока нет статей</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {articles.map((article) => (
            <ArticleFeedCard
              key={article.id}
              article={article}
              onClick={() => navigate(`/articles/${article.id}`)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
