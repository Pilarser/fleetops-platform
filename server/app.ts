import { createServer } from 'node:http'
import type { Driver, MobilityService, Vehicle } from '../src/types'
import { createSession, prismaAuthProvider, requireRole, requireUser, type AuthProvider } from './auth'
import { readBody, sendJson } from './http'
import { driverPayloadSchema, loginSchema, serviceIdSchema, vehiclePayloadSchema } from './schemas'
import { createFleetStore, type FleetStore } from './storage'

const workspaceRoles = ['fleet_admin', 'manager', 'finance', 'support'] as const
const operationsRoles = ['fleet_admin', 'manager', 'support'] as const

function nextId(prefix: string) {
	return `${prefix}-${Date.now()}`
}

export function createFleetServer(store: FleetStore = createFleetStore(), authProvider: AuthProvider = prismaAuthProvider) {
	return createServer(async (request, response) => {
		const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
		const method = request.method ?? 'GET'

		if (method === 'OPTIONS') {
			sendJson(response, 204, null)
			return
		}

		try {
			if (method === 'GET' && url.pathname === '/api/health') {
				sendJson(response, 200, { databasePath: store.path, ok: true })
				return
			}

			if (method === 'POST' && url.pathname === '/api/auth/login') {
				const payload = loginSchema.parse(await readBody(request))
				const sessionUser = await authProvider.findUser(payload.email, payload.password)

				if (!sessionUser) {
					sendJson(response, 401, { message: 'Invalid email or password' })
					return
				}

				sendJson(response, 200, { token: createSession(sessionUser), user: sessionUser })
				return
			}

			if (method === 'GET' && url.pathname === '/api/auth/me') {
				const user = requireUser(request, response)
				if (!user) {
					return
				}
				sendJson(response, 200, user)
				return
			}

			if (method === 'GET' && url.pathname === '/api/workspace') {
				if (!requireRole(request, response, [...workspaceRoles])) {
					return
				}
				sendJson(response, 200, await store.getWorkspace())
				return
			}

			if (method === 'POST' && url.pathname === '/api/drivers') {
				if (!requireRole(request, response, [...operationsRoles])) {
					return
				}
				const payload = driverPayloadSchema.parse(await readBody(request))
				const driver: Driver = {
					...payload,
					id: nextId('driver'),
					monthlySpend: 0,
					personalSpend: 0,
				}
				sendJson(response, 201, await store.createDriver(driver))
				return
			}

			if (method === 'PATCH' && url.pathname.startsWith('/api/drivers/')) {
				if (!requireRole(request, response, [...operationsRoles])) {
					return
				}
				const id = decodeURIComponent(url.pathname.replace('/api/drivers/', ''))
				const payload = driverPayloadSchema.parse(await readBody(request))
				const current = (await store.getWorkspace()).drivers.find((driver) => driver.id === id)
				const updatedDriver = current ? await store.updateDriver({ ...current, ...payload, id }) : undefined
				if (!updatedDriver) {
					sendJson(response, 404, { message: 'Driver not found' })
					return
				}
				sendJson(response, 200, updatedDriver)
				return
			}

			if (method === 'POST' && url.pathname === '/api/vehicles') {
				if (!requireRole(request, response, [...operationsRoles])) {
					return
				}
				const payload = vehiclePayloadSchema.parse(await readBody(request))
				const vehicle: Vehicle = {
					...payload,
					id: nextId('vehicle'),
					monthlySpend: 0,
				}
				sendJson(response, 201, await store.createVehicle(vehicle))
				return
			}

			if (method === 'PATCH' && url.pathname.startsWith('/api/vehicles/')) {
				if (!requireRole(request, response, [...operationsRoles])) {
					return
				}
				const id = decodeURIComponent(url.pathname.replace('/api/vehicles/', ''))
				const payload = vehiclePayloadSchema.parse(await readBody(request))
				const current = (await store.getWorkspace()).vehicles.find((vehicle) => vehicle.id === id)
				const updatedVehicle = current ? await store.updateVehicle({ ...current, ...payload, id }) : undefined
				if (!updatedVehicle) {
					sendJson(response, 404, { message: 'Vehicle not found' })
					return
				}
				sendJson(response, 200, updatedVehicle)
				return
			}

			if (method === 'PATCH' && url.pathname.startsWith('/api/services/')) {
				if (!requireRole(request, response, [...operationsRoles])) {
					return
				}
				const id = serviceIdSchema.parse(decodeURIComponent(url.pathname.replace('/api/services/', ''))) as MobilityService['id']
				const updatedService = await store.toggleService(id)
				if (!updatedService) {
					sendJson(response, 404, { message: 'Service not found' })
					return
				}
				sendJson(response, 200, updatedService)
				return
			}

			sendJson(response, 404, { message: 'Not found' })
		} catch (error) {
			sendJson(response, 400, {
				message: error instanceof Error ? error.message : 'Invalid request',
			})
		}
	})
}
