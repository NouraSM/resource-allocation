import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types/database'
import { LoadingState } from '@/components/ui/states'

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <LoadingState />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <LoadingState />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return <>{children}</>
}
