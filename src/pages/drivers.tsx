import { FormEvent, useMemo, useState } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, SelectInput, Table, TextInput, Toolbar } from '../components/ui'
import { formatCurrency } from '../data/formatters'
import { useFleetWorkspace } from '../state/fleet-workspace'
import type { Driver } from '../types'
import { getVehiclePlate, statusTone } from './helpers'

type DriverFormState = Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend'>

const emptyDriverForm: DriverFormState = {
	name: '',
	email: '',
	status: 'active',
	vehicleId: '',
	costCenter: '',
}

export function DriversPage() {
	const { createDriver, drivers, updateDriver, vehicles } = useFleetWorkspace()
	const [searchParams, setSearchParams] = useSearchParams()
	const [query, setQuery] = useState('')
	const [isCreating, setIsCreating] = useState(searchParams.get('create') === '1')
	const [editingDriver, setEditingDriver] = useState<Driver | null>(null)

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
						columns={['Driver', 'Email', 'Vehicle', 'Cost center', 'Monthly spend', 'Personal', 'Status', '']}
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
								<td>
									<Button type="button" variant="ghost" onClick={() => setEditingDriver(driver)}>
										Edit
									</Button>
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
					onSubmit={async (driver) => {
						await createDriver(driver)
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
	driver,
	onClose,
	onSubmit,
	title,
	vehicles,
}: {
	driver?: Driver
	onClose: () => void
	onSubmit: (driver: DriverFormState) => Promise<void>
	title: string
	vehicles: ReturnType<typeof useFleetWorkspace>['vehicles']
}) {
	const [form, setForm] = useState<DriverFormState>({
		...(driver ?? emptyDriverForm),
		vehicleId: driver?.vehicleId ?? '',
	})
	const [isSaving, setIsSaving] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

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
			})
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
