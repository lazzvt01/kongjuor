import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/hooks/useAuth'
import { SplashScreen } from '@/pages/auth/Splash'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { session, loading } = useAuth()

  if (loading) return <SplashScreen />
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}
