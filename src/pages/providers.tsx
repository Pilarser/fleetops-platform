import { Badge, Card, PageHeader, Table } from '../components/ui'
import { providers } from '../data/mock-data'
import { useFleetWorkspace } from '../state/fleet-workspace'
import { getServiceLabel, statusTone } from './helpers'

export function ProvidersPage() {
	const { services } = useFleetWorkspace()

	return (
		<>
			<PageHeader
				title="Providers"
				description="Mock provider locations for the future map and service availability layer."
			/>
			<div className="provider-layout">
				<Card className="map-card">
					<div className="mock-map">
						{providers.map((provider, index) => (
							<div
								className={`map-pin map-pin-${index + 1}`}
								key={provider.id}
								title={`${provider.name} - ${provider.status}`}
							/>
						))}
						<div className="map-label">
							<strong>Milano</strong>
							<span>Provider coverage preview</span>
						</div>
					</div>
				</Card>
				<Card>
					<Table
						columns={['Provider', 'Service', 'Address', 'Distance', 'Status']}
						rows={providers}
						renderRow={(provider) => (
							<tr key={provider.id}>
								<td>
									<strong>{provider.name}</strong>
								</td>
								<td>{getServiceLabel(provider.service, services)}</td>
								<td>
									{provider.address}, {provider.city}
								</td>
								<td>{provider.distanceKm} km</td>
								<td>
									<Badge tone={statusTone(provider.status)}>{provider.status}</Badge>
								</td>
							</tr>
						)}
					/>
				</Card>
			</div>
		</>
	)
}
