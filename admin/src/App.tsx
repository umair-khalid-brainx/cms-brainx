import { Navigate, Route, Routes, useLocation } from 'react-router'
import AdminLayout from './layouts/AdminLayout.tsx'
import RequireAuth from './lib/RequireAuth.tsx'
import SiteScope from './lib/SiteScope.tsx'
import { Navigate as SiteNavigate } from './lib/siteRouter.tsx'
import AccountPage from './pages/AccountPage.tsx'
import AllSitesPage from './pages/AllSitesPage.tsx'
import { preferredSiteId } from './lib/activeSite.ts'
import { getSession } from './lib/auth.ts'
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
import RequireWrite from './lib/RequireWrite.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import MenusPage from './pages/MenusPage.tsx'
import TaxonomyPage from './pages/TaxonomyPage.tsx'
import RedirectsPage from './pages/RedirectsPage.tsx'
import TeamPage from './pages/TeamPage.tsx'
import SubmissionsPage from './pages/SubmissionsPage.tsx'
import SubmissionDetailPage from './pages/SubmissionDetailPage.tsx'
import EditorPage from './pages/EditorPage.tsx'
import ComparePage from './pages/ComparePage.tsx'
import ReviewPage from './pages/ReviewPage.tsx'

// `/` and the old site-less addresses (`/pages`, `/editor/home`, from before MSI-03): into the site the person was
// last in, with the same path inside it. A bookmark made before multi-site accounts keeps working.
function IntoPreferredSite({ keepPath }: { keepPath: boolean }) {
  const location = useLocation()
  const siteId = preferredSiteId()
  if (!getSession()) return <Navigate to="/login" replace />
  if (!siteId) return <Navigate to="/sites" replace />
  const rest = keepPath ? location.pathname + location.search + location.hash : '/dashboard'
  return <Navigate to={`/sites/${siteId}${rest}`} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<IntoPreferredSite keepPath={false} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lost-password" element={<LostPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

      <Route element={<RequireAuth />}>
        <Route path="/sites" element={<AllSitesPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/sites/:siteId" element={<SiteScope />}>
        <Route
          element={
            <ContentTypesProvider>
              <AdminLayout />
            </ContentTypesProvider>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pages" element={<PagesListPage />} />
          <Route path="pages/new" element={<RequireWrite><CreatePagePage /></RequireWrite>} />
          <Route path="content/:prefix" element={<TypeEntriesPage />} />
          <Route path="content/:prefix/new" element={<RequireWrite><CreateEntryPage /></RequireWrite>} />
          <Route path="types" element={<TypesPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="submissions/:id" element={<SubmissionDetailPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="menus" element={<MenusPage />} />
          <Route path="taxonomy" element={<TaxonomyPage />} />
          <Route path="redirects" element={<RedirectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="editor/:slug" element={<EditorPage />} />
        <Route path="editor/:slug/compare" element={<ComparePage />} />
        <Route index element={<SiteNavigate to="/dashboard" replace />} />
        <Route path="*" element={<SiteNavigate to="/dashboard" replace />} />
        </Route>
        <Route path="*" element={<IntoPreferredSite keepPath />} />
      </Route>
    </Routes>
  )
}

export default App
