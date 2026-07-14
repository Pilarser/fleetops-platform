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

function applyDriverAssignment(drivers: Driver[], driver: Driver) {
	return drivers.map((item) => {
		if (item.id === driver.id) {
			return driver
		}
		if (driver.vehicleId && item.vehicleId === driver.vehicleId) {
			return { ...item, vehicleId: '' }
		}
		return item
	})
}

function assignVehicleDriver(drivers: Driver[], vehicle: Vehicle) {
	if (!vehicle.assignedDriverId) {
		return drivers.map((driver) => (driver.vehicleId === vehicle.id ? { ...driver, vehicleId: '' } : driver))
	}

	return drivers.map((driver) => {
		if (driver.id === vehicle.assignedDriverId) {
			return { ...driver, vehicleId: vehicle.id }
		}
		if (driver.vehicleId === vehicle.id) {
			return { ...driver, vehicleId: '' }
		}
		return driver
	})
}

function applyDriverToVehicles(vehicles: Vehicle[], driver: Driver) {
	return vehicles.map((vehicle) => {
		if (driver.vehicleId && vehicle.id === driver.vehicleId) {
			return { ...vehicle, assignedDriverId: driver.id }
		}
		if (vehicle.assignedDriverId === driver.id) {
			return { ...vehicle, assignedDriverId: '' }
		}
		return vehicle
	})
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

	async function refreshWorkspace() {
		const workspace = await fleetApi.getWorkspace()
		setDrivers(workspace.drivers)
		setServices(workspace.services)
		setVehicles(workspace.vehicles)
	}

	const value = useMemo<FleetWorkspaceState>(
		() => ({
			apiMode,
			drivers,
			services,
			transactions,
			vehicles,
			createDriver: async (driver) => {
				if (hasFleetApi()) {
					await fleetApi.createDriver(driver)
					await refreshWorkspace()
					return
				}

				const createdDriver = {
					...driver,
					id: nextId('driver'),
					monthlySpend: 0,
					personalSpend: 0,
				}
				setDrivers((current) => applyDriverAssignment([...current, createdDriver], createdDriver))
				setVehicles((current) => applyDriverToVehicles(current, createdDriver))
			},
			createVehicle: async (vehicle) => {
				if (hasFleetApi()) {
					await fleetApi.createVehicle(vehicle)
					await refreshWorkspace()
					return
				}

				const createdVehicle = {
					...vehicle,
					id: nextId('vehicle'),
					monthlySpend: 0,
				}
				setDrivers((current) => assignVehicleDriver(current, createdVehicle))
				setVehicles((current) => [...current, createdVehicle])
			},
			updateDriver: async (driver) => {
				if (hasFleetApi()) {
					await fleetApi.updateDriver(driver)
					await refreshWorkspace()
					return
				}
				setDrivers((current) => applyDriverAssignment(current, driver))
				setVehicles((current) => applyDriverToVehicles(current, driver))
			},
			updateVehicle: async (vehicle) => {
				if (hasFleetApi()) {
					await fleetApi.updateVehicle(vehicle)
					await refreshWorkspace()
					return
				}
				setDrivers((current) => assignVehicleDriver(current, vehicle))
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
