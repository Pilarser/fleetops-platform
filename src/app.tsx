import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/app-shell'
import { DashboardPage } from './pages/dashboard'
import { DriversPage } from './pages/drivers'
import { NotFoundPage } from './pages/not-found'
import { ProvidersPage } from './pages/providers'
import { ReportsPage } from './pages/reports'
import { ServicesPage } from './pages/services'
import { TransactionsPage } from './pages/transactions'
import { VehiclesPage } from './pages/vehicles'

export default function App() {
	return (
		<AppShell>
			<Routes>
				<Route path="/" element={<DashboardPage />} />
				<Route path="/vehicles" element={<VehiclesPage />} />
				<Route path="/drivers" element={<DriversPage />} />
				<Route path="/transactions" element={<TransactionsPage />} />
				<Route path="/services" element={<ServicesPage />} />
				<Route path="/providers" element={<ProvidersPage />} />
				<Route path="/reports" element={<ReportsPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</AppShell>
	)
}
