import { useEffect, useRef } from 'react';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import fireAnimation from '../../assets/animations/streak-fire.json';

// Последний кадр анимации — состояние покоя оставляем именно на нём, чтобы
// проигрывание естественно "останавливалось", а не перематывалось назад
// (перемотка назад после конца выглядела как обрыв/сброс).
const LAST_FRAME = Math.max(0, fireAnimation.op - 1);

interface StreakFlameProps {
  isActive: boolean;
  isPlaying: boolean;
  onPlayComplete?: () => void;
  className?: string;
}

export function StreakFlame({ isActive, isPlaying, onPlayComplete, className = '' }: StreakFlameProps) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    if (isPlaying) {
      lottieRef.current?.goToAndPlay(0, true);
    } else {
      lottieRef.current?.goToAndStop(LAST_FRAME, true);
    }
  }, [isPlaying]);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={fireAnimation}
      loop={false}
      autoplay={false}
      onComplete={onPlayComplete}
      className={className}
      style={{ filter: isActive ? undefined : 'grayscale(1) opacity(0.55)' }}
    />
  );
}
