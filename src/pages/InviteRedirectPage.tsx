import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

export function InviteRedirectPage() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const { isAuthenticated, isLoading } = useAuth();
  const code = joinCode?.trim().toUpperCase() ?? '';

  if (!code) {
    return <Navigate to="/challenges" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-card">
        <div
          className="w-10 h-10 border-3 border-brand/30 border-t-brand rounded-full animate-spin"
          role="status"
          aria-label="Загрузка"
        />
      </div>
    );
  }

  const challengesInvitePath = `/challenges?invite=${encodeURIComponent(code)}`;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(challengesInvitePath)}&tab=signup`}
        replace
      />
    );
  }

  return <Navigate to={challengesInvitePath} replace />;
}
