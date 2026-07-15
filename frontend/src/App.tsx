import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { StreakCelebrationProvider } from './context/StreakCelebrationContext.tsx';
import { ProtectedRoute } from './routes/ProtectedRoute.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { OrientationLockOverlay } from './components/layout/OrientationLockOverlay.tsx';
import { OfflineBanner } from './components/ui/OfflineBanner.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { FeedPage } from './pages/FeedPage.tsx';
import { ArticlePage } from './pages/ArticlePage.tsx';
import { ChallengesPage } from './pages/ChallengesPage.tsx';
import { ChallengeCreatePage } from './pages/ChallengeCreatePage.tsx';
import { ChallengeEditPage } from './pages/ChallengeEditPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { InviteRedirectPage } from './pages/InviteRedirectPage.tsx';
import { ExerciseSessionPage } from './pages/ExerciseSessionPage.tsx';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StreakCelebrationProvider>
          <OrientationLockOverlay />
          <OfflineBanner />
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/invite/:joinCode" element={<InviteRedirectPage />} />

            <Route element={<ProtectedRoute />}>
              <Route
                path="/challenges/:challengeId/exercise/:challengeExerciseId"
                element={<ExerciseSessionPage />}
              />
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/articles/:articleId" element={<ArticlePage />} />
                <Route path="/challenges" element={<ChallengesPage />} />
                <Route path="/challenges/create" element={<ChallengeCreatePage />} />
                <Route path="/challenges/:id/edit" element={<ChallengeEditPage />} />
                <Route path="/challenges/:id" element={<ChallengesPage />} />
                <Route path="/settings" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </StreakCelebrationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
