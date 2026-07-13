import { AlertTriangle, Car, CreditCard, Users, Zap } from 'lucide-react'
import { drivers, services, transactions, vehicles } from '../data/mock-data'
import { formatCurrency } from '../data/formatters'
import { Badge, Card, MetricCard, PageHeader, Table } from '../components/ui'
import { getDriverName, getServiceLabel, getVehiclePlate, statusTone } from './helpers'

export function DashboardPage() {
	const monthlySpend = transactions.reduce((total, transaction) => total + transaction.amount, 0)
	const pendingTransactions = transactions.filter((transaction) => transaction.status === 'pending').length
	const enabledServices = services.filter((service) => service.enabled).length

	return (
		<>
			<PageHeader
				title="Fleet dashboard"
				description="Monitor mobility spend, active vehicles, driver usage, and pending actions."
			/>

			<div className="metrics-grid">
				<MetricCard
					label="Monthly spend"
					value={formatCurrency(monthlySpend)}
					detail="Across all mobility services"
					icon={<CreditCard size={20} />}
				/>
				<MetricCard
					label="Active vehicles"
					value={`${vehicles.filter((vehicle) => vehicle.status === 'active').length}/${vehicles.length}`}
					detail="Available for drivers"
					icon={<Car size={20} />}
				/>
				<MetricCard
					label="Active drivers"
					value={`${drivers.filter((driver) => driver.status === 'active').length}/${drivers.length}`}
					detail="With assigned vehicles"
					icon={<Users size={20} />}
				/>
				<MetricCard
					label="Pending actions"
					value={String(pendingTransactions)}
					detail="Approval or review required"
					icon={<AlertTriangle size={20} />}
				/>
			</div>

			<div className="dashboard-grid">
				<Card>
					<div className="section-heading">
						<div>
							<h2>Recent transactions</h2>
							<p>Latest driver mobility activity.</p>
						</div>
					</div>
					<Table
						columns={['Date', 'Driver', 'Vehicle', 'Service', 'Amount', 'Status']}
						rows={transactions.slice(0, 5)}
						renderRow={(transaction) => (
							<tr key={transaction.id}>
								<td>{transaction.date}</td>
								<td>{getDriverName(transaction.driverId)}</td>
								<td>{getVehiclePlate(transaction.vehicleId)}</td>
								<td>{getServiceLabel(transaction.service)}</td>
								<td>{formatCurrency(transaction.amount)}</td>
								<td>
									<Badge tone={statusTone(transaction.status)}>{transaction.status}</Badge>
								</td>
							</tr>
						)}
					/>
				</Card>

				<Card>
					<div className="section-heading">
						<div>
							<h2>Service coverage</h2>
							<p>{enabledServices} enabled services for this workspace.</p>
						</div>
						<Zap size={18} />
					</div>
					<div className="service-list">
						{services.map((service) => (
							<div className="service-row" key={service.id}>
								<div>
									<strong>{service.name}</strong>
									<span>{formatCurrency(service.monthlyLimit)} monthly limit</span>
								</div>
								<Badge tone={service.enabled ? 'green' : 'gray'}>{service.enabled ? 'Enabled' : 'Disabled'}</Badge>
							</div>
						))}
					</div>
				</Card>
			</div>
		</>
	)
}
