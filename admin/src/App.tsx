import { Navigate, Route, Routes } from 'react-router'
import AdminLayout from './layouts/AdminLayout.tsx'
import RequireAuth from './lib/RequireAuth.tsx'
import LoginPage from './pages/LoginPage.tsx'
import LostPasswordPage from './pages/LostPasswordPage.tsx'
import ResetPasswordPage from './pages/ResetPasswordPage.tsx'
import AcceptInvitePage from './pages/AcceptInvitePage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import PagesListPage from './pages/PagesListPage.tsx'
import CreatePagePage from './pages/CreatePagePage.tsx'
import MediaPage from './pages/MediaPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import TeamPage from './pages/TeamPage.tsx'
import EditorPage from './pages/EditorPage.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lost-password" element={<LostPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pages" element={<PagesListPage />} />
          <Route path="/pages/new" element={<CreatePagePage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="/editor/:slug" element={<EditorPage />} />
      </Route>
    </Routes>
  )
}

export default App
