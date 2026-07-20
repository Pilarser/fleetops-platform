import {
	completeCompanyRegistration,
	login,
	requireRole,
	requireSession,
	sessionResponse,
	toSessionUser,
} from './auth.ts'
import {
	createDriver,
	createTransaction,
	createVehicle,
	getWorkspace,
	toggleService,
	updateDriver,
	updateTransaction,
	updateVehicle,
} from './database.ts'
import { ApiError, corsHeaders, json, readJson } from './http.ts'
import {
	driverPayloadSchema,
	loginSchema,
	serviceIdSchema,
	transactionPayloadSchema,
	transactionReviewSchema,
	vehiclePayloadSchema,
} from './schemas.ts'

const workspaceRoles = ['fleet_admin', 'manager', 'finance', 'support'] as const
const operationsRoles = ['fleet_admin', 'manager', 'support'] as const
const transactionCreateRoles = ['fleet_admin', 'manager', 'finance', 'support'] as const
const transactionReviewRoles = ['fleet_admin', 'manager', 'finance'] as const

function routePath(request: Request) {
	const pathname = new URL(request.url).pathname
	const functionName = '/fleet-api'
	const index = pathname.indexOf(functionName)
	return index >= 0 ? pathname.slice(index + functionName.length) || '/' : pathname
}

Deno.serve(async (request) => {
	if (request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders })
	}

	const path = routePath(request)

	try {
		if (request.method === 'GET' && path === '/health') {
			return json({ ok: true, service: 'fleet-api' })
		}

		if (request.method === 'POST' && path === '/auth/login') {
			const payload = loginSchema.parse(await readJson(request))
			const { profile, session } = await login(payload.email, payload.password)
			return json(sessionResponse(session, profile))
		}

		if (request.method === 'POST' && path === '/auth/complete-registration') {
			return json(toSessionUser(await completeCompanyRegistration(request)), 201)
		}

		const session = await requireSession(request)

		if (request.method === 'GET' && path === '/auth/me') {
			return json(toSessionUser(session))
		}

		if (request.method === 'GET' && path === '/workspace') {
			requireRole(session, [...workspaceRoles])
			return json(await getWorkspace(session.companyId))
		}

		if (request.method === 'POST' && path === '/drivers') {
			requireRole(session, [...operationsRoles])
			const payload = driverPayloadSchema.parse(await readJson(request))
			return json(await createDriver(session.companyId, payload), 201)
		}

		if (request.method === 'PATCH' && path.startsWith('/drivers/')) {
			requireRole(session, [...operationsRoles])
			const driverId = decodeURIComponent(path.slice('/drivers/'.length))
			const payload = driverPayloadSchema.parse(await readJson(request))
			return json(await updateDriver(session.companyId, driverId, payload))
		}

		if (request.method === 'POST' && path === '/vehicles') {
			requireRole(session, [...operationsRoles])
			const payload = vehiclePayloadSchema.parse(await readJson(request))
			return json(await createVehicle(session.companyId, payload), 201)
		}

		if (request.method === 'PATCH' && path.startsWith('/vehicles/')) {
			requireRole(session, [...operationsRoles])
			const vehicleId = decodeURIComponent(path.slice('/vehicles/'.length))
			const payload = vehiclePayloadSchema.parse(await readJson(request))
			return json(await updateVehicle(session.companyId, vehicleId, payload))
		}

		if (request.method === 'PATCH' && path.startsWith('/services/')) {
			requireRole(session, [...operationsRoles])
			const serviceId = serviceIdSchema.parse(decodeURIComponent(path.slice('/services/'.length)))
			return json(await toggleService(session.companyId, serviceId))
		}

		if (request.method === 'POST' && path === '/transactions') {
			requireRole(session, [...transactionCreateRoles])
			const payload = transactionPayloadSchema.parse(await readJson(request))
			return json(await createTransaction(session.companyId, payload), 201)
		}

		if (request.method === 'PATCH' && path.startsWith('/transactions/')) {
			requireRole(session, [...transactionReviewRoles])
			const transactionId = decodeURIComponent(path.slice('/transactions/'.length))
			const payload = transactionReviewSchema.parse(await readJson(request))
			return json(await updateTransaction(session.companyId, transactionId, payload))
		}

		throw new ApiError(404, 'Not found')
	} catch (error) {
		if (error instanceof ApiError) {
			return json({ message: error.message }, error.status)
		}
		if (error && typeof error === 'object' && 'issues' in error) {
			return json({ message: 'Invalid request', issues: error.issues }, 400)
		}
		console.error(error)
		return json({ message: 'Internal server error' }, 500)
	}
})
