import type {
	Driver,
	DriverStatus,
	ProviderLocation,
	MobilityService,
	ServiceType,
	Transaction,
	TransactionStatus,
	Vehicle,
	VehicleStatus,
} from '../src/types'
import type {
	Driver as PrismaDriver,
	FleetTransaction as PrismaFleetTransaction,
	MobilityService as PrismaMobilityService,
	ProviderLocation as PrismaProviderLocation,
	Vehicle as PrismaVehicle,
} from '../src/generated/prisma/client'
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

function normalizeServiceType(service: string): ServiceType {
	if (
		service === 'fuel' ||
		service === 'charging' ||
		service === 'parking' ||
		service === 'fines' ||
		service === 'wash' ||
		service === 'tolls' ||
		service === 'area_c' ||
		service === 'taxi'
	) {
		return service
	}
	return 'fuel'
}

function normalizeTransactionStatus(status: string): TransactionStatus {
	if (status === 'pending' || status === 'rejected') {
		return status
	}
	return 'approved'
}

function normalizeExpenseType(expenseType: string): Transaction['expenseType'] {
	return expenseType === 'personal' ? 'personal' : 'business'
}

function normalizeProviderStatus(status: string): ProviderLocation['status'] {
	if (status === 'limited' || status === 'offline') {
		return status
	}
	return 'online'
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

function mapService(service: PrismaMobilityService): MobilityService {
	return {
		id: normalizeServiceType(service.type),
		name: service.name,
		description: service.description,
		enabled: service.enabled,
		monthlyLimit: service.monthlyLimit,
		requiresApproval: service.requiresApproval,
	}
}

function mapProvider(provider: PrismaProviderLocation): ProviderLocation {
	return {
		id: provider.id,
		name: provider.name,
		service: normalizeServiceType(provider.service),
		address: provider.address,
		city: provider.city,
		distanceKm: provider.distanceKm,
		status: normalizeProviderStatus(provider.status),
	}
}

function mapTransaction(transaction: PrismaFleetTransaction): Transaction {
	return {
		id: transaction.id,
		date: transaction.date,
		driverId: transaction.driverId,
		vehicleId: transaction.vehicleId,
		service: normalizeServiceType(transaction.service),
		provider: transaction.provider,
		amount: transaction.amount,
		vat: transaction.vat,
		status: normalizeTransactionStatus(transaction.status),
		expenseType: normalizeExpenseType(transaction.expenseType),
		reviewedById: transaction.reviewedById,
		reviewedByName: transaction.reviewedByName,
		reviewedAt: transaction.reviewedAt?.toISOString() ?? null,
		rejectionReason: transaction.rejectionReason,
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
	return {
		path: process.env.DATABASE_URL ?? 'postgresql://fleetops:fleetops@localhost:55433/fleetops',
		getWorkspace: async () => {
			const [drivers, providers, services, transactions, vehicles] = await Promise.all([
				prisma.driver.findMany({ orderBy: { name: 'asc' }, where: { companyId } }),
				prisma.providerLocation.findMany({ orderBy: { name: 'asc' }, where: { companyId } }),
				prisma.mobilityService.findMany({ orderBy: { name: 'asc' }, where: { companyId } }),
				prisma.fleetTransaction.findMany({ orderBy: { date: 'desc' }, where: { companyId } }),
				prisma.vehicle.findMany({ orderBy: { plate: 'asc' }, where: { companyId } }),
			])

			return {
				drivers: drivers.map(mapDriver),
				providers: providers.map(mapProvider),
				services: services.map(mapService),
				transactions: transactions.map(mapTransaction),
				vehicles: vehicles.map((vehicle) => mapVehicle(vehicle, drivers)),
			}
		},
		getDriverWorkspace: async (userId) => {
			const driver = await prisma.driver.findFirst({ where: { companyId, userId } })
			if (!driver) return undefined
			const [vehicle, transactions] = await Promise.all([
				driver.vehicleId ? prisma.vehicle.findFirst({ where: { companyId, id: driver.vehicleId } }) : null,
				prisma.fleetTransaction.findMany({ orderBy: { date: 'desc' }, where: { companyId, driverId: driver.id } }),
			])
			return {
				driver: mapDriver(driver),
				vehicle: vehicle ? mapVehicle(vehicle, [driver]) : null,
				transactions: transactions.map(mapTransaction),
			}
		},
		createDriver: async (driver) => {
			await ensureCompany()
			const createdDriver = await prisma.$transaction(async (tx) => {
				if (driver.vehicleId) {
					await tx.driver.updateMany({
						where: {
							companyId,
							vehicleId: driver.vehicleId,
						},
						data: { vehicleId: null },
					})
				}

				return tx.driver.create({
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
			})
			return mapDriver(createdDriver)
		},
		createTransaction: async (transaction) => {
			const createdTransaction = await prisma.fleetTransaction.create({
				data: {
					id: transaction.id,
					companyId,
					date: transaction.date,
					driverId: transaction.driverId,
					vehicleId: transaction.vehicleId,
					service: transaction.service,
					provider: transaction.provider,
					amount: transaction.amount,
					vat: transaction.vat,
					status: transaction.status,
					expenseType: transaction.expenseType,
					reviewedById: transaction.reviewedById,
					reviewedByName: transaction.reviewedByName,
					reviewedAt: transaction.reviewedAt ? new Date(transaction.reviewedAt) : null,
					rejectionReason: transaction.rejectionReason,
				},
			})
			return mapTransaction(createdTransaction)
		},
		createVehicle: async (vehicle) => {
			await ensureCompany()
			const createdVehicle = await prisma.$transaction(async (tx) => {
				const vehicleRecord = await tx.vehicle.create({
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
					await tx.driver.update({
						where: { id: vehicle.assignedDriverId },
						data: { vehicleId: vehicleRecord.id },
					})
				}

				return vehicleRecord
			})

			const drivers = await prisma.driver.findMany({ where: { companyId } })
			return mapVehicle(createdVehicle, drivers)
		},
		toggleService: async (serviceId: MobilityService['id']) => {
			const currentService = await prisma.mobilityService.findUnique({
				where: { companyId_type: { companyId, type: serviceId } },
			})
			if (!currentService) {
				return undefined
			}
			const updatedService = await prisma.mobilityService.update({
				where: { companyId_type: { companyId, type: serviceId } },
				data: { enabled: !currentService.enabled },
			})
			return mapService(updatedService)
		},
		updateDriver: async (driver) => {
			try {
				const updatedDriver = await prisma.$transaction(async (tx) => {
					if (driver.vehicleId) {
						await tx.driver.updateMany({
							where: {
								companyId,
								id: { not: driver.id },
								vehicleId: driver.vehicleId,
							},
							data: { vehicleId: null },
						})
					}

					return tx.driver.update({
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
				})
				return mapDriver(updatedDriver)
			} catch {
				return undefined
			}
		},
		updateTransaction: async (transaction) => {
			try {
				const updatedTransaction = await prisma.fleetTransaction.update({
					where: { id: transaction.id },
					data: {
						status: transaction.status,
						expenseType: transaction.expenseType,
						reviewedById: transaction.reviewedById,
						reviewedByName: transaction.reviewedByName,
						reviewedAt: transaction.reviewedAt ? new Date(transaction.reviewedAt) : null,
						rejectionReason: transaction.rejectionReason,
					},
				})
				return mapTransaction(updatedTransaction)
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
