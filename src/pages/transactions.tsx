import { type FormEvent, useMemo, useState } from 'react'
import { Check, Download, Plus, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import {
	Badge,
	Button,
	Card,
	Dialog,
	Drawer,
	EmptyState,
	Field,
	PageHeader,
	SelectInput,
	Table,
	TextInput,
	Toolbar,
} from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { useAuth } from '../state/auth'
import { useFleetWorkspace } from '../state/fleet-workspace'
import type { ServiceType, Transaction, TransactionStatus } from '../types'
import { getDriverName, getServiceLabel, getVehiclePlate, statusTone } from './helpers'

type StatusFilter = TransactionStatus | 'all'
type ServiceFilter = ServiceType | 'all'
type TransactionDraft = Omit<Transaction, 'id' | 'status'>

function today() {
	const date = new Date()
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function emptyDraft(): TransactionDraft {
	return {
		date: today(),
		driverId: '',
		vehicleId: '',
		service: 'fuel',
		provider: '',
		amount: 0,
		vat: 0,
		expenseType: 'business',
	}
}

function csvCell(value: string | number) {
	return `"${String(value).replaceAll('"', '""')}"`
}

export function TransactionsPage() {
	const { user } = useAuth()
	const { createTransaction, drivers, services, transactions, updateTransaction, vehicles } = useFleetWorkspace()
	const [searchParams, setSearchParams] = useSearchParams()
	const [query, setQuery] = useState('')
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
	const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all')
	const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
	const [isCreateOpen, setIsCreateOpen] = useState(searchParams.get('create') === '1')
	const [draft, setDraft] = useState<TransactionDraft>(emptyDraft)
	const [createError, setCreateError] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)
	const [reviewExpenseType, setReviewExpenseType] = useState<Transaction['expenseType']>('business')
	const [reviewError, setReviewError] = useState<string | null>(null)
	const [isReviewing, setIsReviewing] = useState(false)

	const canCreate = Boolean(user && ['fleet_admin', 'manager', 'finance', 'support'].includes(user.role))
	const canReview = Boolean(user && ['fleet_admin', 'manager', 'finance'].includes(user.role))
	const enabledServices = services.filter((service) => service.enabled)

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

	function openCreateDialog() {
		setDraft({ ...emptyDraft(), service: enabledServices[0]?.id ?? 'fuel' })
		setCreateError(null)
		setIsCreateOpen(true)
	}

	function closeCreateDialog() {
		setIsCreateOpen(false)
		if (searchParams.has('create')) {
			setSearchParams({}, { replace: true })
		}
	}

	function openDetails(transaction: Transaction) {
		setSelectedTransaction(transaction)
		setReviewExpenseType(transaction.expenseType)
		setReviewError(null)
	}

	function selectDriver(driverId: string) {
		const driver = drivers.find((item) => item.id === driverId)
		setDraft((current) => ({ ...current, driverId, vehicleId: driver?.vehicleId || current.vehicleId }))
	}

	async function handleCreate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setCreateError(null)
		if (draft.vat > draft.amount) {
			setCreateError('VAT cannot exceed the transaction amount.')
			return
		}

		setIsCreating(true)
		try {
			const created = await createTransaction(draft)
			closeCreateDialog()
			openDetails(created)
		} catch (error) {
			setCreateError(error instanceof Error ? error.message : 'Unable to create the transaction')
		} finally {
			setIsCreating(false)
		}
	}

	async function reviewTransaction(status: TransactionStatus) {
		if (!selectedTransaction) return
		setReviewError(null)
		setIsReviewing(true)
		try {
			const updated = await updateTransaction(selectedTransaction.id, {
				status,
				expenseType: reviewExpenseType,
			})
			setSelectedTransaction(updated)
			setReviewExpenseType(updated.expenseType)
		} catch (error) {
			setReviewError(error instanceof Error ? error.message : 'Unable to review the transaction')
		} finally {
			setIsReviewing(false)
		}
	}

	function exportCsv() {
		const header = ['Date', 'Driver', 'Vehicle', 'Service', 'Provider', 'Expense type', 'VAT', 'Amount', 'Status']
		const rows = filteredTransactions.map((transaction) => [
			transaction.date,
			getDriverName(transaction.driverId, drivers),
			getVehiclePlate(transaction.vehicleId, vehicles),
			getServiceLabel(transaction.service, services),
			transaction.provider,
			transaction.expenseType,
			transaction.vat,
			transaction.amount,
			transaction.status,
		])
		const blob = new Blob([[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')], {
			type: 'text/csv;charset=utf-8',
		})
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = `fleet-transactions-${today()}.csv`
		anchor.click()
		URL.revokeObjectURL(url)
	}

	return (
		<>
			<PageHeader
				title="Transactions"
				description="A unified ledger for fuel, charging, parking, fines, washes, tolls, urban access, and taxi spend."
				actions={
					<>
						<Button type="button" variant="secondary" onClick={exportCsv} disabled={filteredTransactions.length === 0}>
							<Download size={16} /> Export CSV
						</Button>
						{canCreate ? (
							<Button type="button" onClick={openCreateDialog} disabled={enabledServices.length === 0}>
								<Plus size={16} /> Add transaction
							</Button>
						) : null}
					</>
				}
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
									<Button type="button" variant="ghost" onClick={() => openDetails(transaction)}>
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

			{isCreateOpen ? (
				<Dialog title="Add transaction" onClose={closeCreateDialog}>
					<form className="form-grid" onSubmit={handleCreate}>
						<Field label="Date">
							<TextInput type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
						</Field>
						<Field label="Driver">
							<SelectInput required value={draft.driverId} onChange={(event) => selectDriver(event.target.value)}>
								<option value="">Select driver</option>
								{drivers.filter((driver) => driver.status === 'active').map((driver) => (
									<option key={driver.id} value={driver.id}>{driver.name}</option>
								))}
							</SelectInput>
						</Field>
						<Field label="Vehicle">
							<SelectInput required value={draft.vehicleId} onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })}>
								<option value="">Select vehicle</option>
								{vehicles.filter((vehicle) => vehicle.status === 'active').map((vehicle) => (
									<option key={vehicle.id} value={vehicle.id}>{vehicle.plate} - {vehicle.make} {vehicle.model}</option>
								))}
							</SelectInput>
						</Field>
						<Field label="Service">
							<SelectInput required value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value as ServiceType })}>
								{enabledServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
							</SelectInput>
						</Field>
						<Field label="Provider">
							<TextInput required value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value })} placeholder="Provider name" />
						</Field>
						<Field label="Expense type">
							<SelectInput value={draft.expenseType} onChange={(event) => setDraft({ ...draft, expenseType: event.target.value as Transaction['expenseType'] })}>
								<option value="business">Business</option>
								<option value="personal">Personal</option>
							</SelectInput>
						</Field>
						<Field label="Amount">
							<TextInput type="number" required min="0.01" step="0.01" value={draft.amount || ''} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} />
						</Field>
						<Field label="VAT">
							<TextInput type="number" required min="0" step="0.01" value={draft.vat || ''} onChange={(event) => setDraft({ ...draft, vat: Number(event.target.value) })} />
						</Field>
						{createError ? <p className="form-error">{createError}</p> : null}
						<div className="form-actions">
							<Button type="button" variant="secondary" onClick={closeCreateDialog}>Cancel</Button>
							<Button type="submit" disabled={isCreating}>{isCreating ? 'Saving...' : 'Save transaction'}</Button>
						</div>
					</form>
				</Dialog>
			) : null}

			{selectedTransaction ? (
				<Drawer title={selectedTransaction.id} onClose={() => setSelectedTransaction(null)}>
					<div className="detail-list">
						<Detail label="Date" value={selectedTransaction.date} />
						<Detail label="Driver" value={getDriverName(selectedTransaction.driverId, drivers)} />
						<Detail label="Vehicle" value={getVehiclePlate(selectedTransaction.vehicleId, vehicles)} />
						<Detail label="Service" value={getServiceLabel(selectedTransaction.service, services)} />
						<Detail label="Provider" value={selectedTransaction.provider} />
						<Detail label="VAT" value={formatCurrency(selectedTransaction.vat)} />
						<Detail label="Amount" value={formatCurrency(selectedTransaction.amount)} />
						<Detail label="Status" value={selectedTransaction.status} />
						{canReview ? (
							<>
								<Field label="Expense classification">
									<SelectInput value={reviewExpenseType} onChange={(event) => setReviewExpenseType(event.target.value as Transaction['expenseType'])}>
										<option value="business">Business</option>
										<option value="personal">Personal</option>
									</SelectInput>
								</Field>
								{reviewError ? <p className="form-error">{reviewError}</p> : null}
								<div className="form-actions">
									<Button type="button" variant="secondary" disabled={isReviewing} onClick={() => void reviewTransaction('rejected')}>
										<X size={16} /> Reject
									</Button>
									<Button type="button" disabled={isReviewing} onClick={() => void reviewTransaction('approved')}>
										<Check size={16} /> Approve
									</Button>
								</div>
							</>
						) : (
							<Detail label="Expense type" value={selectedTransaction.expenseType} />
						)}
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
