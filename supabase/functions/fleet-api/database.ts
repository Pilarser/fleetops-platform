import postgres, { type TransactionSql } from 'postgres'
import { ApiError } from './http.ts'

export const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
	max: 1,
	prepare: false,
})

type DbDriver = {
	id: string
	name: string
	email: string
	status: string
	vehicleId: string | null
	costCenter: string
	monthlySpend: number
	personalSpend: number
}

type DbVehicle = {
	id: string
	plate: string
	make: string
	model: string
	fuelType: string
	status: string
	costCenter: string
	monthlySpend: number
	mileageKm: number
}

type DriverPayload = {
	name: string
	email: string
	status: 'active' | 'suspended'
	vehicleId: string
	costCenter: string
}

type VehiclePayload = {
	plate: string
	make: string
	model: string
	fuelType: 'diesel' | 'petrol' | 'hybrid' | 'electric'
	status: 'active' | 'maintenance' | 'inactive'
	assignedDriverId: string
	costCenter: string
	mileageKm: number
}

type DbTransaction = {
	id: string
	date: string
	driverId: string
	vehicleId: string
	service: string
	provider: string
	amount: number
	vat: number
	status: string
	expenseType: string
	reviewedById: string | null
	reviewedByName: string | null
	reviewedAt: Date | string | null
	rejectionReason: string | null
}

type TransactionPayload = {
	date: string
	driverId: string
	vehicleId: string
	service: string
	provider: string
	amount: number
	vat: number
	expenseType: 'business' | 'personal'
}

type TransactionReview = {
	status: 'approved' | 'rejected'
	expenseType: 'business' | 'personal'
	rejectionReason?: string
}

type TransactionReviewer = {
	id: string
	name: string
}

export function mapDriver(driver: DbDriver) {
	return {
		id: driver.id,
		name: driver.name,
		email: driver.email,
		status: driver.status === 'suspended' ? 'suspended' : 'active',
		vehicleId: driver.vehicleId ?? '',
		costCenter: driver.costCenter,
		monthlySpend: Number(driver.monthlySpend),
		personalSpend: Number(driver.personalSpend),
	}
}

function mapVehicle(vehicle: DbVehicle, drivers: DbDriver[]) {
	return {
		id: vehicle.id,
		plate: vehicle.plate,
		make: vehicle.make,
		model: vehicle.model,
		fuelType: vehicle.fuelType,
		status: vehicle.status,
		assignedDriverId: drivers.find((driver) => driver.vehicleId === vehicle.id)?.id ?? '',
		costCenter: vehicle.costCenter,
		monthlySpend: Number(vehicle.monthlySpend),
		mileageKm: vehicle.mileageKm,
	}
}

function mapTransaction(transaction: DbTransaction) {
	return {
		...transaction,
		amount: Number(transaction.amount),
		vat: Number(transaction.vat),
		reviewedAt:
			transaction.reviewedAt instanceof Date ? transaction.reviewedAt.toISOString() : transaction.reviewedAt,
	}
}

export async function getWorkspace(companyId: string) {
	const [drivers, providers, services, transactions, vehicles] = await Promise.all([
		sql<
			DbDriver[]
		>`select id, name, email, status, "vehicleId", "costCenter", "monthlySpend", "personalSpend" from "Driver" where "companyId" = ${companyId} order by name asc`,
		sql`select id, name, service, address, city, "distanceKm", status from "ProviderLocation" where "companyId" = ${companyId} order by name asc`,
		sql`select type as id, name, description, enabled, "monthlyLimit", "requiresApproval" from "MobilityService" where "companyId" = ${companyId} order by name asc`,
		sql<DbTransaction[]>`select id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason" from "FleetTransaction" where "companyId" = ${companyId} order by date desc`,
		sql<
			DbVehicle[]
		>`select id, plate, make, model, "fuelType", status, "costCenter", "monthlySpend", "mileageKm" from "Vehicle" where "companyId" = ${companyId} order by plate asc`,
	])

	return {
		drivers: drivers.map(mapDriver),
		providers: providers.map((provider) => ({ ...provider, distanceKm: Number(provider.distanceKm) })),
		services: services.map((service) => ({ ...service, monthlyLimit: Number(service.monthlyLimit) })),
		transactions: transactions.map(mapTransaction),
		vehicles: vehicles.map((vehicle) => mapVehicle(vehicle, drivers)),
	}
}

export async function getTeam(companyId: string) {
	const members = await sql`
		select id, name, email, role, status
		from "User"
		where "companyId" = ${companyId}
		order by case when role = 'fleet_admin' then 0 else 1 end, name asc
	`
	return members.map((member) => ({
		...member,
		status: member.status === 'invited' ? 'invited' : 'active',
	}))
}

async function ensureVehicleBelongsToCompany(transaction: TransactionSql, vehicleId: string, companyId: string) {
	if (!vehicleId) {
		return
	}
	const [vehicle] = await transaction`select id from "Vehicle" where id = ${vehicleId} and "companyId" = ${companyId}`
	if (!vehicle) {
		throw new ApiError(400, 'Assigned vehicle does not exist')
	}
}

async function ensureDriverBelongsToCompany(transaction: TransactionSql, driverId: string, companyId: string) {
	if (!driverId) {
		return
	}
	const [driver] = await transaction`select id from "Driver" where id = ${driverId} and "companyId" = ${companyId}`
	if (!driver) {
		throw new ApiError(400, 'Assigned driver does not exist')
	}
}

export async function createDriver(companyId: string, payload: DriverPayload) {
	return sql.begin(async (transaction) => {
		await ensureVehicleBelongsToCompany(transaction, payload.vehicleId, companyId)
		if (payload.vehicleId) {
			await transaction`update "Driver" set "vehicleId" = null, "updatedAt" = now() where "companyId" = ${companyId} and "vehicleId" = ${payload.vehicleId}`
		}
		const id = `driver-${crypto.randomUUID()}`
		const [driver] = await transaction<DbDriver[]>`
			insert into "Driver" (id, "companyId", "vehicleId", name, email, status, "costCenter", "monthlySpend", "personalSpend", "createdAt", "updatedAt")
			values (${id}, ${companyId}, ${
			payload.vehicleId || null
		}, ${payload.name}, ${payload.email}, ${payload.status}, ${payload.costCenter}, 0, 0, now(), now())
			returning id, name, email, status, "vehicleId", "costCenter", "monthlySpend", "personalSpend"
		`
		return mapDriver(driver)
	})
}

export async function updateDriver(companyId: string, driverId: string, payload: DriverPayload) {
	return sql.begin(async (transaction) => {
		await ensureVehicleBelongsToCompany(transaction, payload.vehicleId, companyId)
		if (payload.vehicleId) {
			await transaction`update "Driver" set "vehicleId" = null, "updatedAt" = now() where "companyId" = ${companyId} and id <> ${driverId} and "vehicleId" = ${payload.vehicleId}`
		}
		const [driver] = await transaction<DbDriver[]>`
			update "Driver"
			set "vehicleId" = ${
			payload.vehicleId || null
		}, name = ${payload.name}, email = ${payload.email}, status = ${payload.status}, "costCenter" = ${payload.costCenter}, "updatedAt" = now()
			where id = ${driverId} and "companyId" = ${companyId}
			returning id, name, email, status, "vehicleId", "costCenter", "monthlySpend", "personalSpend"
		`
		if (!driver) {
			throw new ApiError(404, 'Driver not found')
		}
		return mapDriver(driver)
	})
}

export async function createVehicle(companyId: string, payload: VehiclePayload) {
	return sql.begin(async (transaction) => {
		await ensureDriverBelongsToCompany(transaction, payload.assignedDriverId, companyId)
		const id = `vehicle-${crypto.randomUUID()}`
		const [vehicle] = await transaction<DbVehicle[]>`
			insert into "Vehicle" (id, "companyId", plate, make, model, "fuelType", status, "costCenter", "monthlySpend", "mileageKm", "createdAt", "updatedAt")
			values (${id}, ${companyId}, ${payload.plate}, ${payload.make}, ${payload.model}, ${payload.fuelType}, ${payload.status}, ${payload.costCenter}, 0, ${payload.mileageKm}, now(), now())
			returning id, plate, make, model, "fuelType", status, "costCenter", "monthlySpend", "mileageKm"
		`
		if (payload.assignedDriverId) {
			await transaction`update "Driver" set "vehicleId" = ${id}, "updatedAt" = now() where id = ${payload.assignedDriverId} and "companyId" = ${companyId}`
		}
		const drivers = await transaction<DbDriver[]>`select id, "vehicleId" from "Driver" where "companyId" = ${companyId}`
		return mapVehicle(vehicle, drivers)
	})
}

export async function updateVehicle(companyId: string, vehicleId: string, payload: VehiclePayload) {
	return sql.begin(async (transaction) => {
		await ensureDriverBelongsToCompany(transaction, payload.assignedDriverId, companyId)
		const [vehicle] = await transaction<DbVehicle[]>`
			update "Vehicle"
			set plate = ${payload.plate}, make = ${payload.make}, model = ${payload.model}, "fuelType" = ${payload.fuelType}, status = ${payload.status}, "costCenter" = ${payload.costCenter}, "mileageKm" = ${payload.mileageKm}, "updatedAt" = now()
			where id = ${vehicleId} and "companyId" = ${companyId}
			returning id, plate, make, model, "fuelType", status, "costCenter", "monthlySpend", "mileageKm"
		`
		if (!vehicle) {
			throw new ApiError(404, 'Vehicle not found')
		}
		await transaction`update "Driver" set "vehicleId" = null, "updatedAt" = now() where "companyId" = ${companyId} and "vehicleId" = ${vehicleId}`
		if (payload.assignedDriverId) {
			await transaction`update "Driver" set "vehicleId" = ${vehicleId}, "updatedAt" = now() where id = ${payload.assignedDriverId} and "companyId" = ${companyId}`
		}
		const drivers = await transaction<DbDriver[]>`select id, "vehicleId" from "Driver" where "companyId" = ${companyId}`
		return mapVehicle(vehicle, drivers)
	})
}

export async function toggleService(companyId: string, serviceId: string) {
	const [service] = await sql`
		update "MobilityService"
		set enabled = not enabled, "updatedAt" = now()
		where type = ${serviceId} and "companyId" = ${companyId}
		returning type as id, name, description, enabled, "monthlyLimit", "requiresApproval"
	`
	if (!service) {
		throw new ApiError(404, 'Service not found')
	}
	return { ...service, monthlyLimit: Number(service.monthlyLimit) }
}

export async function createTransaction(companyId: string, payload: TransactionPayload) {
	return sql.begin(async (transaction) => {
		await ensureDriverBelongsToCompany(transaction, payload.driverId, companyId)
		await ensureVehicleBelongsToCompany(transaction, payload.vehicleId, companyId)

		const [service] = await transaction`
			select type, enabled from "MobilityService"
			where type = ${payload.service} and "companyId" = ${companyId}
		`
		if (!service) {
			throw new ApiError(400, 'Mobility service does not exist')
		}
		if (!service.enabled) {
			throw new ApiError(400, 'Mobility service is disabled')
		}

		const id = `transaction-${crypto.randomUUID()}`
		const [created] = await transaction<DbTransaction[]>`
			insert into "FleetTransaction" (id, "companyId", date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "createdAt", "updatedAt")
			values (${id}, ${companyId}, ${payload.date}, ${payload.driverId}, ${payload.vehicleId}, ${payload.service}, ${payload.provider}, ${payload.amount}, ${payload.vat}, 'pending', ${payload.expenseType}, now(), now())
			returning id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason"
		`
		return mapTransaction(created)
	})
}

export async function updateTransaction(
	companyId: string,
	transactionId: string,
	payload: TransactionReview,
	reviewer: TransactionReviewer,
) {
	const [updated] = await sql<DbTransaction[]>`
		update "FleetTransaction"
		set status = ${payload.status},
			"expenseType" = ${payload.expenseType},
			"reviewedById" = ${reviewer.id},
			"reviewedByName" = ${reviewer.name},
			"reviewedAt" = now(),
			"rejectionReason" = ${payload.status === 'rejected' ? payload.rejectionReason ?? null : null},
			"updatedAt" = now()
		where id = ${transactionId} and "companyId" = ${companyId}
		returning id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason"
	`
	if (!updated) {
		throw new ApiError(404, 'Transaction not found')
	}
	return mapTransaction(updated)
}
