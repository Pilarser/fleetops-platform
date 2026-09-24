import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
	drivers as initialDrivers,
	providers as initialProviders,
	services as initialServices,
	transactions as initialTransactions,
	vehicles as initialVehicles,
} from '../data/mock-data'
import { hasPlatformApi, platformApi, type WorkspacePayload } from '../services/platform-api'
import type { Driver, ExpenseInput, MobilityService, ProviderLocation, Transaction, Vehicle } from '../types'
import { applyDriverAssignment, applyDriverToVehicles, assignVehicleDriver } from '../../shared/domain/vehicle-assignments'

interface WorkspaceState {
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
	createTransaction: (transaction: ExpenseInput) => Promise<Transaction>
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

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined)

function nextId(prefix: string) {
	return `${prefix}-${Date.now()}`
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const isConnected = hasPlatformApi()
	const apiMode = isConnected ? 'connected' : 'local'
	const [drivers, setDrivers] = useState<Driver[]>(() => (isConnected ? [] : initialDrivers))
	const [providers, setProviders] = useState<ProviderLocation[]>(() => (isConnected ? [] : initialProviders))
	const [services, setServices] = useState<MobilityService[]>(() => (isConnected ? [] : initialServices))
	const [transactions, setTransactions] = useState<Transaction[]>(() => (isConnected ? [] : initialTransactions))
	const [vehicles, setVehicles] = useState<Vehicle[]>(() => (isConnected ? [] : initialVehicles))
	const [isLoading, setIsLoading] = useState(isConnected)
	const [loadError, setLoadError] = useState<string | null>(null)

	const applyWorkspace = useCallback((workspace: WorkspacePayload) => {
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
			const [inventory, catalog, ledger] = await Promise.all([
				platformApi.getVehicleInventory(),
				platformApi.getServiceCatalog(),
				platformApi.getExpenseLedger(),
			])
			applyWorkspace({ ...inventory, ...catalog, ...ledger })
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : 'Unable to load the mobility workspace')
		} finally {
			setIsLoading(false)
		}
	}, [applyWorkspace, isConnected])

	useEffect(() => {
		void reloadWorkspace()
	}, [reloadWorkspace])

	async function refreshWorkspace() {
		const [inventory, catalog, ledger] = await Promise.all([
			platformApi.getVehicleInventory(),
			platformApi.getServiceCatalog(),
			platformApi.getExpenseLedger(),
		])
		applyWorkspace({ ...inventory, ...catalog, ...ledger })
	}

	const value = useMemo<WorkspaceState>(
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
				if (hasPlatformApi()) {
					const created = await platformApi.createDriver(driver)
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
				if (!hasPlatformApi()) {
					throw new Error('Driver invitations require the hosted API')
				}
				const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
				await platformApi.inviteDriver(driverId, redirectUrl)
				await refreshWorkspace()
			},
			createVehicle: async (vehicle) => {
				if (hasPlatformApi()) {
					await platformApi.createVehicle(vehicle)
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
				if (hasPlatformApi()) {
					const created = await platformApi.createExpense(transaction)
					setTransactions((current) => [created, ...current])
					return created
				}

				const created: Transaction = {
					...transaction,
					currency: transaction.currency ?? 'EUR',
					id: nextId('transaction'),
					status: 'pending',
				}
				setTransactions((current) => [created, ...current])
				return created
			},
			updateDriver: async (driver) => {
				if (hasPlatformApi()) {
					await platformApi.updateDriver(driver)
					await refreshWorkspace()
					return
				}
				setDrivers((current) => applyDriverAssignment(current, driver))
				setVehicles((current) => applyDriverToVehicles(current, driver))
			},
			updateVehicle: async (vehicle) => {
				if (hasPlatformApi()) {
					await platformApi.updateVehicle(vehicle)
					await refreshWorkspace()
					return
				}
				setDrivers((current) => assignVehicleDriver(current, vehicle))
				setVehicles((current) => current.map((item) => (item.id === vehicle.id ? vehicle : item)))
			},
			updateTransaction: async (transactionId, review) => {
				if (hasPlatformApi()) {
					const updated = await platformApi.reviewExpense(transactionId, review)
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
				if (hasPlatformApi()) {
					const updatedService = await platformApi.toggleService(serviceId)
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

	return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
	const context = useContext(WorkspaceContext)
	if (!context) {
		throw new Error('useWorkspace must be used inside WorkspaceProvider')
	}
	return context
}
