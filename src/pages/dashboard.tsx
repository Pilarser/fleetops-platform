import { AlertTriangle, ArrowRight, Car, Check, Circle, CreditCard, Users, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../data/formatters'
import { Badge, Card, MetricCard, PageHeader, Table } from '../components/ui'
import { getDriverName, getServiceLabel, getVehiclePlate, statusTone } from './helpers'
import { useFleetWorkspace } from '../state/fleet-workspace'

export function DashboardPage() {
	const { drivers, isLoading, services, transactions, vehicles } = useFleetWorkspace()
	const monthlySpend = transactions.filter((transaction) => transaction.status !== 'withdrawn').reduce((total, transaction) => total + transaction.amount, 0)
	const pendingTransactions = transactions.filter((transaction) => transaction.status === 'pending').length
	const enabledServices = services.filter((service) => service.enabled).length
	const hasVehicle = vehicles.length > 0
	const hasAssignedDriver = drivers.some((driver) => Boolean(driver.vehicleId))
	const hasEnabledService = enabledServices > 0
	const hasTransaction = transactions.length > 0
	const setupSteps = [
		{
			complete: hasVehicle,
			label: 'Add a vehicle',
			detail: hasVehicle ? `${vehicles.length} in fleet` : 'Fleet inventory',
			to: '/vehicles?create=1',
			action: 'Add vehicle',
		},
		{
			complete: hasAssignedDriver,
			label: 'Assign a driver',
			detail: hasAssignedDriver ? 'Vehicle assignment active' : drivers.length > 0 ? 'Assignment required' : 'Driver roster',
			to: drivers.length > 0 ? '/drivers' : '/drivers?create=1',
			action: drivers.length > 0 ? 'Assign vehicle' : 'Add driver',
		},
		{
			complete: hasEnabledService,
			label: 'Enable mobility services',
			detail: `${enabledServices} enabled`,
			to: '/services',
			action: 'Review services',
		},
		{
			complete: hasTransaction,
			label: 'Record a transaction',
			detail: hasTransaction ? `${transactions.length} recorded` : 'Start the ledger',
			to: '/transactions?create=1',
			action: 'Add transaction',
		},
	]
	const completedSetupSteps = setupSteps.filter((step) => step.complete).length
	const nextSetupStep = setupSteps.findIndex((step) => !step.complete)

	return (
		<>
			<PageHeader
				title="Fleet dashboard"
				description="Monitor mobility spend, active vehicles, driver usage, and pending actions."
			/>

			{!isLoading && completedSetupSteps < setupSteps.length ? (
				<Card className="setup-panel">
					<div className="setup-heading">
						<div>
							<h2>Workspace setup</h2>
							<p>{completedSetupSteps} of {setupSteps.length} complete</p>
						</div>
						<div className="setup-progress" aria-label={`${completedSetupSteps} of ${setupSteps.length} setup steps complete`}>
							<span style={{ width: `${(completedSetupSteps / setupSteps.length) * 100}%` }} />
						</div>
					</div>
					<div className="setup-steps">
						{setupSteps.map((step, index) => (
							<div className={`setup-step${step.complete ? ' setup-step-complete' : ''}`} key={step.label}>
								{step.complete ? <Check size={17} /> : <Circle size={17} />}
								<div>
									<strong>{step.label}</strong>
									<span>{step.detail}</span>
								</div>
								{!step.complete && index === nextSetupStep ? (
									<Link className="setup-action" to={step.to}>
										{step.action} <ArrowRight size={15} />
									</Link>
								) : null}
							</div>
						))}
					</div>
				</Card>
			) : null}

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
								<td>{getDriverName(transaction.driverId, drivers)}</td>
								<td>{getVehiclePlate(transaction.vehicleId, vehicles)}</td>
								<td>{getServiceLabel(transaction.service, services)}</td>
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
