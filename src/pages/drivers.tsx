import { FormEvent, useMemo, useState } from 'react'
import { LoaderCircle, Mail, Plus, RotateCw, UserCheck, UserX, XCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, SelectInput, Table, TextInput, Toolbar } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { useFleetWorkspace } from '../state/fleet-workspace'
import { useAuth } from '../state/auth'
import { hasSupabaseAuth } from '../services/supabase-auth'
import { fleetApi } from '../services/fleet-api'
import type { AccountLifecycleAction, Driver } from '../types'
import { getVehiclePlate, statusTone } from './helpers'

type DriverFormState = Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend' | 'accountStatus'>

const emptyDriverForm: DriverFormState = {
	name: '',
	email: '',
	status: 'active',
	vehicleId: '',
	costCenter: '',
}

export function DriversPage() {
	const { user } = useAuth()
	const { createDriver, drivers, inviteDriver, reloadWorkspace, updateDriver, vehicles } = useFleetWorkspace()
	const supportsInvitations = hasSupabaseAuth() && (user?.role === 'fleet_admin' || user?.role === 'manager')
	const [searchParams, setSearchParams] = useSearchParams()
	const [query, setQuery] = useState('')
	const [isCreating, setIsCreating] = useState(searchParams.get('create') === '1')
	const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
	const [invitingDriverId, setInvitingDriverId] = useState<string | null>(null)
	const [pageError, setPageError] = useState<string | null>(null)

	async function handleInvitation(driverId: string) {
		setPageError(null)
		setInvitingDriverId(driverId)
		try {
			await inviteDriver(driverId)
		} catch (error) {
			setPageError(error instanceof Error ? error.message : 'Unable to invite the driver')
		} finally {
			setInvitingDriverId(null)
		}
	}

	async function handleAccountLifecycle(driver: Driver, action: AccountLifecycleAction) {
		if (!driver.accountUserId) return
		if ((action === 'revoke_invitation' || action === 'disable') && !window.confirm(
			action === 'disable' ? `Disable ${driver.name}'s account?` : `Revoke ${driver.name}'s invitation?`,
		)) return
		setPageError(null)
		setInvitingDriverId(driver.id)
		try {
			const redirectUrl = action === 'resend_invitation'
				? new URL(import.meta.env.BASE_URL, window.location.origin).toString()
				: undefined
			await fleetApi.manageAccount(driver.accountUserId, action, redirectUrl)
			await reloadWorkspace()
		} catch (error) {
			setPageError(error instanceof Error ? error.message : 'Unable to update the driver account')
		} finally {
			setInvitingDriverId(null)
		}
	}

	function closeCreateDialog() {
		setIsCreating(false)
		if (searchParams.has('create')) {
			setSearchParams({}, { replace: true })
		}
	}

	const filteredDrivers = useMemo(() => {
		const normalized = query.trim().toLowerCase()
		if (!normalized) {
			return drivers
		}

		return drivers.filter((driver) =>
			[driver.name, driver.email, driver.costCenter, getVehiclePlate(driver.vehicleId, vehicles)]
				.join(' ')
				.toLowerCase()
				.includes(normalized),
		)
	}, [drivers, query, vehicles])

	return (
		<>
			<PageHeader
				title="Drivers"
				description="Manage driver access, vehicle assignment, cost centers, and personal expense attribution."
				actions={
					<Button type="button" onClick={() => setIsCreating(true)}>
						<Plus size={16} /> Add driver
					</Button>
				}
			/>
			{pageError ? <p className="page-error" role="alert">{pageError}</p> : null}
			<Card>
				<Toolbar>
					<TextInput
						aria-label="Search drivers"
						placeholder="Search name, email, plate, or cost center"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<span>{filteredDrivers.length} drivers</span>
				</Toolbar>
				{filteredDrivers.length > 0 ? (
					<Table
						columns={[
							'Driver', 'Email', 'Vehicle', 'Cost center', 'Monthly spend', 'Personal', 'Status',
							...(supportsInvitations ? ['Account'] : []), '',
						]}
						rows={filteredDrivers}
						renderRow={(driver) => (
							<tr key={driver.id}>
								<td>
									<strong>{driver.name}</strong>
								</td>
								<td>{driver.email}</td>
								<td>{getVehiclePlate(driver.vehicleId, vehicles)}</td>
								<td>{driver.costCenter}</td>
								<td>{formatCurrency(driver.monthlySpend)}</td>
								<td>{formatCurrency(driver.personalSpend)}</td>
								<td>
									<Badge tone={statusTone(driver.status)}>{driver.status}</Badge>
								</td>
								{supportsInvitations ? (
									<td>
										<Badge tone={driver.accountStatus === 'active' ? 'green' : driver.accountStatus === 'invited' ? 'amber' : driver.accountStatus === 'disabled' ? 'red' : 'gray'}>
											{driver.accountStatus === 'active' ? 'active' : driver.accountStatus === 'invited' ? 'invited' : driver.accountStatus === 'disabled' ? 'disabled' : 'not invited'}
										</Badge>
									</td>
								) : null}
								<td>
									<div className="row-actions">
										{supportsInvitations && (!driver.accountStatus || driver.accountStatus === 'not_invited') ? (
											<Button type="button" variant="ghost" disabled={invitingDriverId === driver.id} onClick={() => void handleInvitation(driver.id)}>
												{invitingDriverId === driver.id ? <LoaderCircle className="spinner" size={15} /> : <Mail size={15} />}
												{invitingDriverId === driver.id ? 'Sending...' : 'Invite'}
											</Button>
										) : null}
										{supportsInvitations && driver.accountStatus === 'invited' ? (
											<>
												<Button type="button" variant="ghost" disabled={invitingDriverId === driver.id} onClick={() => void handleAccountLifecycle(driver, 'resend_invitation')}>
													{invitingDriverId === driver.id ? <LoaderCircle className="spinner" size={15} /> : <RotateCw size={15} />} Resend
												</Button>
												<Button type="button" variant="ghost" disabled={invitingDriverId === driver.id} onClick={() => void handleAccountLifecycle(driver, 'revoke_invitation')}><XCircle size={15} /> Revoke</Button>
											</>
										) : null}
										{supportsInvitations && driver.accountStatus === 'active' ? (
											<Button type="button" variant="ghost" disabled={invitingDriverId === driver.id} onClick={() => void handleAccountLifecycle(driver, 'disable')}><UserX size={15} /> Disable</Button>
										) : null}
										{supportsInvitations && driver.accountStatus === 'disabled' ? (
											<Button type="button" variant="ghost" disabled={invitingDriverId === driver.id} onClick={() => void handleAccountLifecycle(driver, 'reactivate')}><UserCheck size={15} /> Reactivate</Button>
										) : null}
										<Button type="button" variant="ghost" onClick={() => setEditingDriver(driver)}>Edit</Button>
									</div>
								</td>
							</tr>
						)}
					/>
				) : (
					<EmptyState
						title="No drivers found"
						detail="Add a driver and assign an available vehicle."
						action={<Button type="button" onClick={() => setIsCreating(true)}><Plus size={16} /> Add driver</Button>}
					/>
				)}
			</Card>

			{isCreating ? (
				<DriverDialog
					title="Add driver"
					vehicles={vehicles}
					onClose={closeCreateDialog}
					allowInvitation={supportsInvitations}
					onSubmit={async (driver, sendInvitation) => {
						const created = await createDriver(driver)
						if (sendInvitation) {
							await handleInvitation(created.id)
						}
						closeCreateDialog()
					}}
				/>
			) : null}

			{editingDriver ? (
				<DriverDialog
					driver={editingDriver}
					title={`Edit ${editingDriver.name}`}
					vehicles={vehicles}
					onClose={() => setEditingDriver(null)}
					onSubmit={async (driver) => {
						await updateDriver({
							...editingDriver,
							...driver,
						})
						setEditingDriver(null)
					}}
				/>
			) : null}
		</>
	)
}

function DriverDialog({
	allowInvitation = false,
	driver,
	onClose,
	onSubmit,
	title,
	vehicles,
}: {
	allowInvitation?: boolean
	driver?: Driver
	onClose: () => void
	onSubmit: (driver: DriverFormState, sendInvitation: boolean) => Promise<void>
	title: string
	vehicles: ReturnType<typeof useFleetWorkspace>['vehicles']
}) {
	const [form, setForm] = useState<DriverFormState>({
		...(driver ?? emptyDriverForm),
		vehicleId: driver?.vehicleId ?? '',
	})
	const [isSaving, setIsSaving] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)
	const [sendInvitation, setSendInvitation] = useState(allowInvitation && !driver)

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setSaveError(null)
		setIsSaving(true)
		try {
			await onSubmit({
				...form,
				name: form.name.trim(),
				email: form.email.trim().toLowerCase(),
				costCenter: form.costCenter.trim(),
			}, sendInvitation)
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'Unable to save the driver')
			setIsSaving(false)
		}
	}

	return (
		<Dialog title={title} onClose={onClose}>
			<form className="form-grid" onSubmit={handleSubmit}>
				<Field label="Name">
					<TextInput required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
				</Field>
				<Field label="Email">
					<TextInput
						disabled={Boolean(driver?.accountStatus && driver.accountStatus !== 'not_invited')}
						required
						type="email"
						value={form.email}
						onChange={(event) => setForm({ ...form, email: event.target.value })}
					/>
				</Field>
				<Field label="Vehicle">
					<SelectInput value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>
						<option value="">Unassigned</option>
						{vehicles.map((vehicle) => (
							<option key={vehicle.id} value={vehicle.id}>
								{vehicle.plate} - {vehicle.make} {vehicle.model}
							</option>
						))}
					</SelectInput>
				</Field>
				<Field label="Status">
					<SelectInput value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Driver['status'] })}>
						<option value="active">Active</option>
						<option value="suspended">Suspended</option>
					</SelectInput>
				</Field>
				<Field label="Cost center">
					<TextInput required value={form.costCenter} onChange={(event) => setForm({ ...form, costCenter: event.target.value })} />
				</Field>
				{allowInvitation && !driver ? (
					<label className="checkbox-field form-span">
						<input type="checkbox" checked={sendInvitation} onChange={(event) => setSendInvitation(event.target.checked)} />
						<span>Send an email invitation after creating this driver</span>
					</label>
				) : null}
				<div className="form-actions">
					{saveError ? <p className="form-error">{saveError}</p> : null}
					<Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
						Cancel
					</Button>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? <LoaderCircle className="spinner" size={16} /> : null}
						{isSaving ? 'Saving...' : 'Save driver'}
					</Button>
				</div>
			</form>
		</Dialog>
	)
}
