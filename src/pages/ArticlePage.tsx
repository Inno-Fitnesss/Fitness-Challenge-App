import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArticleView } from '../components/articles/ArticleView.tsx';
import { getArticleById } from '../data/articles.ts';

export function ArticlePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const article = articleId ? getArticleById(articleId) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [articleId]);

  if (!article) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-neutral-secondary mb-4">Статья не найдена</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-semibold text-brand hover:text-brand-hover"
        >
          Вернуться назад
        </button>
      </div>
    );
  }

  return <ArticleView article={article} onBack={() => navigate(-1)} />;
}
