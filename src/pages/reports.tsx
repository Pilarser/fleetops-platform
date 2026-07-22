import { BarChart3 } from 'lucide-react'
import { Badge, Card, PageHeader } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { useFleetWorkspace } from '../state/fleet-workspace'

export function ReportsPage() {
	const { services, transactions } = useFleetWorkspace()
	const totalsByService = services.map((service) => {
		const total = transactions
			.filter((transaction) => transaction.service === service.id && transaction.status !== 'withdrawn')
			.reduce((sum, transaction) => sum + transaction.amount, 0)

		return {
			...service,
			total,
		}
	})

	const max = Math.max(...totalsByService.map((service) => service.total), 1)

	return (
		<>
			<PageHeader
				title="Reports"
				description="Monthly cost overview by service, ready to evolve into invoice and accounting exports."
			/>
			<Card>
				<div className="section-heading">
					<div>
						<h2>Spend by service</h2>
						<p>Current demo month, grouped by mobility category.</p>
					</div>
					<BarChart3 size={18} />
				</div>
				<div className="report-bars">
					{totalsByService.map((service) => (
						<div className="report-row" key={service.id}>
							<div className="report-row-label">
								<strong>{service.name}</strong>
								<Badge tone={service.enabled ? 'green' : 'gray'}>{service.enabled ? 'Enabled' : 'Disabled'}</Badge>
							</div>
							<div className="bar-track">
								<div className="bar-fill" style={{ width: `${Math.max((service.total / max) * 100, 4)}%` }} />
							</div>
							<span>{formatCurrency(service.total)}</span>
						</div>
					))}
				</div>
			</Card>
		</>
	)
}
