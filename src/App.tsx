import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ConfigNotice } from '@/pages/ConfigNotice'
import { Login } from '@/pages/Login'
import { CommandCenter } from '@/pages/CommandCenter'
import { WorkRequests } from '@/pages/WorkRequests'
import { NewRequest } from '@/pages/NewRequest'
import { RequestDetail } from '@/pages/RequestDetail'
import { AllocationWorkspace } from '@/pages/AllocationWorkspace'
import { Resources } from '@/pages/Resources'
import { ResourceProfile } from '@/pages/ResourceProfile'
import { Portfolio } from '@/pages/Portfolio'
import { Copilot } from '@/pages/Copilot'
import { Notifications } from '@/pages/Notifications'
import { AuditLog } from '@/pages/AuditLog'
import { Settings } from '@/pages/Settings'
import { SetupWizard } from '@/pages/SetupWizard'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

function App() {
  if (!isSupabaseConfigured) return <ConfigNotice />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
        <Route
          path="/requests"
          element={
            <ProtectedRoute roles={['admin', 'resource_manager', 'executive_viewer']}>
              <WorkRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/new"
          element={
            <ProtectedRoute roles={['admin', 'resource_manager']}>
              <NewRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/:id"
          element={
            <ProtectedRoute roles={['admin', 'resource_manager', 'executive_viewer']}>
              <RequestDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/allocation/:requestId?"
          element={
            <ProtectedRoute roles={['admin', 'resource_manager']}>
              <AllocationWorkspace />
            </ProtectedRoute>
          }
        />
        <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
        <Route path="/resources/:id" element={<ProtectedRoute><ResourceProfile /></ProtectedRoute>} />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute roles={['admin', 'resource_manager', 'executive_viewer']}>
              <Portfolio />
            </ProtectedRoute>
          }
        />
        <Route path="/copilot" element={<ProtectedRoute><Copilot /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute roles={['admin', 'resource_manager']}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        <Route path="/setup" element={<ProtectedRoute roles={['admin']}><SetupWizard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
