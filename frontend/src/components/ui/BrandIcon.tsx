interface BrandIconProps {
  className?: string;
}

export function BrandIcon({ className = 'w-9 h-9 rounded-xl bg-lime flex-shrink-0' }: BrandIconProps) {
  return <div className={className} aria-hidden="true" />;
}
