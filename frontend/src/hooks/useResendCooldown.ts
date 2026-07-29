import { useCallback, useEffect, useRef, useState } from 'react';

/** Совпадает с RESEND_COOLDOWN_SECONDS на бэкенде (userService.py). */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Обратный отсчёт для кнопок «Отправить код ещё раз».
 *
 * Бэкенд ограничивает повторную отправку кодов (429 с Retry-After), а этот
 * хук даёт то же ограничение на UI: после отправки кода блокируем кнопку на
 * `seconds` и показываем, сколько осталось. Отсчёт ведём от абсолютного
 * дедлайна (не от counter'а), поэтому он не «плывёт», если вкладку усыпили.
 */
export function useResendCooldown(seconds: number = RESEND_COOLDOWN_SECONDS) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setRunning(false);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback(
    (sec: number = seconds) => {
      deadlineRef.current = Date.now() + sec * 1000;
      setSecondsLeft(sec);
      setRunning(true);
    },
    [seconds],
  );

  return { secondsLeft, isCoolingDown: secondsLeft > 0, start };
}
