import { type FormEvent, useEffect, useState } from 'react'
import { Car, CreditCard, Download, LoaderCircle, Pencil, Plus, Route, Undo2 } from 'lucide-react'
import { Badge, Button, Card, Dialog, Drawer, EmptyState, Field, MetricCard, PageHeader, SelectInput, Table, TextInput } from '../components/ui'
import { formatCurrency, formatNumber } from '../data/formatters'
import { fleetApi } from '../services/fleet-api'
import type { DriverTransactionDraft, DriverWorkspace, ServiceType, Transaction } from '../types'
import { statusTone } from './helpers'

function today() {
	const date = new Date()
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function transactionDraft(transaction?: Transaction, service: ServiceType = 'fuel'): DriverTransactionDraft {
	return transaction
		? { date: transaction.date, service: transaction.service, provider: transaction.provider, amount: transaction.amount, vat: transaction.vat, expenseType: transaction.expenseType }
		: { date: today(), service, provider: '', amount: 0, vat: 0, expenseType: 'business' }
}

export function DriverPortalPage() {
	const [workspace, setWorkspace] = useState<DriverWorkspace | null>(null)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
	const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [draft, setDraft] = useState<DriverTransactionDraft>(transactionDraft())
	const [formError, setFormError] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [isWithdrawing, setIsWithdrawing] = useState(false)
	const [receiptFile, setReceiptFile] = useState<File | null>(null)
	const [isOpeningReceipt, setIsOpeningReceipt] = useState(false)

	useEffect(() => {
		fleetApi.getDriverWorkspace()
			.then(setWorkspace)
			.catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load driver workspace'))
	}, [])

	if (error) return <EmptyState title="Unable to load driver workspace" detail={error} />
	if (!workspace) return <div className="workspace-state" role="status"><LoaderCircle className="workspace-spinner" size={28} /><strong>Loading workspace</strong></div>

	const canSubmit = workspace.driver.status === 'active' && workspace.vehicle?.status === 'active' && workspace.services.length > 0
	const activeTransactions = workspace.transactions.filter((transaction) => transaction.status !== 'withdrawn')
	const totalSpend = activeTransactions.reduce((total, transaction) => total + transaction.amount, 0)
	const personalSpend = activeTransactions.filter((transaction) => transaction.expenseType === 'personal').reduce((total, transaction) => total + transaction.amount, 0)

	function serviceLabel(service: string) {
		return workspace?.services.find((item) => item.id === service)?.name ?? service.replace('_', ' ')
	}

	function openCreate() {
		setEditingTransaction(null)
		setDraft(transactionDraft(undefined, workspace?.services[0]?.id))
		setFormError('')
		setReceiptFile(null)
		setSuccess('')
		setIsFormOpen(true)
	}

	function openEdit(transaction: Transaction) {
		setSelectedTransaction(null)
		setEditingTransaction(transaction)
		setDraft(transactionDraft(transaction))
		setFormError('')
		setReceiptFile(null)
		setSuccess('')
		setIsFormOpen(true)
	}

	async function saveTransaction(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!workspace) return
		setFormError('')
		if (draft.vat > draft.amount) return setFormError('VAT cannot exceed the transaction amount.')
		if (receiptFile && receiptFile.size > 5 * 1024 * 1024) return setFormError('Receipt must be 5 MB or smaller.')
		const defaultService = workspace.services[0]?.id
		setIsSaving(true)
		try {
			let saved = editingTransaction
				? await fleetApi.updateDriverTransaction(editingTransaction.id, draft)
				: await fleetApi.createDriverTransaction(draft)
			if (receiptFile) {
				try {
					saved = await fleetApi.uploadDriverReceipt(saved.id, receiptFile)
				} catch (uploadError) {
					setWorkspace((current) => current && ({ ...current, transactions: editingTransaction
						? current.transactions.map((transaction) => transaction.id === saved.id ? saved : transaction)
						: [saved, ...current.transactions] }))
					setEditingTransaction(saved)
					setFormError(`Expense saved, but the receipt upload failed. ${uploadError instanceof Error ? uploadError.message : 'Try again.'}`)
					return
				}
			}
			setWorkspace((current) => current && ({ ...current, transactions: editingTransaction
				? current.transactions.map((transaction) => transaction.id === saved.id ? saved : transaction)
				: [saved, ...current.transactions] }))
			setSuccess(editingTransaction ? 'Pending expense updated.' : 'Expense submitted for review.')
			setEditingTransaction(null)
			setDraft(transactionDraft(undefined, defaultService))
			setReceiptFile(null)
			setIsFormOpen(false)
		} catch (saveError) {
			setFormError(saveError instanceof Error ? saveError.message : 'Unable to save the expense')
		} finally {
			setIsSaving(false)
		}
	}

	async function openReceipt(transaction: Transaction) {
		setIsOpeningReceipt(true)
		try {
			const { url } = await fleetApi.getReceiptUrl(transaction.id)
			const link = document.createElement('a')
			link.href = url
			link.target = '_blank'
			link.rel = 'noopener noreferrer'
			link.click()
		} catch (receiptError) {
			window.alert(receiptError instanceof Error ? receiptError.message : 'Unable to open receipt')
		} finally {
			setIsOpeningReceipt(false)
		}
	}

	async function withdrawTransaction(transaction: Transaction) {
		if (!window.confirm('Withdraw this pending expense?')) return
		setIsWithdrawing(true)
		try {
			const withdrawn = await fleetApi.withdrawDriverTransaction(transaction.id)
			setWorkspace((current) => current && ({ ...current, transactions: current.transactions.map((item) => item.id === withdrawn.id ? withdrawn : item) }))
			setSelectedTransaction(withdrawn)
			setSuccess('Expense withdrawn.')
		} catch (withdrawError) {
			setError(withdrawError instanceof Error ? withdrawError.message : 'Unable to withdraw the expense')
		} finally {
			setIsWithdrawing(false)
		}
	}

	return (
		<>
			<PageHeader
				title="Driver dashboard"
				description={`${workspace.driver.name} - ${workspace.driver.costCenter}`}
				actions={<Button type="button" disabled={!canSubmit} onClick={openCreate}><Plus size={16} /> Submit expense</Button>}
			/>
			{success ? <p className="page-success" role="status">{success}</p> : null}
			{!canSubmit ? <p className="page-error" role="alert">An active driver, assigned vehicle, and enabled service are required to submit expenses.</p> : null}
			<div className="metrics-grid driver-metrics">
				<MetricCard label="Assigned vehicle" value={workspace.vehicle?.plate ?? 'Unassigned'} detail={workspace.vehicle ? `${workspace.vehicle.make} ${workspace.vehicle.model}` : 'No active assignment'} icon={<Car size={20} />} />
				<MetricCard label="Mileage" value={workspace.vehicle ? `${formatNumber(workspace.vehicle.mileageKm)} km` : '-'} detail="Recorded vehicle mileage" icon={<Route size={20} />} />
				<MetricCard label="Total spend" value={formatCurrency(totalSpend)} detail="Your recorded transactions" icon={<CreditCard size={20} />} />
				<MetricCard label="Personal spend" value={formatCurrency(personalSpend)} detail="Personal classification" icon={<CreditCard size={20} />} />
			</div>

			<Card>
				<div className="section-heading"><div><h2>Your transactions</h2><p>{workspace.transactions.length} recorded transactions</p></div></div>
				{workspace.transactions.length > 0 ? (
					<Table columns={['Date', 'Service', 'Provider', 'Expense', 'Amount', 'Status', '']} rows={workspace.transactions} renderRow={(transaction) => (
						<tr key={transaction.id}>
							<td>{transaction.date}</td><td>{serviceLabel(transaction.service)}</td><td>{transaction.provider}</td>
							<td><Badge tone={transaction.expenseType === 'personal' ? 'amber' : 'blue'}>{transaction.expenseType}</Badge></td>
							<td><strong>{formatCurrency(transaction.amount)}</strong></td><td><Badge tone={statusTone(transaction.status)}>{transaction.status}</Badge></td>
							<td><Button type="button" variant="ghost" onClick={() => setSelectedTransaction(transaction)}>Details</Button></td>
						</tr>
					)} />
				) : <EmptyState title="No transactions" detail="Submit your first mobility expense for review." />}
			</Card>

			{isFormOpen ? (
				<Dialog title={editingTransaction ? 'Edit pending expense' : 'Submit expense'} onClose={() => { setIsFormOpen(false); setEditingTransaction(null); setDraft(transactionDraft(undefined, workspace.services[0]?.id)) }}>
					<form className="form-grid" onSubmit={saveTransaction}>
						<Field label="Driver"><TextInput disabled value={workspace.driver.name} /></Field>
						<Field label="Vehicle"><TextInput disabled value={workspace.vehicle?.plate ?? 'Unassigned'} /></Field>
						<Field label="Date"><TextInput max={today()} required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></Field>
						<Field label="Service"><SelectInput required value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value as ServiceType })}>{workspace.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</SelectInput></Field>
						<Field label="Provider"><TextInput required value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value })} placeholder="Provider name" /></Field>
						<Field label="Expense type"><SelectInput value={draft.expenseType} onChange={(event) => setDraft({ ...draft, expenseType: event.target.value as Transaction['expenseType'] })}><option value="business">Business</option><option value="personal">Personal</option></SelectInput></Field>
						<Field label="Amount"><TextInput min="0.01" required step="0.01" type="number" value={draft.amount || ''} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} /></Field>
						<Field label="VAT"><TextInput min="0" required step="0.01" type="number" value={draft.vat || ''} onChange={(event) => setDraft({ ...draft, vat: Number(event.target.value) })} /></Field>
						<Field label={editingTransaction?.receiptName ? 'Replace receipt (optional)' : 'Receipt (optional)'}>
							<input className="field" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} />
							{editingTransaction?.receiptName && !receiptFile ? <small>Current: {editingTransaction.receiptName}</small> : null}
						</Field>
						{formError ? <p className="form-error">{formError}</p> : null}
						<div className="form-actions"><Button type="button" variant="secondary" disabled={isSaving} onClick={() => { setIsFormOpen(false); setEditingTransaction(null); setDraft(transactionDraft(undefined, workspace.services[0]?.id)) }}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving ? <LoaderCircle className="spinner" size={16} /> : null}{isSaving ? 'Saving...' : editingTransaction ? 'Save changes' : 'Submit for review'}</Button></div>
					</form>
				</Dialog>
			) : null}

			{selectedTransaction ? (
				<Drawer title="Transaction details" onClose={() => setSelectedTransaction(null)}>
					<div className="detail-list">
						<Detail label="Date" value={selectedTransaction.date} /><Detail label="Vehicle" value={workspace.vehicle?.plate ?? selectedTransaction.vehicleId} /><Detail label="Service" value={serviceLabel(selectedTransaction.service)} /><Detail label="Provider" value={selectedTransaction.provider} /><Detail label="Expense type" value={selectedTransaction.expenseType} /><Detail label="VAT" value={formatCurrency(selectedTransaction.vat)} /><Detail label="Amount" value={formatCurrency(selectedTransaction.amount)} /><Detail label="Status" value={selectedTransaction.status} />
						{selectedTransaction.reviewedByName ? <Detail label="Reviewed by" value={selectedTransaction.reviewedByName} /> : null}
						{selectedTransaction.reviewedAt ? <Detail label="Reviewed at" value={new Date(selectedTransaction.reviewedAt).toLocaleString()} /> : null}
						{selectedTransaction.rejectionReason ? <Detail label="Rejection reason" value={selectedTransaction.rejectionReason} /> : null}
						{selectedTransaction.receiptName ? (
							<div className="detail-row"><span>Receipt</span><Button type="button" variant="secondary" disabled={isOpeningReceipt} onClick={() => void openReceipt(selectedTransaction)}>{isOpeningReceipt ? <LoaderCircle className="spinner" size={16} /> : <Download size={16} />}{selectedTransaction.receiptName}</Button></div>
						) : <Detail label="Receipt" value="Not attached" />}
						{selectedTransaction.status === 'pending' ? <div className="form-actions"><Button type="button" variant="secondary" disabled={isWithdrawing} onClick={() => void withdrawTransaction(selectedTransaction)}><Undo2 size={16} /> Withdraw</Button><Button type="button" disabled={isWithdrawing} onClick={() => openEdit(selectedTransaction)}><Pencil size={16} /> Edit</Button></div> : null}
					</div>
				</Drawer>
			) : null}
		</>
	)
}

function Detail({ label, value }: { label: string; value: string }) {
	return <div className="detail-row"><span>{label}</span><strong>{value}</strong></div>
}
