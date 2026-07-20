import { FormEvent, useMemo, useState } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, SelectInput, Table, TextInput, Toolbar } from '../components/ui'
import { formatCurrency, formatNumber } from '../data/formatters'
import { useFleetWorkspace } from '../state/fleet-workspace'
import type { Vehicle } from '../types'
import { getDriverName, statusTone } from './helpers'

type VehicleFormState = Omit<Vehicle, 'id' | 'monthlySpend'>

const emptyVehicleForm: VehicleFormState = {
	plate: '',
	make: '',
	model: '',
	fuelType: 'hybrid',
	status: 'active',
	assignedDriverId: '',
	costCenter: '',
	mileageKm: 0,
}

export function VehiclesPage() {
	const { createVehicle, drivers, updateVehicle, vehicles } = useFleetWorkspace()
	const [searchParams, setSearchParams] = useSearchParams()
	const [query, setQuery] = useState('')
	const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
	const [isCreating, setIsCreating] = useState(searchParams.get('create') === '1')

	function closeCreateDialog() {
		setIsCreating(false)
		if (searchParams.has('create')) {
			setSearchParams({}, { replace: true })
		}
	}

	const filteredVehicles = useMemo(() => {
		const normalized = query.trim().toLowerCase()
		if (!normalized) {
			return vehicles
		}

		return vehicles.filter((vehicle) =>
			[vehicle.plate, vehicle.make, vehicle.model, vehicle.costCenter, getDriverName(vehicle.assignedDriverId, drivers)]
				.join(' ')
				.toLowerCase()
				.includes(normalized),
		)
	}, [drivers, query, vehicles])

	return (
		<>
			<PageHeader
				title="Vehicles"
				description="Track assigned drivers, fuel type, cost center, mileage, and monthly mobility spend."
				actions={
					<Button type="button" onClick={() => setIsCreating(true)}>
						<Plus size={16} /> Add vehicle
					</Button>
				}
			/>
			<Card>
				<Toolbar>
					<TextInput
						aria-label="Search vehicles"
						placeholder="Search plate, model, driver, or cost center"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<span>{filteredVehicles.length} vehicles</span>
				</Toolbar>
				{filteredVehicles.length > 0 ? (
					<Table
						columns={['Plate', 'Vehicle', 'Fuel', 'Driver', 'Cost center', 'Mileage', 'Monthly spend', 'Status', '']}
						rows={filteredVehicles}
						renderRow={(vehicle) => (
							<tr key={vehicle.id}>
								<td>
									<strong>{vehicle.plate}</strong>
								</td>
								<td>
									{vehicle.make} {vehicle.model}
								</td>
								<td>{vehicle.fuelType}</td>
								<td>{getDriverName(vehicle.assignedDriverId, drivers)}</td>
								<td>{vehicle.costCenter}</td>
								<td>{formatNumber(vehicle.mileageKm)} km</td>
								<td>{formatCurrency(vehicle.monthlySpend)}</td>
								<td>
									<Badge tone={statusTone(vehicle.status)}>{vehicle.status}</Badge>
								</td>
								<td>
									<Button type="button" variant="ghost" onClick={() => setEditingVehicle(vehicle)}>
										Edit
									</Button>
								</td>
							</tr>
						)}
					/>
				) : (
					<EmptyState
						title="No vehicles found"
						detail="Add the first vehicle to start this fleet."
						action={<Button type="button" onClick={() => setIsCreating(true)}><Plus size={16} /> Add vehicle</Button>}
					/>
				)}
			</Card>

			{isCreating ? (
				<VehicleDialog
					drivers={drivers}
					title="Add vehicle"
					onClose={closeCreateDialog}
					onSubmit={async (vehicle) => {
						await createVehicle(vehicle)
						closeCreateDialog()
					}}
				/>
			) : null}

			{editingVehicle ? (
				<VehicleDialog
					drivers={drivers}
					title={`Edit ${editingVehicle.plate}`}
					vehicle={editingVehicle}
					onClose={() => setEditingVehicle(null)}
					onSubmit={async (vehicle) => {
						await updateVehicle({
							...editingVehicle,
							...vehicle,
						})
						setEditingVehicle(null)
					}}
				/>
			) : null}
		</>
	)
}

function VehicleDialog({
	drivers,
	onClose,
	onSubmit,
	title,
	vehicle,
}: {
	drivers: ReturnType<typeof useFleetWorkspace>['drivers']
	onClose: () => void
	onSubmit: (vehicle: VehicleFormState) => Promise<void>
	title: string
	vehicle?: Vehicle
}) {
	const [form, setForm] = useState<VehicleFormState>({
		...(vehicle ?? emptyVehicleForm),
		assignedDriverId: vehicle?.assignedDriverId ?? '',
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
				plate: form.plate.trim().toUpperCase(),
				make: form.make.trim(),
				model: form.model.trim(),
				costCenter: form.costCenter.trim(),
				mileageKm: Number(form.mileageKm),
			})
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'Unable to save the vehicle')
			setIsSaving(false)
		}
	}

	return (
		<Dialog title={title} onClose={onClose}>
			<form className="form-grid" onSubmit={handleSubmit}>
				<Field label="Plate">
					<TextInput required value={form.plate} onChange={(event) => setForm({ ...form, plate: event.target.value })} />
				</Field>
				<Field label="Make">
					<TextInput required value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} />
				</Field>
				<Field label="Model">
					<TextInput required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
				</Field>
				<Field label="Fuel type">
					<SelectInput value={form.fuelType} onChange={(event) => setForm({ ...form, fuelType: event.target.value as Vehicle['fuelType'] })}>
						<option value="diesel">Diesel</option>
						<option value="petrol">Petrol</option>
						<option value="hybrid">Hybrid</option>
						<option value="electric">Electric</option>
					</SelectInput>
				</Field>
				<Field label="Assigned driver">
					<SelectInput value={form.assignedDriverId} onChange={(event) => setForm({ ...form, assignedDriverId: event.target.value })}>
						<option value="">Unassigned</option>
						{drivers.map((driver) => (
							<option key={driver.id} value={driver.id}>
								{driver.name}
							</option>
						))}
					</SelectInput>
				</Field>
				<Field label="Status">
					<SelectInput value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Vehicle['status'] })}>
						<option value="active">Active</option>
						<option value="maintenance">Maintenance</option>
						<option value="inactive">Inactive</option>
					</SelectInput>
				</Field>
				<Field label="Cost center">
					<TextInput required value={form.costCenter} onChange={(event) => setForm({ ...form, costCenter: event.target.value })} />
				</Field>
				<Field label="Mileage">
					<TextInput
						min={0}
						required
						type="number"
						value={form.mileageKm}
						onChange={(event) => setForm({ ...form, mileageKm: Number(event.target.value) })}
					/>
				</Field>
				<div className="form-actions">
					{saveError ? <p className="form-error">{saveError}</p> : null}
					<Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
						Cancel
					</Button>
					<Button type="submit" disabled={isSaving}>
						{isSaving ? <LoaderCircle className="spinner" size={16} /> : null}
						{isSaving ? 'Saving...' : 'Save vehicle'}
					</Button>
				</div>
			</form>
		</Dialog>
	)
}
