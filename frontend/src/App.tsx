import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { RequireAuth } from './components/auth/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DocsClientLibraryPage } from './pages/DocsClientLibraryPage'
import { DocsClientsPage } from './pages/DocsClientsPage'
import { DocsDocumentPage } from './pages/DocsDocumentPage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { TicketsClientsPage } from './pages/TicketsClientsPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/tickets" element={<Navigate to="/tickets/clients" replace />} />
            <Route path="/tickets/clients" element={<TicketsClientsPage />} />
            <Route path="/tickets/clients/:clientId" element={<ClientDetailPage />} />
            <Route path="/schedule" element={<PlaceholderPage title="Schedule" />} />
            <Route path="/agents" element={<PlaceholderPage title="Agents" />} />
            <Route path="/reminders" element={<PlaceholderPage title="Reminders" />} />
            <Route path="/docs" element={<DocsClientsPage />} />
            <Route path="/docs/clients/:clientId" element={<DocsClientLibraryPage />} />
            <Route path="/docs/:docId" element={<DocsDocumentPage />} />
            <Route path="/settings/profile" element={<PlaceholderPage title="Settings — Profile" />} />
          </Route>
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}
