import { Navigate } from 'react-router-dom';

export function ChallengeCreatePage() {
  return <Navigate to="/challenges?tab=individual&create=1" replace />;
}
