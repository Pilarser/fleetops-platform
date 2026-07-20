import { createServer } from 'node:http'
import type { Driver, MobilityService, Transaction, Vehicle } from '../src/types'
import { createSession, prismaAuthProvider, requireRole, requireUser, type AuthProvider } from './auth'
import { readBody, sendJson } from './http'
import {
	driverPayloadSchema,
	loginSchema,
	serviceIdSchema,
	transactionPayloadSchema,
	transactionReviewSchema,
	vehiclePayloadSchema,
} from './schemas'
import { createFleetStore, type FleetStore } from './storage'

const workspaceRoles = ['fleet_admin', 'manager', 'finance', 'support'] as const
const operationsRoles = ['fleet_admin', 'manager', 'support'] as const
const transactionCreateRoles = ['fleet_admin', 'manager', 'finance', 'support'] as const
const transactionReviewRoles = ['fleet_admin', 'manager', 'finance'] as const

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
				sendJson(response, 200, {
					ok: true,
					service: 'fleet-api',
				})
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

			if (method === 'POST' && url.pathname === '/api/transactions') {
				if (!requireRole(request, response, [...transactionCreateRoles])) {
					return
				}
				const payload = transactionPayloadSchema.parse(await readBody(request))
				const workspace = await store.getWorkspace()
				if (!workspace.drivers.some((driver) => driver.id === payload.driverId)) {
					sendJson(response, 400, { message: 'Driver does not exist' })
					return
				}
				if (!workspace.vehicles.some((vehicle) => vehicle.id === payload.vehicleId)) {
					sendJson(response, 400, { message: 'Vehicle does not exist' })
					return
				}
				const service = workspace.services.find((item) => item.id === payload.service)
				if (!service || !service.enabled) {
					sendJson(response, 400, { message: 'Service is not enabled' })
					return
				}
				const transaction: Transaction = {
					...payload,
					id: nextId('transaction'),
					status: 'pending',
				}
				sendJson(response, 201, await store.createTransaction(transaction))
				return
			}

			if (method === 'PATCH' && url.pathname.startsWith('/api/transactions/')) {
				const reviewer = requireRole(request, response, [...transactionReviewRoles])
				if (!reviewer) {
					return
				}
				const id = decodeURIComponent(url.pathname.replace('/api/transactions/', ''))
				const payload = transactionReviewSchema.parse(await readBody(request))
				const current = (await store.getWorkspace()).transactions.find((transaction) => transaction.id === id)
				const updatedTransaction = current
					? await store.updateTransaction({
							...current,
							...payload,
							id,
							reviewedById: reviewer.id,
							reviewedByName: reviewer.name,
							reviewedAt: new Date().toISOString(),
							rejectionReason: payload.status === 'rejected' ? payload.rejectionReason : null,
						})
					: undefined
				if (!updatedTransaction) {
					sendJson(response, 404, { message: 'Transaction not found' })
					return
				}
				sendJson(response, 200, updatedTransaction)
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
