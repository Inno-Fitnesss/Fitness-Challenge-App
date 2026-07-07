import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../routes/ProtectedRoute.tsx';
import { AdminPage } from '../pages/AdminPage.tsx';
import { ExerciseSessionPage } from '../pages/ExerciseSessionPage.tsx';
import { InviteRedirectPage } from '../pages/InviteRedirectPage.tsx';
import { ProfilePage } from '../pages/ProfilePage.tsx';
import { MobileAuthPage } from './pages/MobileAuthPage.tsx';
import { MobileArticlesPage } from './pages/MobileArticlesPage.tsx';
import { MobileArticleDetailPage } from './pages/MobileArticleDetailPage.tsx';
import { MobileCompetitionsPage } from './pages/MobileCompetitionsPage.tsx';
import { MobileHomePage } from './pages/MobileHomePage.tsx';
import { MobileShell } from './MobileShell.tsx';

export function MobileApp() {
  return (
    <Routes>
      <Route path="/auth" element={<MobileAuthPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/invite/:joinCode" element={<InviteRedirectPage />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/challenges/:challengeId/exercise/:challengeExerciseId"
          element={<ExerciseSessionPage />}
        />
        <Route element={<MobileShell />}>
          <Route path="/dashboard" element={<MobileHomePage />} />
          <Route path="/challenges" element={<MobileCompetitionsPage />} />
          <Route path="/challenges/create" element={<Navigate to="/challenges?create=1" replace />} />
          <Route path="/challenges/:id" element={<MobileCompetitionsPage />} />
          <Route path="/articles" element={<MobileArticlesPage />} />
          <Route path="/articles/:slug" element={<MobileArticleDetailPage />} />
          <Route path="/settings" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
