import { Link } from 'react-router-dom';
import { BrandIcon } from './BrandIcon.tsx';
import { Logo } from './Logo.tsx';

interface BrandLogoLinkProps {
  showText?: boolean;
  iconClassName?: string;
  logoClassName?: string;
  className?: string;
}

export function BrandLogoLink({
  showText = true,
  iconClassName,
  logoClassName,
  className = 'inline-flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity',
}: BrandLogoLinkProps) {
  return (
    <Link to="/dashboard" className={className} aria-label="WowFit — на главную">
      <BrandIcon className={iconClassName} />
      {showText && <Logo className={logoClassName} />}
    </Link>
  );
}
