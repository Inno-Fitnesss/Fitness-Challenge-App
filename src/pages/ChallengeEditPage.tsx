import { Navigate, useParams } from 'react-router-dom';

export function ChallengeEditPage() {
  const { id } = useParams<{ id: string }>();
  const challengeId = id && !Number.isNaN(Number(id)) ? id : null;

  if (!challengeId) {
    return <Navigate to="/challenges?tab=individual" replace />;
  }

  return <Navigate to={`/challenges?tab=individual&edit=${challengeId}`} replace />;
}
