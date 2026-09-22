import { Badge, Button, Card, PageHeader } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { useFleetWorkspace } from '../state/fleet-workspace'
import { useAuth } from '../state/auth'
import { canManageFleet } from '../security/permissions'

export function ServicesPage() {
	const { user } = useAuth()
	const { services, toggleService } = useFleetWorkspace()
	const canManage = canManageFleet(user?.role)

	return (
		<>
			<PageHeader
				title="Service catalog"
				description="Enable mobility services per company and configure approval rules before adding real providers."
				/>
			<div className="catalog-grid">
				{services.map((service) => (
					<Card className="service-card" key={service.id}>
						<div className="service-card-header">
							<div>
								<h2>{service.name}</h2>
								<p>{service.description}</p>
							</div>
							<Badge tone={service.enabled ? 'green' : 'gray'}>{service.enabled ? 'Enabled' : 'Disabled'}</Badge>
						</div>
						<div className="service-card-meta">
							<div>
								<span>Monthly limit</span>
								<strong>{formatCurrency(service.monthlyLimit, service.currency)}</strong>
							</div>
							<div>
								<span>Approval</span>
								<strong>{service.requiresApproval ? 'Required' : 'Automatic'}</strong>
							</div>
						</div>
						{canManage ? <div className="service-card-actions">
							<Button
								type="button"
								variant={service.enabled ? 'secondary' : 'primary'}
								onClick={() => toggleService(service.id)}
							>
								{service.enabled ? 'Disable service' : 'Enable service'}
							</Button>
						</div> : null}
					</Card>
				))}
			</div>
		</>
	)
}
