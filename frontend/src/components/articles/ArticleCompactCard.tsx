import type { Article } from '../../data/articles.ts';
import { ArticlePoster } from './ArticlePoster.tsx';

interface ArticleCompactCardProps {
  article: Article;
  onClick: () => void;
}

/** Small horizontal card used in the dashboard "Интересные статьи" column. */
export function ArticleCompactCard({ article, onClick }: ArticleCompactCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-2xl sm:rounded-3xl bg-gradient-to-br ${article.gradient} p-4 sm:p-5 flex items-center gap-4 transition-all hover:shadow-card-hover`}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm sm:text-base font-bold text-neutral-text mb-1 truncate">
          {article.title}
        </h3>
        <p className="text-xs text-neutral-secondary leading-relaxed line-clamp-3">
          {article.excerpt}
        </p>
      </div>
      <ArticlePoster
        article={article}
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl flex-shrink-0 shadow-sm"
      />
    </button>
  );
}
