import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

export interface StreakCelebration {
  from: number;
  to: number;
}

interface StreakCelebrationContextValue {
  triggerCelebration: (from: number, to: number) => void;
  consumeCelebration: () => StreakCelebration | null;
}

const StreakCelebrationContext = createContext<StreakCelebrationContextValue | null>(null);

export function StreakCelebrationProvider({ children }: { children: ReactNode }) {
  const pendingRef = useRef<StreakCelebration | null>(null);

  const triggerCelebration = useCallback((from: number, to: number) => {
    pendingRef.current = { from, to };
  }, []);

  const consumeCelebration = useCallback(() => {
    const value = pendingRef.current;
    pendingRef.current = null;
    return value;
  }, []);

  const value = useMemo(
    () => ({ triggerCelebration, consumeCelebration }),
    [triggerCelebration, consumeCelebration],
  );

  return (
    <StreakCelebrationContext.Provider value={value}>{children}</StreakCelebrationContext.Provider>
  );
}

export function useStreakCelebration(): StreakCelebrationContextValue {
  const context = useContext(StreakCelebrationContext);
  if (!context) {
    throw new Error('useStreakCelebration должен использоваться внутри StreakCelebrationProvider');
  }
  return context;
}
