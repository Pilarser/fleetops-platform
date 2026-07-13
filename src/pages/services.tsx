import { Badge, Button, Card, PageHeader } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { services } from '../data/mock-data'

export function ServicesPage() {
	return (
		<>
			<PageHeader
				title="Service catalog"
				description="Enable mobility services per company and configure approval rules before adding real providers."
				actions={<Button>Configure policy</Button>}
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
								<strong>{formatCurrency(service.monthlyLimit)}</strong>
							</div>
							<div>
								<span>Approval</span>
								<strong>{service.requiresApproval ? 'Required' : 'Automatic'}</strong>
							</div>
						</div>
					</Card>
				))}
			</div>
		</>
	)
}
