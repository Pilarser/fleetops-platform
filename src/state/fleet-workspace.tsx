import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { drivers as initialDrivers, services as initialServices, transactions, vehicles as initialVehicles } from '../data/mock-data'
import { fleetApi, hasFleetApi } from '../services/fleet-api'
import type { Driver, MobilityService, Vehicle } from '../types'

interface FleetWorkspaceState {
	apiMode: 'connected' | 'local'
	drivers: Driver[]
	services: MobilityService[]
	transactions: typeof transactions
	vehicles: Vehicle[]
	createDriver: (driver: Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend'>) => Promise<void>
	createVehicle: (vehicle: Omit<Vehicle, 'id' | 'monthlySpend'>) => Promise<void>
	updateDriver: (driver: Driver) => Promise<void>
	updateVehicle: (vehicle: Vehicle) => Promise<void>
	toggleService: (serviceId: MobilityService['id']) => Promise<void>
}

const FleetWorkspaceContext = createContext<FleetWorkspaceState | undefined>(undefined)

function nextId(prefix: string) {
	return `${prefix}-${Date.now()}`
}

export function FleetWorkspaceProvider({ children }: { children: ReactNode }) {
	const apiMode = hasFleetApi() ? 'connected' : 'local'
	const [drivers, setDrivers] = useState(initialDrivers)
	const [vehicles, setVehicles] = useState(initialVehicles)
	const [services, setServices] = useState(initialServices)

	useEffect(() => {
		if (!hasFleetApi()) {
			return
		}

		let cancelled = false
		fleetApi
			.getWorkspace()
			.then((workspace) => {
				if (cancelled) {
					return
				}
				setDrivers(workspace.drivers)
				setServices(workspace.services)
				setVehicles(workspace.vehicles)
			})
			.catch((error: unknown) => {
				console.warn('Unable to load Fleet API workspace, using local demo data.', error)
			})

		return () => {
			cancelled = true
		}
	}, [])

	const value = useMemo<FleetWorkspaceState>(
		() => ({
			apiMode,
			drivers,
			services,
			transactions,
			vehicles,
			createDriver: async (driver) => {
				if (hasFleetApi()) {
					const createdDriver = await fleetApi.createDriver(driver)
					setDrivers((current) => [...current, createdDriver])
					return
				}

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
			createVehicle: async (vehicle) => {
				if (hasFleetApi()) {
					const createdVehicle = await fleetApi.createVehicle(vehicle)
					setVehicles((current) => [...current, createdVehicle])
					return
				}

				setVehicles((current) => [
					...current,
					{
						...vehicle,
						id: nextId('vehicle'),
						monthlySpend: 0,
					},
				])
			},
			updateDriver: async (driver) => {
				if (hasFleetApi()) {
					await fleetApi.updateDriver(driver)
				}
				setDrivers((current) => current.map((item) => (item.id === driver.id ? driver : item)))
			},
			updateVehicle: async (vehicle) => {
				if (hasFleetApi()) {
					await fleetApi.updateVehicle(vehicle)
				}
				setVehicles((current) => current.map((item) => (item.id === vehicle.id ? vehicle : item)))
			},
			toggleService: async (serviceId) => {
				if (hasFleetApi()) {
					const updatedService = await fleetApi.toggleService(serviceId)
					setServices((current) => current.map((service) => (service.id === serviceId ? updatedService : service)))
					return
				}

				setServices((current) =>
					current.map((service) => (service.id === serviceId ? { ...service, enabled: !service.enabled } : service)),
				)
			},
		}),
		[apiMode, drivers, services, vehicles],
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
