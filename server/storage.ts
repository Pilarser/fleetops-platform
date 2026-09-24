import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { providers, transactions } from '../src/data/mock-data'
import { drivers as seedDrivers, services as seedServices, vehicles as seedVehicles } from '../src/data/mock-data'
import type { Driver, DriverWorkspace, MobilityService, Notification, ProviderLocation, Transaction, TransactionEvent, Vehicle } from '../src/types'
import { applyDriverAssignment, applyDriverToVehicles, assignVehicleDriver } from '../shared/domain/fleet'

export interface FleetDatabase {
	drivers: Driver[]
	providers: ProviderLocation[]
	services: MobilityService[]
	transactions: Transaction[]
	transactionEvents: TransactionEvent[]
	notifications: Array<Notification & { userId: string }>
	vehicles: Vehicle[]
}

export interface FleetStore {
	path: string
	getWorkspace: () => Promise<FleetDatabase>
	getDriverWorkspace: (userId: string) => Promise<DriverWorkspace | undefined>
	getTransactionEvents: (transactionId: string) => Promise<TransactionEvent[]>
	appendTransactionEvent: (event: TransactionEvent) => Promise<TransactionEvent>
	getNotifications: (userId: string) => Promise<Notification[]>
	createNotifications: (notifications: Array<Notification & { userId: string }>) => Promise<void>
	markNotificationRead: (userId: string, notificationId: string) => Promise<Notification | undefined>
	markAllNotificationsRead: (userId: string) => Promise<void>
	createDriver: (driver: Driver) => Promise<Driver>
	createTransaction: (transaction: Transaction) => Promise<Transaction>
	createVehicle: (vehicle: Vehicle) => Promise<Vehicle>
	toggleService: (serviceId: MobilityService['id']) => Promise<MobilityService | undefined>
	updateDriver: (driver: Driver) => Promise<Driver | undefined>
	updateTransaction: (transaction: Transaction) => Promise<Transaction | undefined>
	updateVehicle: (vehicle: Vehicle) => Promise<Vehicle | undefined>
}

function seedDatabase(): FleetDatabase {
	return {
		drivers: structuredClone(seedDrivers),
		providers: structuredClone(providers),
		services: structuredClone(seedServices),
		transactions: structuredClone(transactions),
		transactionEvents: [],
		notifications: [],
		vehicles: structuredClone(seedVehicles),
	}
}

function writeDatabase(databasePath: string, database: FleetDatabase) {
	mkdirSync(dirname(databasePath), { recursive: true })
	writeFileSync(databasePath, JSON.stringify(database, null, 2))
}

function readDatabase(databasePath: string) {
	try {
		const raw = readFileSync(databasePath, 'utf8')
		const database = JSON.parse(raw) as FleetDatabase
		return {
			...database,
			services: database.services.map((service) => ({ ...service, currency: service.currency ?? 'EUR' })),
			transactions: database.transactions.map((expense) => ({ ...expense, currency: expense.currency ?? 'EUR' })),
			transactionEvents: database.transactionEvents ?? [],
			notifications: database.notifications ?? [],
		}
	} catch {
		const database = seedDatabase()
		writeDatabase(databasePath, database)
		return database
	}
}

export function createFleetStore(path = resolve(process.env.ONEMOBILITY_DB_PATH ?? process.env.FLEET_DB_PATH ?? 'server/.data/onemobility-db.json')) {
	let database = readDatabase(path)

	return {
		path,
		getWorkspace: async () => database,
		getDriverWorkspace: async (userId: string) => {
			const driver = database.drivers.find((item) => item.id === (userId === 'user-driver' ? 'driver-1' : userId))
			if (!driver) return undefined
			return {
				driver,
				vehicle: database.vehicles.find((vehicle) => vehicle.id === driver.vehicleId) ?? null,
				services: database.services.filter((service) => service.enabled),
				transactions: database.transactions.filter((transaction) => transaction.driverId === driver.id),
			}
		},
		getTransactionEvents: async (transactionId: string) => database.transactionEvents
			.filter((event) => event.transactionId === transactionId)
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
		appendTransactionEvent: async (event: TransactionEvent) => {
			database = { ...database, transactionEvents: [event, ...database.transactionEvents] }
			writeDatabase(path, database)
			return event
		},
		getNotifications: async (userId: string) => database.notifications
			.filter((notification) => notification.userId === userId)
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
		createNotifications: async (notifications: Array<Notification & { userId: string }>) => {
			database = { ...database, notifications: [...notifications, ...database.notifications] }
			writeDatabase(path, database)
		},
		markNotificationRead: async (userId: string, notificationId: string) => {
			let updated: (Notification & { userId: string }) | undefined
			database = {
				...database,
				notifications: database.notifications.map((notification) => {
					if (notification.id !== notificationId || notification.userId !== userId) return notification
					updated = { ...notification, readAt: notification.readAt ?? new Date().toISOString() }
					return updated
				}),
			}
			writeDatabase(path, database)
			return updated
		},
		markAllNotificationsRead: async (userId: string) => {
			const readAt = new Date().toISOString()
			database = { ...database, notifications: database.notifications.map((notification) =>
				notification.userId === userId && !notification.readAt ? { ...notification, readAt } : notification) }
			writeDatabase(path, database)
		},
		createDriver: async (driver: Driver) => {
			database = {
				...database,
				drivers: applyDriverAssignment([...database.drivers, driver], driver),
				vehicles: applyDriverToVehicles(database.vehicles, driver),
			}
			writeDatabase(path, database)
			return driver
		},
		createTransaction: async (transaction: Transaction) => {
			database = { ...database, transactions: [transaction, ...database.transactions] }
			writeDatabase(path, database)
			return transaction
		},
		createVehicle: async (vehicle: Vehicle) => {
			database = {
				...database,
				drivers: assignVehicleDriver(database.drivers, vehicle),
				vehicles: [...database.vehicles, vehicle],
			}
			writeDatabase(path, database)
			return vehicle
		},
		toggleService: async (serviceId: MobilityService['id']) => {
			let updatedService: MobilityService | undefined
			database = {
				...database,
				services: database.services.map((service) => {
					if (service.id !== serviceId) {
						return service
					}
					updatedService = { ...service, enabled: !service.enabled }
					return updatedService
				}),
			}
			writeDatabase(path, database)
			return updatedService
		},
		updateDriver: async (driver: Driver) => {
			let updatedDriver: Driver | undefined
			database = {
				...database,
				drivers: applyDriverAssignment(database.drivers.map((item) => {
					if (item.id !== driver.id) {
						return item
					}
					updatedDriver = driver
					return driver
				}), driver),
				vehicles: applyDriverToVehicles(database.vehicles, driver),
			}
			writeDatabase(path, database)
			return updatedDriver
		},
		updateTransaction: async (transaction: Transaction) => {
			let updatedTransaction: Transaction | undefined
			database = {
				...database,
				transactions: database.transactions.map((item) => {
					if (item.id !== transaction.id) {
						return item
					}
					updatedTransaction = transaction
					return transaction
				}),
			}
			writeDatabase(path, database)
			return updatedTransaction
		},
		updateVehicle: async (vehicle: Vehicle) => {
			let updatedVehicle: Vehicle | undefined
			database = {
				...database,
				drivers: assignVehicleDriver(database.drivers, vehicle),
				vehicles: database.vehicles.map((item) => {
					if (item.id !== vehicle.id) {
						return item
					}
					updatedVehicle = vehicle
					return vehicle
				}),
			}
			writeDatabase(path, database)
			return updatedVehicle
		},
	} satisfies FleetStore
}
