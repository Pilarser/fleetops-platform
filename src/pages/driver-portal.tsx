import { useEffect, useState } from 'react'
import { Car, CreditCard, LoaderCircle, Route } from 'lucide-react'
import { Badge, Card, EmptyState, MetricCard, PageHeader, Table } from '../components/ui'
import { formatCurrency, formatNumber } from '../data/formatters'
import { fleetApi } from '../services/fleet-api'
import type { DriverWorkspace } from '../types'
import { statusTone } from './helpers'

function serviceLabel(service: string) {
	const label = service.replace('_', ' ')
	return label.charAt(0).toUpperCase() + label.slice(1)
}

export function DriverPortalPage() {
	const [workspace, setWorkspace] = useState<DriverWorkspace | null>(null)
	const [error, setError] = useState('')

	useEffect(() => {
		fleetApi.getDriverWorkspace()
			.then(setWorkspace)
			.catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load driver workspace'))
	}, [])

	if (error) {
		return <EmptyState title="Unable to load driver workspace" detail={error} />
	}

	if (!workspace) {
		return <div className="workspace-state" role="status"><LoaderCircle className="workspace-spinner" size={28} /><strong>Loading workspace</strong></div>
	}

	const totalSpend = workspace.transactions.reduce((total, transaction) => total + transaction.amount, 0)
	const personalSpend = workspace.transactions
		.filter((transaction) => transaction.expenseType === 'personal')
		.reduce((total, transaction) => total + transaction.amount, 0)

	return (
		<>
			<PageHeader title="Driver dashboard" description={`${workspace.driver.name} - ${workspace.driver.costCenter}`} />
			<div className="metrics-grid driver-metrics">
				<MetricCard label="Assigned vehicle" value={workspace.vehicle?.plate ?? 'Unassigned'} detail={workspace.vehicle ? `${workspace.vehicle.make} ${workspace.vehicle.model}` : 'No active assignment'} icon={<Car size={20} />} />
				<MetricCard label="Mileage" value={workspace.vehicle ? `${formatNumber(workspace.vehicle.mileageKm)} km` : '-'} detail="Recorded vehicle mileage" icon={<Route size={20} />} />
				<MetricCard label="Total spend" value={formatCurrency(totalSpend)} detail="Your recorded transactions" icon={<CreditCard size={20} />} />
				<MetricCard label="Personal spend" value={formatCurrency(personalSpend)} detail="Personal classification" icon={<CreditCard size={20} />} />
			</div>

			<Card>
				<div className="section-heading">
					<div><h2>Your transactions</h2><p>{workspace.transactions.length} recorded transactions</p></div>
				</div>
				{workspace.transactions.length > 0 ? (
					<Table
						columns={['Date', 'Service', 'Provider', 'Expense', 'Amount', 'Status']}
						rows={workspace.transactions}
						renderRow={(transaction) => (
							<tr key={transaction.id}>
								<td>{transaction.date}</td>
								<td>{serviceLabel(transaction.service)}</td>
								<td>{transaction.provider}</td>
								<td><Badge tone={transaction.expenseType === 'personal' ? 'amber' : 'blue'}>{transaction.expenseType}</Badge></td>
								<td><strong>{formatCurrency(transaction.amount)}</strong></td>
								<td><Badge tone={statusTone(transaction.status)}>{transaction.status}</Badge></td>
							</tr>
						)}
					/>
				) : <EmptyState title="No transactions" detail="No mobility transactions are assigned to your driver profile." />}
			</Card>
		</>
	)
}
