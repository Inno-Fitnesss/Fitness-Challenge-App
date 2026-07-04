import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Short-lived "copied" flag for copy-to-clipboard buttons.
 * Call `markCopied()` after a copy action to flip `copied` to true for `durationMs`.
 */
export function useCopyFeedback(durationMs = 3000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const markCopied = useCallback(() => {
    setCopied(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), durationMs);
  }, [durationMs]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { copied, markCopied };
}
