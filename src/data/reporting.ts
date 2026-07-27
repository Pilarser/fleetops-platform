import type { Driver, MobilityService, Transaction, TransactionStatus, Vehicle } from '../types'

export type ReportGroup = 'service' | 'driver' | 'vehicle' | 'cost_center'
export type ReportStatus = TransactionStatus | 'all'
export type ReportExpenseType = Transaction['expenseType'] | 'all'

export interface ReportFilters {
	from: string
	to: string
	status: ReportStatus
	expenseType: ReportExpenseType
}

export interface ReportSummary {
	approvedSpend: number
	approvedVat: number
	pendingAmount: number
	pendingCount: number
	personalSpend: number
	transactionCount: number
}

export interface ReportGroupRow {
	key: string
	label: string
	transactionCount: number
	total: number
	vat: number
	share: number
}

export function filterReportTransactions(transactions: Transaction[], filters: ReportFilters) {
	return transactions.filter((transaction) => {
		const matchesRange = transaction.date >= filters.from && transaction.date <= filters.to
		const matchesStatus = filters.status === 'all' || transaction.status === filters.status
		const matchesExpenseType = filters.expenseType === 'all' || transaction.expenseType === filters.expenseType
		return matchesRange && matchesStatus && matchesExpenseType
	})
}

export function summarizeReport(transactions: Transaction[]): ReportSummary {
	const approved = transactions.filter((transaction) => transaction.status === 'approved')
	const pending = transactions.filter((transaction) => transaction.status === 'pending')

	return {
		approvedSpend: approved.reduce((total, transaction) => total + transaction.amount, 0),
		approvedVat: approved.reduce((total, transaction) => total + transaction.vat, 0),
		pendingAmount: pending.reduce((total, transaction) => total + transaction.amount, 0),
		pendingCount: pending.length,
		personalSpend: approved
			.filter((transaction) => transaction.expenseType === 'personal')
			.reduce((total, transaction) => total + transaction.amount, 0),
		transactionCount: transactions.filter((transaction) => transaction.status !== 'withdrawn').length,
	}
}

export function buildReportGroups(
	transactions: Transaction[],
	groupBy: ReportGroup,
	context: { drivers: Driver[]; services: MobilityService[]; vehicles: Vehicle[] },
) {
	const groups = new Map<string, Omit<ReportGroupRow, 'share'>>()
	const totalSpend = transactions.reduce((total, transaction) => total + transaction.amount, 0)

	for (const transaction of transactions) {
		const driver = context.drivers.find((item) => item.id === transaction.driverId)
		const vehicle = context.vehicles.find((item) => item.id === transaction.vehicleId)
		const service = context.services.find((item) => item.id === transaction.service)
		const [key, label] = groupBy === 'service'
			? [transaction.service, service?.name ?? transaction.service]
			: groupBy === 'driver'
				? [transaction.driverId || 'unassigned', driver?.name ?? 'Unassigned']
				: groupBy === 'vehicle'
					? [transaction.vehicleId || 'unassigned', vehicle?.plate ?? 'Unassigned']
					: [driver?.costCenter || vehicle?.costCenter || 'unassigned', driver?.costCenter || vehicle?.costCenter || 'Unassigned']
		const current = groups.get(key) ?? { key, label, transactionCount: 0, total: 0, vat: 0 }
		groups.set(key, {
			...current,
			transactionCount: current.transactionCount + 1,
			total: current.total + transaction.amount,
			vat: current.vat + transaction.vat,
		})
	}

	return [...groups.values()]
		.map((group) => ({ ...group, share: totalSpend > 0 ? (group.total / totalSpend) * 100 : 0 }))
		.sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
}

function csvCell(value: string | number) {
	return `"${String(value).replaceAll('"', '""')}"`
}

export function createReportCsv(
	transactions: Transaction[],
	context: { drivers: Driver[]; services: MobilityService[]; vehicles: Vehicle[] },
) {
	const header = [
		'Date',
		'Driver',
		'Vehicle',
		'Cost center',
		'Service',
		'Provider',
		'Expense classification',
		'VAT',
		'Amount',
		'Status',
		'Receipt',
		'Reviewed by',
		'Reviewed at',
	]
	const rows = transactions.map((transaction) => {
		const driver = context.drivers.find((item) => item.id === transaction.driverId)
		const vehicle = context.vehicles.find((item) => item.id === transaction.vehicleId)
		const service = context.services.find((item) => item.id === transaction.service)
		return [
			transaction.date,
			driver?.name ?? 'Unassigned',
			vehicle?.plate ?? 'Unassigned',
			driver?.costCenter || vehicle?.costCenter || 'Unassigned',
			service?.name ?? transaction.service,
			transaction.provider,
			transaction.expenseType,
			transaction.vat.toFixed(2),
			transaction.amount.toFixed(2),
			transaction.status,
			transaction.receiptName ?? '',
			transaction.reviewedByName ?? '',
			transaction.reviewedAt ?? '',
		]
	})
	return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`
}
