import { FormEvent, useMemo, useState } from 'react'
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
	const [query, setQuery] = useState('')
	const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
	const [isCreating, setIsCreating] = useState(false)

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
						Add vehicle
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
					<EmptyState title="No vehicles found" detail="Adjust the search terms or add a new vehicle." />
				)}
			</Card>

			{isCreating ? (
				<VehicleDialog
					drivers={drivers}
					title="Add vehicle"
					onClose={() => setIsCreating(false)}
					onSubmit={(vehicle) => {
						createVehicle(vehicle)
						setIsCreating(false)
					}}
				/>
			) : null}

			{editingVehicle ? (
				<VehicleDialog
					drivers={drivers}
					title={`Edit ${editingVehicle.plate}`}
					vehicle={editingVehicle}
					onClose={() => setEditingVehicle(null)}
					onSubmit={(vehicle) => {
						updateVehicle({
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
	onSubmit: (vehicle: VehicleFormState) => void
	title: string
	vehicle?: Vehicle
}) {
	const [form, setForm] = useState<VehicleFormState>({
		...(vehicle ?? emptyVehicleForm),
		assignedDriverId: vehicle?.assignedDriverId ?? drivers[0]?.id ?? '',
	})

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		onSubmit({
			...form,
			plate: form.plate.trim().toUpperCase(),
			make: form.make.trim(),
			model: form.model.trim(),
			costCenter: form.costCenter.trim(),
			mileageKm: Number(form.mileageKm),
		})
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
					<Button type="button" variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit">Save vehicle</Button>
				</div>
			</form>
		</Dialog>
	)
}
