import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { DashboardPage } from './pages/dashboard'
import { DriversPage } from './pages/drivers'
import { NotFoundPage } from './pages/not-found'
import { ProvidersPage } from './pages/providers'
import { ReportsPage } from './pages/reports'
import { RegisterPage } from './pages/register'
import { ServicesPage } from './pages/services'
import { TransactionsPage } from './pages/transactions'
import { VehiclesPage } from './pages/vehicles'
import { LoginPage } from './pages/login'
import { SetPasswordPage } from './pages/set-password'
import { TeamPage } from './pages/team'
import { DriverPortalPage } from './pages/driver-portal'
import { ForgotPasswordPage } from './pages/forgot-password'
import { ResetPasswordPage } from './pages/reset-password'
import { AuthProvider, useAuth } from './state/auth'
import { FleetWorkspaceProvider, useFleetWorkspace } from './state/fleet-workspace'
import { Button } from './components/ui'

export default function App() {
	return (
		<AuthProvider>
			<AuthenticatedApp />
		</AuthProvider>
	)
}

function AuthenticatedApp() {
	const { isAuthenticated, isInitializing, mustResetPassword, mustSetPassword, user } = useAuth()

	if (isInitializing) {
		return (
			<div className="login-shell" role="status" aria-label="Restoring session">
				<LoaderCircle className="workspace-spinner" size={28} />
			</div>
		)
	}

	if (!isAuthenticated) {
		return (
			<Routes>
				<Route path="/register" element={<RegisterPage />} />
				<Route path="/forgot-password" element={<ForgotPasswordPage />} />
				<Route path="*" element={<LoginPage />} />
			</Routes>
		)
	}

	if (mustResetPassword) {
		return <ResetPasswordPage />
	}

	if (mustSetPassword) {
		return <SetPasswordPage />
	}

	if (user?.role === 'driver') {
		return <AppShell><DriverPortalPage /></AppShell>
	}

	return (
		<FleetWorkspaceProvider>
			<WorkspaceApp />
		</FleetWorkspaceProvider>
	)
}

function WorkspaceApp() {
	const { isLoading, loadError, reloadWorkspace } = useFleetWorkspace()

	return (
		<AppShell>
			{isLoading ? (
				<div className="workspace-state" role="status" aria-live="polite">
					<LoaderCircle className="workspace-spinner" size={28} />
					<strong>Loading workspace</strong>
				</div>
			) : loadError ? (
				<div className="workspace-state" role="alert">
					<AlertTriangle size={28} />
					<strong>Unable to load workspace</strong>
					<span>{loadError}</span>
					<Button type="button" onClick={() => void reloadWorkspace()}>
						<RefreshCw size={16} />
						Retry
					</Button>
				</div>
			) : (
				<Routes>
					<Route path="/" element={<DashboardPage />} />
					<Route path="/vehicles" element={<VehiclesPage />} />
					<Route path="/drivers" element={<DriversPage />} />
					<Route path="/transactions" element={<TransactionsPage />} />
					<Route path="/services" element={<ServicesPage />} />
					<Route path="/providers" element={<ProvidersPage />} />
					<Route path="/reports" element={<ReportsPage />} />
					<Route path="/team" element={<TeamPage />} />
					<Route path="*" element={<NotFoundPage />} />
				</Routes>
			)}
		</AppShell>
	)
}
