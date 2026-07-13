import { Button, Badge, Card, PageHeader, Table } from '../components/ui'
import { formatCurrency, formatNumber } from '../data/formatters'
import { vehicles } from '../data/mock-data'
import { getDriverName, statusTone } from './helpers'

export function VehiclesPage() {
	return (
		<>
			<PageHeader
				title="Vehicles"
				description="Track assigned drivers, fuel type, cost center, mileage, and monthly mobility spend."
				actions={<Button>Add vehicle</Button>}
			/>
			<Card>
				<Table
					columns={['Plate', 'Vehicle', 'Fuel', 'Driver', 'Cost center', 'Mileage', 'Monthly spend', 'Status']}
					rows={vehicles}
					renderRow={(vehicle) => (
						<tr key={vehicle.id}>
							<td>
								<strong>{vehicle.plate}</strong>
							</td>
							<td>
								{vehicle.make} {vehicle.model}
							</td>
							<td>{vehicle.fuelType}</td>
							<td>{getDriverName(vehicle.assignedDriverId)}</td>
							<td>{vehicle.costCenter}</td>
							<td>{formatNumber(vehicle.mileageKm)} km</td>
							<td>{formatCurrency(vehicle.monthlySpend)}</td>
							<td>
								<Badge tone={statusTone(vehicle.status)}>{vehicle.status}</Badge>
							</td>
						</tr>
					)}
				/>
			</Card>
		</>
	)
}
