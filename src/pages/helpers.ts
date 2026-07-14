import type { Driver, MobilityService, ServiceType, TransactionStatus, Vehicle, VehicleStatus } from '../types'

export function getDriverName(id: string, drivers: Driver[]) {
	return drivers.find((driver) => driver.id === id)?.name ?? 'Unassigned'
}

export function getVehiclePlate(id: string, vehicles: Vehicle[]) {
	return vehicles.find((vehicle) => vehicle.id === id)?.plate ?? '-'
}

export function getServiceLabel(serviceType: ServiceType, services: MobilityService[]) {
	return services.find((service) => service.id === serviceType)?.name ?? serviceType
}

export function statusTone(status: TransactionStatus | VehicleStatus | string) {
	if (status === 'approved' || status === 'active' || status === 'online') {
		return 'green'
	}
	if (status === 'pending' || status === 'maintenance' || status === 'limited') {
		return 'amber'
	}
	if (status === 'rejected' || status === 'inactive' || status === 'offline' || status === 'suspended') {
		return 'red'
	}
	return 'gray'
}
