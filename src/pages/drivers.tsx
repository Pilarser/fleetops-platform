import { Badge, Button, Card, PageHeader, Table } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { drivers } from '../data/mock-data'
import { getVehiclePlate, statusTone } from './helpers'

export function DriversPage() {
	return (
		<>
			<PageHeader
				title="Drivers"
				description="Manage driver access, vehicle assignment, cost centers, and personal expense attribution."
				actions={<Button>Add driver</Button>}
			/>
			<Card>
				<Table
					columns={['Driver', 'Email', 'Vehicle', 'Cost center', 'Monthly spend', 'Personal', 'Status']}
					rows={drivers}
					renderRow={(driver) => (
						<tr key={driver.id}>
							<td>
								<strong>{driver.name}</strong>
							</td>
							<td>{driver.email}</td>
							<td>{getVehiclePlate(driver.vehicleId)}</td>
							<td>{driver.costCenter}</td>
							<td>{formatCurrency(driver.monthlySpend)}</td>
							<td>{formatCurrency(driver.personalSpend)}</td>
							<td>
								<Badge tone={statusTone(driver.status)}>{driver.status}</Badge>
							</td>
						</tr>
					)}
				/>
			</Card>
		</>
	)
}
