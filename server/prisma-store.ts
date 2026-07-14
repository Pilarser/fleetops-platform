import { providers, services, transactions } from '../src/data/mock-data'
import type {
	Driver,
	DriverStatus,
	MobilityService,
	Vehicle,
	VehicleStatus,
} from '../src/types'
import type { Driver as PrismaDriver, Vehicle as PrismaVehicle } from '../src/generated/prisma/client'
import { prisma } from './prisma'
import type { FleetStore } from './storage'

const companyId = 'demo-company'

function normalizeDriverStatus(status: string): DriverStatus {
	return status === 'suspended' ? 'suspended' : 'active'
}

function normalizeVehicleStatus(status: string): VehicleStatus {
	if (status === 'maintenance' || status === 'inactive') {
		return status
	}
	return 'active'
}

function normalizeFuelType(fuelType: string): Vehicle['fuelType'] {
	const normalized = fuelType.toLowerCase()
	if (normalized === 'diesel' || normalized === 'petrol' || normalized === 'hybrid' || normalized === 'electric') {
		return normalized
	}
	return 'petrol'
}

function mapDriver(driver: PrismaDriver): Driver {
	return {
		id: driver.id,
		name: driver.name,
		email: driver.email,
		status: normalizeDriverStatus(driver.status),
		vehicleId: driver.vehicleId ?? '',
		costCenter: driver.costCenter,
		monthlySpend: driver.monthlySpend,
		personalSpend: driver.personalSpend,
	}
}

function mapVehicle(vehicle: PrismaVehicle, drivers: PrismaDriver[]): Vehicle {
	const assignedDriver = drivers.find((driver) => driver.vehicleId === vehicle.id)
	return {
		id: vehicle.id,
		plate: vehicle.plate,
		make: vehicle.make,
		model: vehicle.model,
		fuelType: normalizeFuelType(vehicle.fuelType),
		status: normalizeVehicleStatus(vehicle.status),
		assignedDriverId: assignedDriver?.id ?? '',
		costCenter: vehicle.costCenter,
		monthlySpend: vehicle.monthlySpend,
		mileageKm: vehicle.mileageKm,
	}
}

async function ensureCompany() {
	await prisma.company.upsert({
		where: { id: companyId },
		update: {},
		create: {
			id: companyId,
			name: 'FleetOps Demo',
		},
	})
}

export function createPrismaFleetStore(): FleetStore {
	let currentServices = structuredClone(services)

	return {
		path: process.env.DATABASE_URL ?? 'file:./dev.db',
		getWorkspace: async () => {
			const [drivers, vehicles] = await Promise.all([
				prisma.driver.findMany({ orderBy: { name: 'asc' }, where: { companyId } }),
				prisma.vehicle.findMany({ orderBy: { plate: 'asc' }, where: { companyId } }),
			])

			return {
				drivers: drivers.map(mapDriver),
				providers: structuredClone(providers),
				services: currentServices,
				transactions: structuredClone(transactions),
				vehicles: vehicles.map((vehicle) => mapVehicle(vehicle, drivers)),
			}
		},
		createDriver: async (driver) => {
			await ensureCompany()
			const createdDriver = await prisma.driver.create({
				data: {
					id: driver.id,
					companyId,
					vehicleId: driver.vehicleId || null,
					name: driver.name,
					email: driver.email,
					status: driver.status,
					costCenter: driver.costCenter,
					monthlySpend: driver.monthlySpend,
					personalSpend: driver.personalSpend,
				},
			})
			return mapDriver(createdDriver)
		},
		createVehicle: async (vehicle) => {
			await ensureCompany()
			const createdVehicle = await prisma.vehicle.create({
				data: {
					id: vehicle.id,
					companyId,
					plate: vehicle.plate,
					make: vehicle.make,
					model: vehicle.model,
					fuelType: vehicle.fuelType,
					status: vehicle.status,
					costCenter: vehicle.costCenter,
					monthlySpend: vehicle.monthlySpend,
					mileageKm: vehicle.mileageKm,
				},
			})

			if (vehicle.assignedDriverId) {
				await prisma.driver.update({
					where: { id: vehicle.assignedDriverId },
					data: { vehicleId: createdVehicle.id },
				})
			}

			const drivers = await prisma.driver.findMany({ where: { companyId } })
			return mapVehicle(createdVehicle, drivers)
		},
		toggleService: async (serviceId: MobilityService['id']) => {
			let updatedService: MobilityService | undefined
			currentServices = currentServices.map((service) => {
				if (service.id !== serviceId) {
					return service
				}
				updatedService = { ...service, enabled: !service.enabled }
				return updatedService
			})
			return updatedService
		},
		updateDriver: async (driver) => {
			try {
				const updatedDriver = await prisma.driver.update({
					where: { id: driver.id },
					data: {
						vehicleId: driver.vehicleId || null,
						name: driver.name,
						email: driver.email,
						status: driver.status,
						costCenter: driver.costCenter,
						monthlySpend: driver.monthlySpend,
						personalSpend: driver.personalSpend,
					},
				})
				return mapDriver(updatedDriver)
			} catch {
				return undefined
			}
		},
		updateVehicle: async (vehicle) => {
			try {
				const updatedVehicle = await prisma.vehicle.update({
					where: { id: vehicle.id },
					data: {
						plate: vehicle.plate,
						make: vehicle.make,
						model: vehicle.model,
						fuelType: vehicle.fuelType,
						status: vehicle.status,
						costCenter: vehicle.costCenter,
						monthlySpend: vehicle.monthlySpend,
						mileageKm: vehicle.mileageKm,
					},
				})

				await prisma.driver.updateMany({
					where: { vehicleId: vehicle.id },
					data: { vehicleId: null },
				})

				if (vehicle.assignedDriverId) {
					await prisma.driver.update({
						where: { id: vehicle.assignedDriverId },
						data: { vehicleId: vehicle.id },
					})
				}

				const drivers = await prisma.driver.findMany({ where: { companyId } })
				return mapVehicle(updatedVehicle, drivers)
			} catch {
				return undefined
			}
		},
	}
}
