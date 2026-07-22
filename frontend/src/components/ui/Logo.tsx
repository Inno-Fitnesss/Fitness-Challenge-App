import { BrandMark } from './BrandMark.tsx';

interface LogoProps {
  className?: string;
}

/** @deprecated Prefer BrandMark / BrandLogoLink. Kept as thin alias. */
export function Logo({ className = 'h-7 w-auto' }: LogoProps) {
  return <BrandMark variant="full" className={className} />;
}
