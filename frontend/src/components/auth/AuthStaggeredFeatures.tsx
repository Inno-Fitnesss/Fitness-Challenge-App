interface AuthStaggeredFeaturesProps {
  features: string[];
  /** Меняется при смене слайда — перезапускает поочерённое появление строк. */
  animationKey: number;
  className?: string;
}

/** Список преимуществ с поочерённым появлением строк. */
export function AuthStaggeredFeatures({
  features,
  animationKey,
  className = '',
}: AuthStaggeredFeaturesProps) {
  return (
    <ul className={`space-y-3 text-left text-sm sm:text-base text-neutral-text ${className}`}>
      {features.map((text, index) => (
        <li
          key={`${animationKey}-${text}`}
          className="auth-feature-line flex gap-3 leading-snug"
          style={{ animationDelay: `${index * 140}ms` }}
        >
          <span className="text-brand font-bold mt-0.5">•</span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
