import { useMemo, useState } from 'react'
import { Badge, Button, Card, Drawer, EmptyState, Field, PageHeader, SelectInput, Table, TextInput, Toolbar } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { useFleetWorkspace } from '../state/fleet-workspace'
import type { ServiceType, Transaction, TransactionStatus } from '../types'
import { getDriverName, getServiceLabel, getVehiclePlate, statusTone } from './helpers'

type StatusFilter = TransactionStatus | 'all'
type ServiceFilter = ServiceType | 'all'

export function TransactionsPage() {
	const { drivers, services, transactions, vehicles } = useFleetWorkspace()
	const [query, setQuery] = useState('')
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all')
	const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

	const filteredTransactions = useMemo(() => {
		const normalized = query.trim().toLowerCase()

		return transactions.filter((transaction) => {
			const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter
			const matchesService = serviceFilter === 'all' || transaction.service === serviceFilter
			const searchable = [
				transaction.date,
				transaction.provider,
				transaction.expenseType,
				getDriverName(transaction.driverId, drivers),
				getVehiclePlate(transaction.vehicleId, vehicles),
				getServiceLabel(transaction.service, services),
			]
				.join(' ')
				.toLowerCase()
			const matchesQuery = !normalized || searchable.includes(normalized)

			return matchesStatus && matchesService && matchesQuery
		})
	}, [drivers, query, serviceFilter, services, statusFilter, transactions, vehicles])

	return (
		<>
			<PageHeader
				title="Transactions"
				description="A unified ledger for fuel, charging, parking, fines, washes, tolls, urban access, and taxi spend."
				actions={<Button type="button">Export CSV</Button>}
			/>
			<Card>
				<Toolbar>
					<TextInput
						aria-label="Search transactions"
						placeholder="Search driver, plate, provider, or expense"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<SelectInput value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value as ServiceFilter)}>
						<option value="all">All services</option>
						{services.map((service) => (
							<option key={service.id} value={service.id}>
								{service.name}
							</option>
						))}
					</SelectInput>
					<SelectInput value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
						<option value="all">All statuses</option>
						<option value="approved">Approved</option>
						<option value="pending">Pending</option>
						<option value="rejected">Rejected</option>
					</SelectInput>
					<span>{filteredTransactions.length} transactions</span>
				</Toolbar>
				{filteredTransactions.length > 0 ? (
					<Table
						columns={['Date', 'Driver', 'Vehicle', 'Service', 'Provider', 'Expense', 'VAT', 'Amount', 'Status', '']}
						rows={filteredTransactions}
						renderRow={(transaction) => (
							<tr key={transaction.id}>
								<td>{transaction.date}</td>
								<td>{getDriverName(transaction.driverId, drivers)}</td>
								<td>{getVehiclePlate(transaction.vehicleId, vehicles)}</td>
								<td>{getServiceLabel(transaction.service, services)}</td>
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
								<td>
									<Button type="button" variant="ghost" onClick={() => setSelectedTransaction(transaction)}>
										Details
									</Button>
								</td>
							</tr>
						)}
					/>
				) : (
					<EmptyState title="No transactions found" detail="Change filters or search for a different provider." />
				)}
			</Card>

			{selectedTransaction ? (
				<Drawer title={selectedTransaction.id} onClose={() => setSelectedTransaction(null)}>
					<div className="detail-list">
						<Detail label="Date" value={selectedTransaction.date} />
						<Detail label="Driver" value={getDriverName(selectedTransaction.driverId, drivers)} />
						<Detail label="Vehicle" value={getVehiclePlate(selectedTransaction.vehicleId, vehicles)} />
						<Detail label="Service" value={getServiceLabel(selectedTransaction.service, services)} />
						<Detail label="Provider" value={selectedTransaction.provider} />
						<Detail label="Expense type" value={selectedTransaction.expenseType} />
						<Detail label="VAT" value={formatCurrency(selectedTransaction.vat)} />
						<Detail label="Amount" value={formatCurrency(selectedTransaction.amount)} />
						<Detail label="Status" value={selectedTransaction.status} />
					</div>
				</Drawer>
			) : null}
		</>
	)
}

function Detail({ label, value }: { label: string; value: string }) {
	return (
		<div className="detail-row">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	)
}
