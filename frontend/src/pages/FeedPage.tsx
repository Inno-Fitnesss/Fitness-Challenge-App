import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { ArticleFeedCard } from '../components/articles/ArticleFeedCard.tsx';
import { ALL_ARTICLES } from '../data/articles.ts';

export function FeedPage() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text">Лента</h1>
        <p className="text-sm text-neutral-muted mt-1">
          Полезные материалы от WowFit о тренировках и здоровом образе жизни
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
        {ALL_ARTICLES.map((article) => (
          <ArticleFeedCard
            key={article.id}
            article={article}
            onClick={() => navigate(`/articles/${article.id}`)}
          />
        ))}
      </div>
    </PageContainer>
  );
}
