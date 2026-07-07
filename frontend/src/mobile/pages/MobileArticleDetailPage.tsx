import { ArrowLeft } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { findMobileArticle } from '../mobileData.ts';

export function MobileArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const article = findMobileArticle(slug);

  if (!article) {
    return <Navigate to="/articles" replace />;
  }

  return (
    <article className="min-h-dvh px-6 pt-12">
      <header className="relative mb-5 flex min-h-[42px] items-center justify-center">
        <button
          type="button"
          onClick={() => navigate('/articles')}
          aria-label="Назад к статьям"
          className="absolute left-0 rounded-full p-1 text-neutral-text"
        >
          <ArrowLeft size={25} strokeWidth={2.6} />
        </button>
        <h1 className="px-12 text-center text-[30px] font-extrabold leading-none text-neutral-text">
          {article.title}
        </h1>
      </header>

      <div className="space-y-4 text-[16px] font-extrabold leading-[1.18] text-neutral-text">
        {article.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
