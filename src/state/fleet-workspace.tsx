import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
	drivers as initialDrivers,
	providers as initialProviders,
	services as initialServices,
	transactions as initialTransactions,
	vehicles as initialVehicles,
} from '../data/mock-data'
import { fleetApi, hasFleetApi, type FleetWorkspacePayload } from '../services/fleet-api'
import type { Driver, MobilityService, ProviderLocation, Transaction, Vehicle } from '../types'

interface FleetWorkspaceState {
	apiMode: 'connected' | 'local'
	drivers: Driver[]
	isLoading: boolean
	loadError: string | null
	providers: ProviderLocation[]
	services: MobilityService[]
	transactions: Transaction[]
	vehicles: Vehicle[]
	reloadWorkspace: () => Promise<void>
	createDriver: (driver: Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend' | 'accountStatus'>) => Promise<Driver>
	createVehicle: (vehicle: Omit<Vehicle, 'id' | 'monthlySpend'>) => Promise<void>
	createTransaction: (transaction: Omit<Transaction, 'id' | 'status'>) => Promise<Transaction>
	updateDriver: (driver: Driver) => Promise<void>
	updateVehicle: (vehicle: Vehicle) => Promise<void>
	updateTransaction: (
		transactionId: string,
		review: {
			status: 'approved' | 'rejected'
			expenseType: Transaction['expenseType']
			rejectionReason?: string
		},
	) => Promise<Transaction>
	toggleService: (serviceId: MobilityService['id']) => Promise<void>
	inviteDriver: (driverId: string) => Promise<void>
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
	const isConnected = hasFleetApi()
	const apiMode = isConnected ? 'connected' : 'local'
	const [drivers, setDrivers] = useState<Driver[]>(() => (isConnected ? [] : initialDrivers))
	const [providers, setProviders] = useState<ProviderLocation[]>(() => (isConnected ? [] : initialProviders))
	const [services, setServices] = useState<MobilityService[]>(() => (isConnected ? [] : initialServices))
	const [transactions, setTransactions] = useState<Transaction[]>(() => (isConnected ? [] : initialTransactions))
	const [vehicles, setVehicles] = useState<Vehicle[]>(() => (isConnected ? [] : initialVehicles))
	const [isLoading, setIsLoading] = useState(isConnected)
	const [loadError, setLoadError] = useState<string | null>(null)

	const applyWorkspace = useCallback((workspace: FleetWorkspacePayload) => {
		setDrivers(workspace.drivers)
		setProviders(workspace.providers)
		setServices(workspace.services)
		setTransactions(workspace.transactions)
		setVehicles(workspace.vehicles)
	}, [])

	const reloadWorkspace = useCallback(async () => {
		if (!isConnected) {
			return
		}

		setIsLoading(true)
		setLoadError(null)
		try {
			applyWorkspace(await fleetApi.getWorkspace())
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : 'Unable to load the fleet workspace')
		} finally {
			setIsLoading(false)
		}
	}, [applyWorkspace, isConnected])

	useEffect(() => {
		void reloadWorkspace()
	}, [reloadWorkspace])

	async function refreshWorkspace() {
		applyWorkspace(await fleetApi.getWorkspace())
	}

	const value = useMemo<FleetWorkspaceState>(
		() => ({
			apiMode,
			drivers,
			isLoading,
			loadError,
			providers,
			services,
			transactions,
			vehicles,
			reloadWorkspace,
			createDriver: async (driver) => {
				if (hasFleetApi()) {
					const created = await fleetApi.createDriver(driver)
					await refreshWorkspace()
					return created
				}

				const createdDriver = {
					...driver,
					id: nextId('driver'),
					monthlySpend: 0,
					personalSpend: 0,
				}
				setDrivers((current) => applyDriverAssignment([...current, createdDriver], createdDriver))
				setVehicles((current) => applyDriverToVehicles(current, createdDriver))
				return createdDriver
			},
			inviteDriver: async (driverId) => {
				if (!hasFleetApi()) {
					throw new Error('Driver invitations require the hosted API')
				}
				const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
				await fleetApi.inviteDriver(driverId, redirectUrl)
				await refreshWorkspace()
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
			createTransaction: async (transaction) => {
				if (hasFleetApi()) {
					const created = await fleetApi.createTransaction(transaction)
					setTransactions((current) => [created, ...current])
					return created
				}

				const created: Transaction = {
					...transaction,
					id: nextId('transaction'),
					status: 'pending',
				}
				setTransactions((current) => [created, ...current])
				return created
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
			updateTransaction: async (transactionId, review) => {
				if (hasFleetApi()) {
					const updated = await fleetApi.updateTransaction(transactionId, review)
					setTransactions((current) => current.map((item) => (item.id === transactionId ? updated : item)))
					return updated
				}

				const existing = transactions.find((transaction) => transaction.id === transactionId)
				if (!existing) {
					throw new Error('Transaction not found')
				}
				const updated = { ...existing, ...review }
				setTransactions((current) => current.map((item) => (item.id === transactionId ? updated : item)))
				return updated
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
		[apiMode, drivers, isLoading, loadError, providers, reloadWorkspace, services, transactions, vehicles],
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
