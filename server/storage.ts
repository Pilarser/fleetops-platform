import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { providers, transactions } from '../src/data/mock-data'
import { drivers as seedDrivers, services as seedServices, vehicles as seedVehicles } from '../src/data/mock-data'
import type { Driver, DriverWorkspace, MobilityService, ProviderLocation, Transaction, Vehicle } from '../src/types'

export interface FleetDatabase {
	drivers: Driver[]
	providers: ProviderLocation[]
	services: MobilityService[]
	transactions: Transaction[]
	vehicles: Vehicle[]
}

export interface FleetStore {
	path: string
	getWorkspace: () => Promise<FleetDatabase>
	getDriverWorkspace: (userId: string) => Promise<DriverWorkspace | undefined>
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
		return JSON.parse(raw) as FleetDatabase
	} catch {
		const database = seedDatabase()
		writeDatabase(databasePath, database)
		return database
	}
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

export function createFleetStore(path = resolve(process.env.FLEET_DB_PATH ?? 'server/.data/fleet-db.json')) {
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
