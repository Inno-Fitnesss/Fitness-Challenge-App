import { useState } from 'react';
import type { Article } from '../../data/articles.ts';

interface ArticlePosterProps {
  article: Article;
  className?: string;
}

/** Renders the article image with a gradient fallback when the asset is missing. */
export function ArticlePoster({ article, className = '' }: ArticlePosterProps) {
  const [failed, setFailed] = useState(false);
  const showImage = article.image && !failed;

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${article.gradient} ${className}`}
      aria-hidden="true"
    >
      {showImage && (
        <img
          src={article.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
