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
	accountStatus?: string
	accountUserId?: string | null
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
	receiptPath: string | null
	receiptName: string | null
	receiptMimeType: string | null
	receiptSize: number | null
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

type DriverTransactionPayload = Omit<TransactionPayload, 'driverId' | 'vehicleId'>

type TransactionReview = {
	status: 'approved' | 'rejected'
	expenseType: 'business' | 'personal'
	rejectionReason?: string
}

type TransactionReviewer = {
	id: string
	name: string
	role: string
}

type TransactionActor = TransactionReviewer

type DbTransactionEvent = {
	id: string
	transactionId: string
	type: string
	actorId: string
	actorName: string
	actorRole: string
	details: Record<string, unknown> | string
	createdAt: Date | string
}

type DbNotification = {
	id: string
	transactionId: string | null
	type: string
	title: string
	message: string
	readAt: Date | string | null
	createdAt: Date | string
}

async function notifyReviewers(
	transaction: TransactionSql,
	companyId: string,
	transactionId: string,
	excludeUserId: string,
	message: string,
) {
	await transaction`
		insert into "Notification" (id, "companyId", "userId", "transactionId", type, title, message, "createdAt")
		select 'notification-' || gen_random_uuid()::text, ${companyId}, u.id, ${transactionId}, 'expense_submitted',
			'Expense awaiting review', ${message}, now()
		from "User" u
		where u."companyId" = ${companyId} and u.status = 'active'
			and u.role in ('fleet_admin', 'manager', 'finance') and u.id <> ${excludeUserId}
	`
}

async function notifyDriver(
	transaction: TransactionSql,
	companyId: string,
	transactionId: string,
	type: 'expense_approved' | 'expense_rejected',
	message: string,
) {
	await transaction`
		insert into "Notification" (id, "companyId", "userId", "transactionId", type, title, message, "createdAt")
		select 'notification-' || gen_random_uuid()::text, ${companyId}, u.id, ${transactionId}, ${type},
			${type === 'expense_approved' ? 'Expense approved' : 'Expense rejected'}, ${message}, now()
		from "FleetTransaction" ft
		join "Driver" d on d.id = ft."driverId" and d."companyId" = ft."companyId"
		join "User" u on u.id = d."userId" and u.status = 'active'
		where ft.id = ${transactionId} and ft."companyId" = ${companyId}
	`
}

async function appendTransactionEvent(
	transaction: TransactionSql,
	companyId: string,
	transactionId: string,
	actor: TransactionActor,
	type: string,
	details: Record<string, unknown>,
) {
	await transaction`
		insert into "TransactionEvent" (id, "companyId", "transactionId", type, "actorId", "actorName", "actorRole", details, "createdAt")
		values (${`event-${crypto.randomUUID()}`}, ${companyId}, ${transactionId}, ${type}, ${actor.id}, ${actor.name}, ${actor.role}, ${transaction.json(details)}, now())
	`
}

function transactionChanges(before: DbTransaction, after: DbTransaction) {
	const fields = ['date', 'service', 'provider', 'amount', 'vat', 'expenseType'] as const
	return Object.fromEntries(fields
		.filter((field) => String(before[field]) !== String(after[field]))
		.map((field) => [field, { from: before[field], to: after[field] }]))
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
		accountStatus:
			driver.accountStatus === 'active' || driver.accountStatus === 'invited' || driver.accountStatus === 'disabled'
				? driver.accountStatus
				: 'not_invited',
		accountUserId: driver.accountUserId ?? undefined,
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
	const { receiptPath: _receiptPath, ...visibleTransaction } = transaction
	return {
		...visibleTransaction,
		amount: Number(transaction.amount),
		vat: Number(transaction.vat),
		reviewedAt:
			transaction.reviewedAt instanceof Date ? transaction.reviewedAt.toISOString() : transaction.reviewedAt,
	}
}

export async function getWorkspace(companyId: string) {
	const [drivers, providers, services, transactions, vehicles] = await Promise.all([
		sql<DbDriver[]>`
			select d.id, d.name, d.email, d.status, d."vehicleId", d."costCenter", d."monthlySpend", d."personalSpend",
				case when u.id is null then 'not_invited' else u.status end as "accountStatus", u.id as "accountUserId"
			from "Driver" d
			left join "User" u on u.id = d."userId"
			where d."companyId" = ${companyId}
			order by d.name asc
		`,
		sql`select id, name, service, address, city, "distanceKm", status from "ProviderLocation" where "companyId" = ${companyId} order by name asc`,
		sql`select type as id, name, description, enabled, "monthlyLimit", "requiresApproval" from "MobilityService" where "companyId" = ${companyId} order by name asc`,
		sql<DbTransaction[]>`select id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason", "receiptPath", "receiptName", "receiptMimeType", "receiptSize" from "FleetTransaction" where "companyId" = ${companyId} order by date desc`,
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

export async function getDriverWorkspace(companyId: string, userId: string) {
	const [driver] = await sql<DbDriver[]>`
		select d.id, d.name, d.email, d.status, d."vehicleId", d."costCenter", d."monthlySpend", d."personalSpend",
			u.status as "accountStatus", u.id as "accountUserId"
		from "Driver" d
		join "User" u on u.id = d."userId"
		where d."companyId" = ${companyId} and d."userId" = ${userId}
		limit 1
	`
	if (!driver) {
		throw new ApiError(404, 'Driver profile not found')
	}

	const [vehicles, services, transactions] = await Promise.all([
		driver.vehicleId
			? sql<DbVehicle[]>`select id, plate, make, model, "fuelType", status, "costCenter", "monthlySpend", "mileageKm" from "Vehicle" where id = ${driver.vehicleId} and "companyId" = ${companyId}`
			: Promise.resolve([] as DbVehicle[]),
		sql`select type as id, name, description, enabled, "monthlyLimit", "requiresApproval" from "MobilityService" where "companyId" = ${companyId} and enabled = true order by name asc`,
		sql<DbTransaction[]>`
			select id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason", "receiptPath", "receiptName", "receiptMimeType", "receiptSize"
			from "FleetTransaction"
			where "companyId" = ${companyId} and "driverId" = ${driver.id}
			order by date desc
		`,
	])

	return {
		driver: mapDriver(driver),
		vehicle: vehicles[0] ? mapVehicle(vehicles[0], [driver]) : null,
		services: services.map((service) => ({ ...service, monthlyLimit: Number(service.monthlyLimit) })),
		transactions: transactions.map(mapTransaction),
	}
}

async function driverSubmissionContext(transaction: TransactionSql, companyId: string, userId: string) {
	const [driver] = await transaction<{ id: string; status: string; vehicleId: string | null }[]>`
		select id, status, "vehicleId" from "Driver"
		where "companyId" = ${companyId} and "userId" = ${userId}
		limit 1
	`
	if (!driver) throw new ApiError(404, 'Driver profile not found')
	if (driver.status !== 'active') throw new ApiError(409, 'Your driver profile is suspended')
	if (!driver.vehicleId) throw new ApiError(409, 'An active vehicle must be assigned before submitting an expense')
	const [vehicle] = await transaction`select id from "Vehicle" where id = ${driver.vehicleId} and "companyId" = ${companyId} and status = 'active'`
	if (!vehicle) throw new ApiError(409, 'Your assigned vehicle is not active')
	return { driverId: driver.id, vehicleId: driver.vehicleId }
}

async function ensureEnabledService(transaction: TransactionSql, companyId: string, service: string) {
	const [enabledService] = await transaction`select type from "MobilityService" where type = ${service} and "companyId" = ${companyId} and enabled = true`
	if (!enabledService) throw new ApiError(400, 'Mobility service is not enabled')
}

export async function createDriverTransaction(companyId: string, actor: TransactionActor, payload: DriverTransactionPayload) {
	return sql.begin(async (transaction) => {
		const context = await driverSubmissionContext(transaction, companyId, actor.id)
		await ensureEnabledService(transaction, companyId, payload.service)
		const id = `transaction-${crypto.randomUUID()}`
		const [created] = await transaction<DbTransaction[]>`
			insert into "FleetTransaction" (id, "companyId", date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "createdAt", "updatedAt")
			values (${id}, ${companyId}, ${payload.date}, ${context.driverId}, ${context.vehicleId}, ${payload.service}, ${payload.provider}, ${payload.amount}, ${payload.vat}, 'pending', ${payload.expenseType}, now(), now())
			returning id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason", "receiptPath", "receiptName", "receiptMimeType", "receiptSize"
		`
		await appendTransactionEvent(transaction, companyId, id, actor, 'submitted', {
			summary: 'Expense submitted for review.',
			source: 'driver',
		})
		await notifyReviewers(transaction, companyId, id, actor.id, `${actor.name} submitted an expense for review.`)
		return mapTransaction(created)
	})
}

export async function updateDriverTransaction(companyId: string, actor: TransactionActor, transactionId: string, payload: DriverTransactionPayload) {
	return sql.begin(async (transaction) => {
		await ensureEnabledService(transaction, companyId, payload.service)
		const [current] = await transaction<DbTransaction[]>`
			select ft.id, ft.date, ft."driverId", ft."vehicleId", ft.service, ft.provider, ft.amount, ft.vat, ft.status, ft."expenseType", ft."reviewedById", ft."reviewedByName", ft."reviewedAt", ft."rejectionReason", ft."receiptPath", ft."receiptName", ft."receiptMimeType", ft."receiptSize"
			from "FleetTransaction" ft
			join "Driver" d on d.id = ft."driverId" and d."companyId" = ft."companyId"
			where ft.id = ${transactionId} and ft."companyId" = ${companyId} and ft.status = 'pending' and d."userId" = ${actor.id}
			limit 1
		`
		if (!current) throw new ApiError(409, 'Only your pending transactions can be edited')
		const [updated] = await transaction<DbTransaction[]>`
			update "FleetTransaction" ft
			set date = ${payload.date}, service = ${payload.service}, provider = ${payload.provider}, amount = ${payload.amount}, vat = ${payload.vat}, "expenseType" = ${payload.expenseType}, "updatedAt" = now()
			from "Driver" d
			where ft.id = ${transactionId} and ft."companyId" = ${companyId} and ft.status = 'pending'
				and d.id = ft."driverId" and d."companyId" = ${companyId} and d."userId" = ${actor.id}
			returning ft.id, ft.date, ft."driverId", ft."vehicleId", ft.service, ft.provider, ft.amount, ft.vat, ft.status, ft."expenseType", ft."reviewedById", ft."reviewedByName", ft."reviewedAt", ft."rejectionReason", ft."receiptPath", ft."receiptName", ft."receiptMimeType", ft."receiptSize"
		`
		if (!updated) throw new ApiError(409, 'Only your pending transactions can be edited')
		const changes = transactionChanges(current, updated)
		if (Object.keys(changes).length > 0) {
			await appendTransactionEvent(transaction, companyId, transactionId, actor, 'edited', {
				summary: `${Object.keys(changes).length} expense field${Object.keys(changes).length === 1 ? '' : 's'} updated.`,
				changes,
			})
		}
		return mapTransaction(updated)
	})
}

export async function withdrawDriverTransaction(companyId: string, actor: TransactionActor, transactionId: string) {
	return sql.begin(async (transaction) => {
		const [updated] = await transaction<DbTransaction[]>`
			update "FleetTransaction" ft set status = 'withdrawn', "updatedAt" = now()
			from "Driver" d
			where ft.id = ${transactionId} and ft."companyId" = ${companyId} and ft.status = 'pending'
				and d.id = ft."driverId" and d."companyId" = ${companyId} and d."userId" = ${actor.id}
			returning ft.id, ft.date, ft."driverId", ft."vehicleId", ft.service, ft.provider, ft.amount, ft.vat, ft.status, ft."expenseType", ft."reviewedById", ft."reviewedByName", ft."reviewedAt", ft."rejectionReason", ft."receiptPath", ft."receiptName", ft."receiptMimeType", ft."receiptSize"
		`
		if (!updated) throw new ApiError(409, 'Only your pending transactions can be withdrawn')
		await appendTransactionEvent(transaction, companyId, transactionId, actor, 'withdrawn', { summary: 'Expense withdrawn by driver.' })
		return mapTransaction(updated)
	})
}

export async function getTransactionReceiptAccess(
	companyId: string,
	userId: string,
	role: string,
	transactionId: string,
	requirePending: boolean,
) {
	const isDriver = role === 'driver'
	const [transaction] = await sql<{ driverId: string; status: string; receiptPath: string | null; receiptName: string | null }[]>`
		select ft."driverId", ft.status, ft."receiptPath", ft."receiptName"
		from "FleetTransaction" ft
		left join "Driver" d on d.id = ft."driverId" and d."companyId" = ft."companyId"
		where ft.id = ${transactionId} and ft."companyId" = ${companyId}
			and (${!isDriver} or d."userId" = ${userId})
		limit 1
	`
	if (!transaction) throw new ApiError(404, 'Transaction not found')
	if (requirePending && transaction.status !== 'pending') throw new ApiError(409, 'Receipts can only be changed while an expense is pending')
	return transaction
}

export async function confirmTransactionReceipt(
	companyId: string,
	actor: TransactionActor,
	transactionId: string,
	metadata: { path: string; fileName: string; contentType: string; size: number },
) {
	return sql.begin(async (transaction) => {
		const [current] = await transaction<{ receiptPath: string | null }[]>`
			select ft."receiptPath" from "FleetTransaction" ft
			join "Driver" d on d.id = ft."driverId" and d."companyId" = ft."companyId"
			where ft.id = ${transactionId} and ft."companyId" = ${companyId} and ft.status = 'pending' and d."userId" = ${actor.id}
		`
		const [updated] = await transaction<DbTransaction[]>`
			update "FleetTransaction" ft
			set "receiptPath" = ${metadata.path}, "receiptName" = ${metadata.fileName},
				"receiptMimeType" = ${metadata.contentType}, "receiptSize" = ${metadata.size}, "updatedAt" = now()
			from "Driver" d
			where ft.id = ${transactionId} and ft."companyId" = ${companyId} and ft.status = 'pending'
				and d.id = ft."driverId" and d."companyId" = ${companyId} and d."userId" = ${actor.id}
			returning ft.id, ft.date, ft."driverId", ft."vehicleId", ft.service, ft.provider, ft.amount, ft.vat, ft.status, ft."expenseType", ft."reviewedById", ft."reviewedByName", ft."reviewedAt", ft."rejectionReason", ft."receiptPath", ft."receiptName", ft."receiptMimeType", ft."receiptSize"
		`
		if (!updated) throw new ApiError(409, 'Receipts can only be changed on your pending expenses')
		const replaced = Boolean(current?.receiptPath)
		await appendTransactionEvent(transaction, companyId, transactionId, actor, replaced ? 'receipt_replaced' : 'receipt_attached', {
			summary: replaced ? 'Receipt replaced.' : 'Receipt attached.',
			fileName: metadata.fileName,
		})
		return mapTransaction(updated)
	})
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
		status: member.status === 'invited' || member.status === 'disabled' ? member.status : 'active',
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
		const [currentDriver] = await transaction<{ email: string; userId: string | null }[]>`
			select email, "userId" from "Driver" where id = ${driverId} and "companyId" = ${companyId}
		`
		if (!currentDriver) {
			throw new ApiError(404, 'Driver not found')
		}
		if (currentDriver.userId && currentDriver.email.toLowerCase() !== payload.email.toLowerCase()) {
			throw new ApiError(409, 'Driver email cannot be changed after account invitation')
		}
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
		if (currentDriver.userId) {
			await transaction`
				update "User" set name = ${payload.name}, "updatedAt" = now()
				where id = ${currentDriver.userId} and "companyId" = ${companyId}
			`
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

export async function createTransaction(companyId: string, actor: TransactionActor, payload: TransactionPayload) {
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
			returning id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason", "receiptPath", "receiptName", "receiptMimeType", "receiptSize"
		`
		await appendTransactionEvent(transaction, companyId, id, actor, 'submitted', {
			summary: 'Transaction created in the operations portal.',
			source: 'backoffice',
		})
		await notifyReviewers(transaction, companyId, id, actor.id, `${actor.name} created a transaction requiring review.`)
		return mapTransaction(created)
	})
}

export async function updateTransaction(
	companyId: string,
	transactionId: string,
	payload: TransactionReview,
	reviewer: TransactionReviewer,
) {
	return sql.begin(async (transaction) => {
		const [updated] = await transaction<DbTransaction[]>`
			update "FleetTransaction"
			set status = ${payload.status},
				"expenseType" = ${payload.expenseType},
				"reviewedById" = ${reviewer.id},
				"reviewedByName" = ${reviewer.name},
				"reviewedAt" = now(),
				"rejectionReason" = ${payload.status === 'rejected' ? payload.rejectionReason ?? null : null},
				"updatedAt" = now()
			where id = ${transactionId} and "companyId" = ${companyId} and status = 'pending'
			returning id, date, "driverId", "vehicleId", service, provider, amount, vat, status, "expenseType", "reviewedById", "reviewedByName", "reviewedAt", "rejectionReason", "receiptPath", "receiptName", "receiptMimeType", "receiptSize"
		`
		if (!updated) throw new ApiError(409, 'Only pending transactions can be reviewed')
		await appendTransactionEvent(transaction, companyId, transactionId, reviewer, payload.status, {
			summary: payload.status === 'approved' ? 'Expense approved.' : 'Expense rejected.',
			expenseType: payload.expenseType,
			...(payload.rejectionReason ? { rejectionReason: payload.rejectionReason } : {}),
		})
		await notifyDriver(
			transaction,
			companyId,
			transactionId,
			payload.status === 'approved' ? 'expense_approved' : 'expense_rejected',
			payload.status === 'approved'
				? `${reviewer.name} approved your expense.`
				: `${reviewer.name} rejected your expense${payload.rejectionReason ? `: ${payload.rejectionReason}` : '.'}`,
		)
		return mapTransaction(updated)
	})
}

export async function getNotifications(companyId: string, userId: string) {
	const notifications = await sql<DbNotification[]>`
		select id, "transactionId", type, title, message, "readAt", "createdAt"
		from "Notification"
		where "companyId" = ${companyId} and "userId" = ${userId}
		order by "createdAt" desc, id desc
		limit 40
	`
	return notifications.map((notification) => ({
		...notification,
		readAt: notification.readAt instanceof Date ? notification.readAt.toISOString() : notification.readAt,
		createdAt: notification.createdAt instanceof Date ? notification.createdAt.toISOString() : notification.createdAt,
	}))
}

export async function markNotificationRead(companyId: string, userId: string, notificationId: string) {
	const [notification] = await sql<DbNotification[]>`
		update "Notification" set "readAt" = coalesce("readAt", now())
		where id = ${notificationId} and "companyId" = ${companyId} and "userId" = ${userId}
		returning id, "transactionId", type, title, message, "readAt", "createdAt"
	`
	if (!notification) throw new ApiError(404, 'Notification not found')
	return {
		...notification,
		readAt: notification.readAt instanceof Date ? notification.readAt.toISOString() : notification.readAt,
		createdAt: notification.createdAt instanceof Date ? notification.createdAt.toISOString() : notification.createdAt,
	}
}

export async function markAllNotificationsRead(companyId: string, userId: string) {
	await sql`update "Notification" set "readAt" = now() where "companyId" = ${companyId} and "userId" = ${userId} and "readAt" is null`
	return { ok: true }
}

export async function getTransactionEvents(companyId: string, userId: string, role: string, transactionId: string) {
	await getTransactionReceiptAccess(companyId, userId, role, transactionId, false)
	const events = await sql<DbTransactionEvent[]>`
		select id, "transactionId", type, "actorId", "actorName", "actorRole", details, "createdAt"
		from "TransactionEvent"
		where "companyId" = ${companyId} and "transactionId" = ${transactionId}
		order by "createdAt" desc, id desc
	`
	return events.map((event) => ({
		...event,
		details: typeof event.details === 'string' ? JSON.parse(event.details) : event.details,
		createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
	}))
}
