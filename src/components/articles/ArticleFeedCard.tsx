import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { CATEGORY_LABELS, type Article } from '../../data/articles.ts';
import { ArticlePoster } from './ArticlePoster.tsx';

interface ArticleFeedCardProps {
  article: Article;
  onClick: () => void;
}

/** Larger card with poster on top, used on the Feed page grid. */
export function ArticleFeedCard({ article, onClick }: ArticleFeedCardProps) {
  const meta = (
    <div className="flex items-center gap-2">
      <Badge variant="orange">{CATEGORY_LABELS[article.category]}</Badge>
      <span className="inline-flex items-center gap-1 text-xs text-neutral-muted">
        <Clock size={12} />
        {article.readMinutes} мин
      </span>
    </div>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col text-left bg-white rounded-3xl shadow-card overflow-hidden transition-all hover:shadow-card-hover h-full"
    >
      {/* Мобильная карточка по макету: текст прямо на обложке, на полупрозрачной подложке */}
      <div className="relative w-full lg:hidden">
        <ArticlePoster article={article} className="w-full aspect-[4/3] sm:aspect-[16/10]" />
        <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/90 backdrop-blur-sm p-4">
          <div className="mb-1.5">{meta}</div>
          <h3 className="text-base font-bold text-neutral-text mb-1 leading-snug">
            {article.title}
          </h3>
          <p className="text-sm text-neutral-secondary leading-relaxed line-clamp-2">
            {article.excerpt}
          </p>
        </div>
      </div>

      {/* Десктопная карточка — без изменений */}
      <div className="hidden lg:flex flex-col flex-1 w-full">
        <ArticlePoster article={article} className="w-full aspect-[16/9]" />

        <div className="flex flex-col flex-1 p-5">
          <div className="mb-2">{meta}</div>

          <h3 className="text-lg font-bold text-neutral-text mb-2 leading-snug">
            {article.title}
          </h3>
          <p className="text-sm text-neutral-secondary leading-relaxed line-clamp-3">
            {article.excerpt}
          </p>
        </div>
      </div>
    </button>
  );
}
