import { useEffect, useState } from 'react';
import { getStoredAvatarUrl } from '../../utils/profileAvatarStorage.ts';

interface ProfileAvatarProps {
  userId: number;
  username: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-24 h-24 sm:w-28 sm:h-28 text-3xl sm:text-4xl',
};

export function ProfileAvatar({ userId, username, size = 'md', className = '' }: ProfileAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState(() => getStoredAvatarUrl(userId));
  const fallback = username.charAt(0).toUpperCase() || '?';

  useEffect(() => {
    setAvatarUrl(getStoredAvatarUrl(userId));
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: number }>).detail;
      if (detail?.userId === userId) {
        setAvatarUrl(getStoredAvatarUrl(userId));
      }
    };
    window.addEventListener('wowfit-avatar-updated', onUpdate);
    return () => window.removeEventListener('wowfit-avatar-updated', onUpdate);
  }, [userId]);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`rounded-full object-cover flex-shrink-0 bg-accent ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-accent flex items-center justify-center font-extrabold text-white flex-shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {fallback}
    </div>
  );
}
