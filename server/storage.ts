import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { providers, transactions } from '../src/data/mock-data'
import { drivers as seedDrivers, services as seedServices, vehicles as seedVehicles } from '../src/data/mock-data'
import type { Driver, MobilityService, ProviderLocation, Transaction, Vehicle } from '../src/types'

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
	createDriver: (driver: Driver) => Promise<Driver>
	createVehicle: (vehicle: Vehicle) => Promise<Vehicle>
	toggleService: (serviceId: MobilityService['id']) => Promise<MobilityService | undefined>
	updateDriver: (driver: Driver) => Promise<Driver | undefined>
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

export function createFleetStore(path = resolve(process.env.FLEET_DB_PATH ?? 'server/.data/fleet-db.json')) {
	let database = readDatabase(path)

	return {
		path,
		getWorkspace: async () => database,
		createDriver: async (driver: Driver) => {
			database = {
				...database,
				drivers: [...database.drivers, driver],
			}
			writeDatabase(path, database)
			return driver
		},
		createVehicle: async (vehicle: Vehicle) => {
			database = {
				...database,
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
				drivers: database.drivers.map((item) => {
					if (item.id !== driver.id) {
						return item
					}
					updatedDriver = driver
					return driver
				}),
			}
			writeDatabase(path, database)
			return updatedDriver
		},
		updateVehicle: async (vehicle: Vehicle) => {
			let updatedVehicle: Vehicle | undefined
			database = {
				...database,
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
