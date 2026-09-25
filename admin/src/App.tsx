import { Navigate, Route, Routes } from 'react-router'
import LoginPage from './pages/LoginPage.tsx'
import LostPasswordPage from './pages/LostPasswordPage.tsx'
import ResetPasswordPage from './pages/ResetPasswordPage.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lost-password" element={<LostPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Routes>
  )
}

export default App
