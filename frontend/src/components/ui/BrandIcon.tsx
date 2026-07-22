import { useState } from 'react';
import { BRAND_LOGO_ICON_SRC } from '../../constants/brandAssets.ts';

interface BrandIconProps {
  className?: string;
}

export function BrandIcon({
  className = 'w-9 h-9 rounded-xl bg-black flex-shrink-0',
}: BrandIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={className} aria-hidden="true" />;
  }

  return (
    <img
      src={BRAND_LOGO_ICON_SRC}
      alt=""
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
