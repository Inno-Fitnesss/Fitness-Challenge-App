import { Clock, ArrowLeft } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { CATEGORY_LABELS, type Article } from '../../data/articles.ts';
import { ArticlePoster } from './ArticlePoster.tsx';

interface ArticleViewProps {
  article: Article;
  onBack: () => void;
}

export function ArticleView({ article, onBack }: ArticleViewProps) {
  return (
    <div className="min-h-[calc(100dvh-72px)] lg:min-h-screen flex flex-col">
      <div className="relative w-full">
        <ArticlePoster article={article} className="w-full aspect-[16/9] sm:aspect-[21/9] max-h-[50vh]" />

        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="absolute top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/90 text-neutral-text text-sm font-semibold shadow-card hover:bg-white transition-colors"
        >
          <ArrowLeft size={18} />
          Назад
        </button>
      </div>

      <div className="flex-1 bg-white px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
        <div className="max-w-3xl mx-auto min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="orange">{CATEGORY_LABELS[article.category]}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-neutral-muted">
              <Clock size={12} />
              {article.readMinutes} мин чтения
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-neutral-text mb-6 leading-tight">
            {article.title}
          </h1>

          <div className="space-y-5">
            {article.content.map((paragraph, index) => (
              <p key={index} className="text-base sm:text-lg text-neutral-secondary leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
