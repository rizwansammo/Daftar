import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth } from './components/auth/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { AgentsPage } from './pages/AgentsPage'
import { BoilerplatesPage } from './pages/BoilerplatesPage'
import { CalendarPage } from './pages/CalendarPage'
import { ClientDetailPage } from './pages/ClientDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ArchivedClientsPage } from './pages/ArchivedClientsPage'
import { DocsClientLibraryPage } from './pages/DocsClientLibraryPage'
import { DocsClientsPage } from './pages/DocsClientsPage'
import { DocsDocumentPage } from './pages/DocsDocumentPage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProfilePage } from './pages/ProfilePage'
import { RemindersPage } from './pages/RemindersPage'
import { TicketsClientsPage } from './pages/TicketsClientsPage'
import { TimerPage } from './pages/TimerPage'
import { ToolsPage } from './pages/ToolsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

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
            <Route path="/clients/archived" element={<ArchivedClientsPage />} />
            <Route path="/tickets" element={<Navigate to="/tickets/clients" replace />} />
            <Route path="/tickets/clients" element={<TicketsClientsPage />} />
            <Route path="/tickets/clients/:clientId" element={<ClientDetailPage />} />
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/schedule" element={<PlaceholderPage title="Schedule" />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/boilerplates" element={<BoilerplatesPage />} />
            <Route path="/boilerplates/clients/:clientId" element={<BoilerplatesPage />} />
            <Route path="/docs" element={<DocsClientsPage />} />
            <Route path="/docs/clients/:clientId" element={<DocsClientLibraryPage />} />
            <Route path="/docs/:docId" element={<DocsDocumentPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/settings" element={<Navigate to="/tools" replace />} />
            <Route path="/settings/profile" element={<Navigate to="/profile" replace />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}
