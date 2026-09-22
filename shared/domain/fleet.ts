export interface AssignableDriver {
	id: string
	vehicleId: string
}

export interface AssignableVehicle {
	id: string
	assignedDriverId: string
}

export function applyDriverAssignment<T extends AssignableDriver>(drivers: T[], driver: T) {
	return drivers.map((item) => {
		if (item.id === driver.id) return driver
		if (driver.vehicleId && item.vehicleId === driver.vehicleId) return { ...item, vehicleId: '' }
		return item
	})
}

export function assignVehicleDriver<T extends AssignableDriver>(drivers: T[], vehicle: AssignableVehicle) {
	if (!vehicle.assignedDriverId) {
		return drivers.map((driver) => (driver.vehicleId === vehicle.id ? { ...driver, vehicleId: '' } : driver))
	}

	return drivers.map((driver) => {
		if (driver.id === vehicle.assignedDriverId) return { ...driver, vehicleId: vehicle.id }
		if (driver.vehicleId === vehicle.id) return { ...driver, vehicleId: '' }
		return driver
	})
}

export function applyDriverToVehicles<T extends AssignableVehicle>(vehicles: T[], driver: AssignableDriver) {
	return vehicles.map((vehicle) => {
		if (driver.vehicleId && vehicle.id === driver.vehicleId) return { ...vehicle, assignedDriverId: driver.id }
		if (vehicle.assignedDriverId === driver.id) return { ...vehicle, assignedDriverId: '' }
		return vehicle
	})
}
