import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  isAppOnboardingCompleted,
  setAppOnboardingCompleted,
} from '../../utils/appOnboardingStorage.ts';
import { AppSpotlightTour } from './AppSpotlightTour.tsx';

interface AppOnboardingGateProps {
  children: React.ReactNode;
}

/** Account UI-flag key: onboarding is tied to the account, not the device. */
const APP_ONBOARDING_FLAG = 'app_onboarding_completed';

export function AppOnboardingGate({ children }: AppOnboardingGateProps) {
  const { user, setUiFlag } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const accountCompleted = Boolean(user?.uiFlags?.[APP_ONBOARDING_FLAG]);

  // One-time migration: users who finished onboarding before it became
  // account-scoped have only a per-device localStorage marker. Lift it up to
  // the account so it stops re-appearing on their other devices.
  useEffect(() => {
    if (!user || accountCompleted) return;
    if (isAppOnboardingCompleted(user.id)) {
      void setUiFlag(APP_ONBOARDING_FLAG, true);
    }
  }, [user, accountCompleted, setUiFlag]);

  if (!user) {
    return children;
  }

  const showOnboarding =
    !dismissed && !accountCompleted && !isAppOnboardingCompleted(user.id);

  const handleComplete = () => {
    setAppOnboardingCompleted(user.id);
    void setUiFlag(APP_ONBOARDING_FLAG, true);
    setDismissed(true);
  };

  return (
    <>
      {children}
      {showOnboarding && <AppSpotlightTour onComplete={handleComplete} />}
    </>
  );
}
