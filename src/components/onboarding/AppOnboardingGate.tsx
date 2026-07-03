import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  isAppOnboardingCompleted,
  setAppOnboardingCompleted,
} from '../../utils/appOnboardingStorage.ts';
import { AppSpotlightTour } from './AppSpotlightTour.tsx';

interface AppOnboardingGateProps {
  children: React.ReactNode;
}

export function AppOnboardingGate({ children }: AppOnboardingGateProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user) {
    return children;
  }

  const showOnboarding = !dismissed && !isAppOnboardingCompleted(user.id);

  const handleComplete = () => {
    setAppOnboardingCompleted(user.id);
    setDismissed(true);
  };

  return (
    <>
      {children}
      {showOnboarding && <AppSpotlightTour onComplete={handleComplete} />}
    </>
  );
}
