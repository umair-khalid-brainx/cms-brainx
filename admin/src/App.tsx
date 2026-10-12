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
import TypesPage from './pages/TypesPage.tsx'
import { CreateEntryPage, TypeEntriesPage } from './pages/TypeEntriesPage.tsx'
import { ContentTypesProvider } from './lib/ContentTypesContext.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import MenusPage from './pages/MenusPage.tsx'
import TaxonomyPage from './pages/TaxonomyPage.tsx'
import RedirectsPage from './pages/RedirectsPage.tsx'
import TeamPage from './pages/TeamPage.tsx'
import SubmissionsPage from './pages/SubmissionsPage.tsx'
import SubmissionDetailPage from './pages/SubmissionDetailPage.tsx'
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
        <Route
          element={
            <ContentTypesProvider>
              <AdminLayout />
            </ContentTypesProvider>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pages" element={<PagesListPage />} />
          <Route path="/pages/new" element={<CreatePagePage />} />
          <Route path="/content/:prefix" element={<TypeEntriesPage />} />
          <Route path="/content/:prefix/new" element={<CreateEntryPage />} />
          <Route path="/types" element={<TypesPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/menus" element={<MenusPage />} />
          <Route path="/taxonomy" element={<TaxonomyPage />} />
          <Route path="/redirects" element={<RedirectsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="/editor/:slug" element={<EditorPage />} />
      </Route>
    </Routes>
  )
}

export default App
