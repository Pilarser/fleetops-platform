import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { drivers as initialDrivers, services as initialServices, transactions, vehicles as initialVehicles } from '../data/mock-data'
import type { Driver, MobilityService, Vehicle } from '../types'

interface FleetWorkspaceState {
	drivers: Driver[]
	services: MobilityService[]
	transactions: typeof transactions
	vehicles: Vehicle[]
	createDriver: (driver: Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend'>) => void
	createVehicle: (vehicle: Omit<Vehicle, 'id' | 'monthlySpend'>) => void
	updateDriver: (driver: Driver) => void
	updateVehicle: (vehicle: Vehicle) => void
	toggleService: (serviceId: MobilityService['id']) => void
}

const FleetWorkspaceContext = createContext<FleetWorkspaceState | undefined>(undefined)

function nextId(prefix: string) {
	return `${prefix}-${Date.now()}`
}

export function FleetWorkspaceProvider({ children }: { children: ReactNode }) {
	const [drivers, setDrivers] = useState(initialDrivers)
	const [vehicles, setVehicles] = useState(initialVehicles)
	const [services, setServices] = useState(initialServices)

	const value = useMemo<FleetWorkspaceState>(
		() => ({
			drivers,
			services,
			transactions,
			vehicles,
			createDriver: (driver) => {
				setDrivers((current) => [
					...current,
					{
						...driver,
						id: nextId('driver'),
						monthlySpend: 0,
						personalSpend: 0,
					},
				])
			},
			createVehicle: (vehicle) => {
				setVehicles((current) => [
					...current,
					{
						...vehicle,
						id: nextId('vehicle'),
						monthlySpend: 0,
					},
				])
			},
			updateDriver: (driver) => {
				setDrivers((current) => current.map((item) => (item.id === driver.id ? driver : item)))
			},
			updateVehicle: (vehicle) => {
				setVehicles((current) => current.map((item) => (item.id === vehicle.id ? vehicle : item)))
			},
			toggleService: (serviceId) => {
				setServices((current) =>
					current.map((service) => (service.id === serviceId ? { ...service, enabled: !service.enabled } : service)),
				)
			},
		}),
		[drivers, services, vehicles],
	)

	return <FleetWorkspaceContext.Provider value={value}>{children}</FleetWorkspaceContext.Provider>
}

export function useFleetWorkspace() {
	const context = useContext(FleetWorkspaceContext)
	if (!context) {
		throw new Error('useFleetWorkspace must be used inside FleetWorkspaceProvider')
	}
	return context
}
