import { Link } from 'react-router-dom';
import { BrandIcon } from './BrandIcon.tsx';
import { BrandMark } from './BrandMark.tsx';

interface BrandLogoLinkProps {
  showText?: boolean;
  showIcon?: boolean;
  iconClassName?: string;
  logoClassName?: string;
  className?: string;
}

export function BrandLogoLink({
  showText = true,
  showIcon = true,
  iconClassName,
  logoClassName,
  className = 'inline-flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity',
}: BrandLogoLinkProps) {
  return (
    <Link to="/dashboard" className={className} aria-label="WOWFIT — на главную">
      {showIcon && <BrandIcon className={iconClassName} />}
      {showText && <BrandMark variant="full" className={logoClassName ?? 'h-7 sm:h-8 w-auto'} />}
    </Link>
  );
}
