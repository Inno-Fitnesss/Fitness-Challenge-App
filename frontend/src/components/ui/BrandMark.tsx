import { useState } from 'react';
import { BRAND_LOGO_FULL_SRC } from '../../constants/brandAssets.ts';

interface BrandMarkProps {
  className?: string;
  variant?: 'full' | 'compact';
  imageSrc?: string;
  onError?: () => void;
}

function TextBrandMark({ className = '' }: { className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 220 48"
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] max-w-none h-10 pointer-events-none"
      >
        <path
          d="M4 28 C 28 8, 52 40, 76 24 S 124 8, 148 26 S 188 38, 216 22"
          fill="none"
          stroke="#A3E635"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span className="relative z-10 text-3xl sm:text-4xl font-extrabold tracking-[0.18em] text-neutral-text">
        WOWFIT
      </span>
    </div>
  );
}

export function BrandMark({
  className = '',
  variant = 'full',
  imageSrc = BRAND_LOGO_FULL_SRC,
  onError,
}: BrandMarkProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageFailed && imageSrc) {
    return (
      <img
        src={imageSrc}
        alt="WOWFIT"
        className={`object-contain rounded-md ${variant === 'compact' ? 'h-9 w-auto' : 'h-10 sm:h-12 w-auto'} ${className}`}
        onError={() => {
          setImageFailed(true);
          onError?.();
        }}
      />
    );
  }

  return <TextBrandMark className={className} />;
}
