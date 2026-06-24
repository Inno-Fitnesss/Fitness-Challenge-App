import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { ProtectedRoute } from './routes/ProtectedRoute.tsx';
import { AppShell } from './components/layout/AppShell.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { ChallengesPage } from './pages/ChallengesPage.tsx';
import { ChallengeCreatePage } from './pages/ChallengeCreatePage.tsx';
import { ChallengeEditPage } from './pages/ChallengeEditPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { ExerciseSessionPage } from './pages/ExerciseSessionPage.tsx';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />

          <Route element={<ProtectedRoute />}>
            <Route
              path="/challenges/:challengeId/exercise/:challengeExerciseId"
              element={<ExerciseSessionPage />}
            />
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/challenges" element={<ChallengesPage />} />
              <Route path="/challenges/create" element={<ChallengeCreatePage />} />
              <Route path="/challenges/:id/edit" element={<ChallengeEditPage />} />
              <Route path="/challenges/:id" element={<ChallengesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
