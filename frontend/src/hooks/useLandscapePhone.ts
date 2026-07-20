import { useEffect, useState } from 'react';

/**
 * Ландшафт на телефоне: тач-устройство (pointer: coarse) с короткой стороной
 * экрана меньше ~620px. Десктопные мониторы (pointer: fine, большая высота)
 * и планшеты в ландшафте (высота > 620px) под условие не попадают.
 * Ориентация определяется по физическим размерам экрана (window.screen),
 * а не viewport — так резиновая адресная строка Safari на iPhone 16 Pro
 * не сбивает детект.
 */
const MAX_SHORT_SIDE_PX = 620;

function isCoarsePointer(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

function isScreenLandscape(): boolean {
  if (typeof window === 'undefined' || !window.screen) return false;

  const orientationType = window.screen.orientation?.type;
  if (orientationType) {
    return orientationType.startsWith('landscape');
  }

  // Фолбэк для браузеров без Screen Orientation API: сравниваем реальные
  // размеры экрана (не viewport), которые не меняются при открытии клавиатуры.
  return window.screen.width > window.screen.height;
}

function matchesLandscapePhone(): boolean {
  if (typeof window === 'undefined' || !window.screen) return false;
  if (!isCoarsePointer()) return false;
  if (!isScreenLandscape()) return false;

  const shortSide = Math.min(window.screen.width, window.screen.height);
  return shortSide <= MAX_SHORT_SIDE_PX;
}

/** Реактивно отслеживает, повёрнут ли телефон (не планшет/десктоп) в ландшафт. */
export function useLandscapePhone(): boolean {
  const [isLandscapePhone, setIsLandscapePhone] = useState(matchesLandscapePhone);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const recompute = () => setIsLandscapePhone(matchesLandscapePhone());
    recompute();
    const screenOrientation = window.screen?.orientation;
    if (screenOrientation && typeof screenOrientation.addEventListener === 'function') {
      screenOrientation.addEventListener('change', recompute);
      return () => screenOrientation.removeEventListener('change', recompute);
    }

    // Фолбэк для браузеров без Screen Orientation API.
    window.addEventListener('orientationchange', recompute);
    return () => window.removeEventListener('orientationchange', recompute);
  }, []);

  return isLandscapePhone;
}
