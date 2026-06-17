interface LogoProps {
  className?: string;
}

export function Logo({ className = 'text-lg font-extrabold tracking-tight text-neutral-text' }: LogoProps) {
  return (
    <span className={className}>
      Wow<span className="text-brand">Fit</span>
    </span>
  );
}
