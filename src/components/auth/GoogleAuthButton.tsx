import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext.tsx';
import { GOOGLE_CLIENT_ID } from '../../constants/googleAuth.ts';
import type { ApiError } from '../../types/auth.types.ts';

interface GoogleAuthButtonProps {
  redirectTo?: string;
}

/**
 * Кнопка "Войти через Google" с разделителем «или».
 * Не рендерится, если VITE_GOOGLE_CLIENT_ID не задан.
 */
export function GoogleAuthButton({ redirectTo = '/dashboard' }: GoogleAuthButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  const handleCredential = async (credential: string) => {
    setApiError(null);
    try {
      await loginWithGoogle(credential, redirectTo);
    } catch (error) {
      const apiErr = error as ApiError;
      setApiError(apiErr.message ?? 'Не удалось войти через Google. Попробуйте снова.');
    }
  };

  return (
    <div className="mt-5 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-neutral-border" />
        <span className="text-xs font-medium text-neutral-secondary uppercase">или</span>
        <span className="h-px flex-1 bg-neutral-border" />
      </div>

      {apiError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600"
        >
          {apiError}
        </div>
      )}

      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(response) => {
            if (response.credential) {
              void handleCredential(response.credential);
            }
          }}
          onError={() => setApiError('Не удалось войти через Google. Попробуйте снова.')}
          text="continue_with"
          shape="pill"
        />
      </div>
    </div>
  );
}
