import { BarChart3, CalendarRange, CreditCard, Download, FileSpreadsheet, Hourglass, ReceiptText, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Field, MetricCard, PageHeader, SelectInput, Table, TextInput } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import {
	buildReportGroups,
	createReportCsv,
	filterReportTransactions,
	type ReportExpenseType,
	type ReportGroup,
	type ReportStatus,
	summarizeReport,
} from '../data/reporting'
import { useAuth } from '../state/auth'
import { useWorkspace } from '../state/workspace'
import { canViewReports } from '../security/permissions'

type PeriodMode = 'month' | 'custom'

const groupLabels: Record<ReportGroup, string> = {
	service: 'Service',
	driver: 'Driver',
	vehicle: 'Vehicle',
	cost_center: 'Cost center',
}

function currentDate() {
	return new Date().toISOString().slice(0, 10)
}

function monthRange(month: string) {
	const [year, monthNumber] = month.split('-').map(Number)
	const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
	return {
		from: `${month}-01`,
		to: `${month}-${String(lastDay).padStart(2, '0')}`,
	}
}

export function ReportsPage() {
	const { user } = useAuth()
	const { drivers, services, transactions, vehicles } = useWorkspace()
	const latestDate = [...transactions].sort((left, right) => right.date.localeCompare(left.date))[0]?.date ?? currentDate()
	const earliestDate = [...transactions].sort((left, right) => left.date.localeCompare(right.date))[0]?.date ?? latestDate
	const [periodMode, setPeriodMode] = useState<PeriodMode>('month')
	const [month, setMonth] = useState(latestDate.slice(0, 7))
	const [customFrom, setCustomFrom] = useState(earliestDate)
	const [customTo, setCustomTo] = useState(latestDate)
	const [status, setStatus] = useState<ReportStatus>('approved')
	const [expenseType, setExpenseType] = useState<ReportExpenseType>('all')
	const [groupBy, setGroupBy] = useState<ReportGroup>('service')

	const range = periodMode === 'month' ? monthRange(month || latestDate.slice(0, 7)) : { from: customFrom, to: customTo }
	const periodTransactions = useMemo(() => filterReportTransactions(transactions, {
		...range,
		status: 'all',
		expenseType,
	}), [expenseType, range.from, range.to, transactions])
	const reportTransactions = useMemo(() => filterReportTransactions(periodTransactions, {
		...range,
		status,
		expenseType: 'all',
	}), [expenseType, periodTransactions, range.from, range.to, status])
	const summary = useMemo(() => summarizeReport(periodTransactions), [periodTransactions])
	const groupedRows = useMemo(() => buildReportGroups(reportTransactions, groupBy, {
		drivers,
		services,
		vehicles,
	}), [drivers, groupBy, reportTransactions, services, vehicles])

	if (!canViewReports(user?.role)) {
		return (
			<>
				<PageHeader title="Reports" description="Financial reporting is available to operations, management, and finance roles." />
				<Card><EmptyState title="Access restricted" detail="Your account does not have access to financial reports." /></Card>
			</>
		)
	}

	function exportCsv() {
		const blob = new Blob([createReportCsv(reportTransactions, { drivers, services, vehicles })], {
			type: 'text/csv;charset=utf-8',
		})
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = `onemobility-report-${range.from}-${range.to}.csv`
		anchor.click()
		URL.revokeObjectURL(url)
	}

	return (
		<>
			<PageHeader
				title="Reports"
				description="Review mobility costs by accounting period and export the filtered ledger."
				actions={
					<Button type="button" variant="secondary" onClick={exportCsv} disabled={reportTransactions.length === 0}>
						<Download size={16} /> Export CSV
					</Button>
				}
			/>

			<Card className="report-filters">
				<div className="report-filter-heading">
					<div><CalendarRange size={18} /><div><strong>Reporting period</strong><span>{range.from} to {range.to}</span></div></div>
					<div className="segmented-control" aria-label="Reporting period mode">
						<button type="button" className={periodMode === 'month' ? 'active' : ''} onClick={() => setPeriodMode('month')}>Month</button>
						<button type="button" className={periodMode === 'custom' ? 'active' : ''} onClick={() => setPeriodMode('custom')}>Custom</button>
					</div>
				</div>
				<div className="report-filter-grid">
					{periodMode === 'month' ? (
						<Field label="Month"><TextInput type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Field>
					) : (
						<>
							<Field label="From"><TextInput type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /></Field>
							<Field label="To"><TextInput type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} /></Field>
						</>
					)}
					<Field label="Detail status">
						<SelectInput value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)}>
							<option value="all">All statuses</option>
							<option value="approved">Approved</option>
							<option value="pending">Pending</option>
							<option value="rejected">Rejected</option>
							<option value="withdrawn">Withdrawn</option>
						</SelectInput>
					</Field>
					<Field label="Expense classification">
						<SelectInput value={expenseType} onChange={(event) => setExpenseType(event.target.value as ReportExpenseType)}>
							<option value="all">All expenses</option>
							<option value="business">Business</option>
							<option value="personal">Personal</option>
						</SelectInput>
					</Field>
				</div>
			</Card>

			<div className="report-kpis">
				<MetricCard label="Approved spend" value={formatCurrency(summary.approvedSpend)} detail={`${summary.transactionCount} period transactions`} icon={<CreditCard size={20} />} />
				<MetricCard label="Approved VAT" value={formatCurrency(summary.approvedVat)} detail="Included in approved spend" icon={<ReceiptText size={20} />} />
				<MetricCard label="Pending review" value={formatCurrency(summary.pendingAmount)} detail={`${summary.pendingCount} awaiting decisions`} icon={<Hourglass size={20} />} />
				<MetricCard label="Personal spend" value={formatCurrency(summary.personalSpend)} detail="Approved personal expenses" icon={<UserRound size={20} />} />
			</div>

			<Card className="report-breakdown">
				<div className="section-heading report-breakdown-heading">
					<div><h2>Spend breakdown</h2><p>{reportTransactions.length} {status === 'all' ? '' : status} transactions in the selected detail view.</p></div>
					<div className="segmented-control" aria-label="Group report by">
						{(Object.keys(groupLabels) as ReportGroup[]).map((group) => (
							<button type="button" key={group} className={groupBy === group ? 'active' : ''} onClick={() => setGroupBy(group)}>{groupLabels[group]}</button>
						))}
					</div>
				</div>
				{groupedRows.length > 0 ? (
					<Table columns={[groupLabels[groupBy], 'Transactions', 'VAT', 'Spend', 'Share']} rows={groupedRows} renderRow={(row) => (
						<tr key={row.key}>
							<td><strong>{row.label}</strong></td>
							<td>{row.transactionCount}</td>
							<td>{formatCurrency(row.vat)}</td>
							<td><strong>{formatCurrency(row.total)}</strong></td>
							<td><div className="report-share"><div><span style={{ width: `${row.share}%` }} /></div><strong>{row.share.toFixed(1)}%</strong></div></td>
						</tr>
					)} />
				) : (
					<EmptyState title="No report data" detail="Adjust the period, status, or expense classification filters." />
				)}
				<div className="report-total">
					<FileSpreadsheet size={17} />
					<span>Filtered detail total</span>
					<strong>{formatCurrency(reportTransactions.reduce((total, transaction) => total + transaction.amount, 0))}</strong>
					<BarChart3 size={17} />
				</div>
			</Card>
		</>
	)
}
