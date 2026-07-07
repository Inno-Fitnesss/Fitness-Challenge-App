import { Link } from 'react-router-dom';
import { MOBILE_ARTICLES } from '../mobileData.ts';

export function MobileArticlesPage() {
  return (
    <div className="min-h-dvh px-[26px] pt-12">
      <h1 className="mb-5 text-center text-[22px] font-extrabold text-neutral-text">
        Тут интересно!
      </h1>

      <div className="space-y-5">
        {MOBILE_ARTICLES.map((article) => (
          <Link
            key={article.slug}
            to={`/articles/${article.slug}`}
            className={`grid min-h-[140px] grid-cols-[1fr_112px] gap-3 rounded-[16px] p-5 shadow-card transition-transform active:scale-[0.99] ${article.cardClassName}`}
          >
            <div className="min-w-0">
              <h2 className="mb-2 text-[22px] font-extrabold leading-tight text-neutral-text">
                {article.title}
              </h2>
              <p className="text-[14px] font-extrabold leading-[1.15] text-neutral-text">
                {article.excerpt}
              </p>
            </div>
            <div className="flex items-center justify-end">
              <img
                src={article.imageSrc}
                alt=""
                className="h-28 w-28 rounded-sm object-cover"
                loading="lazy"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
