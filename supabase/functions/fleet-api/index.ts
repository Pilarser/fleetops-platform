import { createSession, parseUserRole, requireRole, requireSession, toSessionUser, verifyPassword } from './auth.ts'
import {
	createDriver,
	createVehicle,
	getWorkspace,
	sql,
	toggleService,
	updateDriver,
	updateVehicle,
} from './database.ts'
import { ApiError, corsHeaders, json, readJson } from './http.ts'
import { driverPayloadSchema, loginSchema, serviceIdSchema, vehiclePayloadSchema } from './schemas.ts'

const workspaceRoles = ['fleet_admin', 'manager', 'finance', 'support'] as const
const operationsRoles = ['fleet_admin', 'manager', 'support'] as const

function routePath(request: Request) {
	const pathname = new URL(request.url).pathname
	const functionName = '/fleet-api'
	const index = pathname.indexOf(functionName)
	return index >= 0 ? pathname.slice(index + functionName.length) || '/' : pathname
}

function sessionSecret() {
	const secret = Deno.env.get('FLEET_SESSION_SECRET')
	if (!secret || secret.length < 32) {
		throw new Error('FLEET_SESSION_SECRET must contain at least 32 characters')
	}
	return secret
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
			const [record] = await sql`
				select u.id, u.name, u.email, u.password, u.role, u."companyId", c.name as "companyName"
				from "User" u
				join "Company" c on c.id = u."companyId"
				where lower(u.email) = ${payload.email.trim().toLowerCase()}
				limit 1
			`
			const role = record ? parseUserRole(record.role) : undefined
			if (!record || !role || !(await verifyPassword(payload.password, record.password))) {
				throw new ApiError(401, 'Invalid email or password')
			}
			const user = {
				id: record.id,
				name: record.name,
				email: record.email,
				role,
				companyName: record.companyName,
			}
			return json({
				token: await createSession(user, record.companyId, sessionSecret()),
				user,
			})
		}

		const session = await requireSession(request, sessionSecret())

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
