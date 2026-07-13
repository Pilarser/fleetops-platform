import { Badge, Button, Card, PageHeader, Table } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { transactions } from '../data/mock-data'
import { getDriverName, getServiceLabel, getVehiclePlate, statusTone } from './helpers'

export function TransactionsPage() {
	return (
		<>
			<PageHeader
				title="Transactions"
				description="A unified ledger for fuel, charging, parking, fines, washes, tolls, urban access, and taxi spend."
				actions={<Button>Export CSV</Button>}
			/>
			<Card>
				<Table
					columns={['Date', 'Driver', 'Vehicle', 'Service', 'Provider', 'Expense', 'VAT', 'Amount', 'Status']}
					rows={transactions}
					renderRow={(transaction) => (
						<tr key={transaction.id}>
							<td>{transaction.date}</td>
							<td>{getDriverName(transaction.driverId)}</td>
							<td>{getVehiclePlate(transaction.vehicleId)}</td>
							<td>{getServiceLabel(transaction.service)}</td>
							<td>{transaction.provider}</td>
							<td>
								<Badge tone={transaction.expenseType === 'business' ? 'blue' : 'amber'}>{transaction.expenseType}</Badge>
							</td>
							<td>{formatCurrency(transaction.vat)}</td>
							<td>
								<strong>{formatCurrency(transaction.amount)}</strong>
							</td>
							<td>
								<Badge tone={statusTone(transaction.status)}>{transaction.status}</Badge>
							</td>
						</tr>
					)}
				/>
			</Card>
		</>
	)
}
