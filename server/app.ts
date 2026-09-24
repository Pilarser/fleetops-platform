import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { Driver, MobilityService, Notification, SessionUser, Transaction, TransactionEvent, TransactionEventType, Vehicle } from '../src/types'
import { createSession, prismaAuthProvider, requireRole, requireUser, type AuthProvider } from './auth'
import { readBody, sendJson } from './http'
import {
	driverPayloadSchema,
	driverTransactionPayloadSchema,
	loginSchema,
	serviceIdSchema,
	transactionPayloadSchema,
	transactionReviewSchema,
	vehiclePayloadSchema,
} from './schemas'
import { createWorkspaceStore, type WorkspaceStore } from './storage'
import { expenseChanges } from '../shared/domain/expenses'

const workspaceRoles = ['fleet_admin', 'manager', 'finance', 'support'] as const
const authenticatedRoles = ['fleet_admin', 'manager', 'finance', 'driver', 'support'] as const
const operationsRoles = ['fleet_admin', 'manager'] as const
const transactionCreateRoles = ['fleet_admin', 'manager', 'finance'] as const
const transactionReviewRoles = ['fleet_admin', 'manager', 'finance'] as const

function nextId(prefix: string) {
	return `${prefix}-${Date.now()}`
}

function transactionEvent(
	transactionId: string,
	actor: SessionUser,
	type: TransactionEventType,
	details: Record<string, unknown>,
): TransactionEvent {
	return {
		id: `event-${randomUUID()}`,
		transactionId,
		type,
		actorId: actor.id,
		actorName: actor.name,
		actorRole: actor.role,
		details,
		createdAt: new Date().toISOString(),
	}
}

function notification(
	userId: string,
	transactionId: string,
	type: Notification['type'],
	title: string,
	message: string,
): Notification & { userId: string } {
	return { id: `notification-${randomUUID()}`, userId, transactionId, type, title, message, readAt: null, createdAt: new Date().toISOString() }
}

export function createApiServer(store: WorkspaceStore = createWorkspaceStore(), authProvider: AuthProvider = prismaAuthProvider) {
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
					service: 'onemobility-api',
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

			if (method === 'GET' && url.pathname === '/api/notifications') {
				const user = requireRole(request, response, [...authenticatedRoles])
				if (!user) return
				sendJson(response, 200, await store.getNotifications(user.id))
				return
			}

			if (method === 'POST' && url.pathname === '/api/notifications/read-all') {
				const user = requireRole(request, response, [...authenticatedRoles])
				if (!user) return
				await store.markAllNotificationsRead(user.id)
				sendJson(response, 200, { ok: true })
				return
			}

			if (method === 'POST' && url.pathname.startsWith('/api/notifications/') && url.pathname.endsWith('/read')) {
				const user = requireRole(request, response, [...authenticatedRoles])
				if (!user) return
				const id = decodeURIComponent(url.pathname.slice('/api/notifications/'.length, -'/read'.length))
				const updated = await store.markNotificationRead(user.id, id)
				if (!updated) {
					sendJson(response, 404, { message: 'Notification not found' })
					return
				}
				sendJson(response, 200, updated)
				return
			}

			if (method === 'GET' && url.pathname === '/api/driver/workspace') {
				const driverUser = requireRole(request, response, ['driver'])
				if (!driverUser) return
				const workspace = await store.getDriverWorkspace(driverUser.id)
				if (!workspace) {
					sendJson(response, 404, { message: 'Driver profile not found' })
					return
				}
				sendJson(response, 200, workspace)
				return
			}

			if (method === 'POST' && url.pathname === '/api/driver/transactions') {
				const driverUser = requireRole(request, response, ['driver'])
				if (!driverUser) return
				const payload = driverTransactionPayloadSchema.parse(await readBody(request))
				const workspace = await store.getDriverWorkspace(driverUser.id)
				if (!workspace) {
					sendJson(response, 404, { message: 'Driver profile not found' })
					return
				}
				if (workspace.driver.status !== 'active') {
					sendJson(response, 409, { message: 'Your driver profile is suspended' })
					return
				}
				if (!workspace.vehicle || workspace.vehicle.status !== 'active') {
					sendJson(response, 409, { message: 'An active vehicle must be assigned before submitting an expense' })
					return
				}
				if (!workspace.services.some((service) => service.id === payload.service)) {
					sendJson(response, 400, { message: 'Mobility service is not enabled' })
					return
				}
				const transaction: Transaction = {
					...payload,
					id: nextId('transaction'),
					driverId: workspace.driver.id,
					vehicleId: workspace.vehicle.id,
					status: 'pending',
				}
				const created = await store.createTransaction(transaction)
				await store.appendTransactionEvent(transactionEvent(created.id, driverUser, 'submitted', {
					summary: 'Expense submitted for review.',
					source: 'driver',
				}))
				await store.createNotifications([
					notification('user-admin', created.id, 'expense_submitted', 'Expense awaiting review', `${driverUser.name} submitted an expense for review.`),
				])
				sendJson(response, 201, created)
				return
			}

			if (method === 'POST' && url.pathname.startsWith('/api/driver/transactions/') && url.pathname.endsWith('/withdraw')) {
				const driverUser = requireRole(request, response, ['driver'])
				if (!driverUser) return
				const id = decodeURIComponent(url.pathname.slice('/api/driver/transactions/'.length, -'/withdraw'.length))
				const workspace = await store.getDriverWorkspace(driverUser.id)
				const current = workspace?.transactions.find((transaction) => transaction.id === id && transaction.status === 'pending')
				if (!current) {
					sendJson(response, 409, { message: 'Only your pending transactions can be withdrawn' })
					return
				}
				const withdrawn = await store.updateTransaction({ ...current, status: 'withdrawn' })
				if (withdrawn) await store.appendTransactionEvent(transactionEvent(id, driverUser, 'withdrawn', { summary: 'Expense withdrawn by driver.' }))
				sendJson(response, 200, withdrawn)
				return
			}

			if (method === 'PATCH' && url.pathname.startsWith('/api/driver/transactions/')) {
				const driverUser = requireRole(request, response, ['driver'])
				if (!driverUser) return
				const id = decodeURIComponent(url.pathname.slice('/api/driver/transactions/'.length))
				const payload = driverTransactionPayloadSchema.parse(await readBody(request))
				const workspace = await store.getDriverWorkspace(driverUser.id)
				const current = workspace?.transactions.find((transaction) => transaction.id === id && transaction.status === 'pending')
				if (!current) {
					sendJson(response, 409, { message: 'Only your pending transactions can be edited' })
					return
				}
				if (!workspace?.services.some((service) => service.id === payload.service)) {
					sendJson(response, 400, { message: 'Mobility service is not enabled' })
					return
				}
				const updated = { ...current, ...payload }
				const saved = await store.updateTransaction(updated)
				if (saved) {
					const changes = expenseChanges(current, saved)
					if (Object.keys(changes).length > 0) {
						await store.appendTransactionEvent(transactionEvent(id, driverUser, 'edited', {
							summary: `${Object.keys(changes).length} expense field${Object.keys(changes).length === 1 ? '' : 's'} updated.`,
							changes,
						}))
					}
				}
				sendJson(response, 200, saved)
				return
			}

			if (method === 'GET' && (url.pathname.startsWith('/api/expenses/') || url.pathname.startsWith('/api/transactions/')) && url.pathname.endsWith('/events')) {
				const user = requireRole(request, response, ['fleet_admin', 'manager', 'finance', 'driver'])
				if (!user) return
				const id = decodeURIComponent(url.pathname.replace(/^\/api\/(expenses|transactions)\//, '').slice(0, -'/events'.length))
				const transaction = user.role === 'driver'
					? (await store.getDriverWorkspace(user.id))?.transactions.find((item) => item.id === id)
					: (await store.getWorkspace()).transactions.find((item) => item.id === id)
				if (!transaction) {
					sendJson(response, 404, { message: 'Transaction not found' })
					return
				}
				sendJson(response, 200, await store.getTransactionEvents(id))
				return
			}

			if (method === 'GET' && url.pathname === '/api/workspace') {
				if (!requireRole(request, response, [...workspaceRoles])) {
					return
				}
				sendJson(response, 200, await store.getWorkspace())
				return
			}

			if (method === 'GET' && ['/api/fleet', '/api/service-catalog', '/api/expenses'].includes(url.pathname)) {
				if (!requireRole(request, response, [...workspaceRoles])) return
				const workspace = await store.getWorkspace()
				if (url.pathname === '/api/fleet') sendJson(response, 200, { drivers: workspace.drivers, vehicles: workspace.vehicles })
				if (url.pathname === '/api/service-catalog') sendJson(response, 200, { providers: workspace.providers, services: workspace.services })
				if (url.pathname === '/api/expenses') sendJson(response, 200, { transactions: workspace.transactions })
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

			if (method === 'POST' && (url.pathname === '/api/expenses' || url.pathname === '/api/transactions')) {
				const creator = requireRole(request, response, [...transactionCreateRoles])
				if (!creator) {
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
				const created = await store.createTransaction(transaction)
				await store.appendTransactionEvent(transactionEvent(created.id, creator, 'submitted', {
					summary: 'Transaction created in the operations portal.',
					source: 'backoffice',
				}))
				sendJson(response, 201, created)
				return
			}

			if (method === 'PATCH' && (url.pathname.startsWith('/api/expenses/') || url.pathname.startsWith('/api/transactions/'))) {
				const reviewer = requireRole(request, response, [...transactionReviewRoles])
				if (!reviewer) {
					return
				}
				const id = decodeURIComponent(url.pathname.replace(/^\/api\/(expenses|transactions)\//, ''))
				const payload = transactionReviewSchema.parse(await readBody(request))
				const current = (await store.getWorkspace()).transactions.find((transaction) => transaction.id === id && transaction.status === 'pending')
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
					sendJson(response, 409, { message: 'Only pending transactions can be reviewed' })
					return
				}
				await store.appendTransactionEvent(transactionEvent(id, reviewer, payload.status, {
					summary: payload.status === 'approved' ? 'Expense approved.' : 'Expense rejected.',
					expenseType: payload.expenseType,
					...(payload.rejectionReason ? { rejectionReason: payload.rejectionReason } : {}),
				}))
				const reviewedDriver = (await store.getWorkspace()).drivers.find((driver) => driver.id === updatedTransaction.driverId)
				const recipientId = reviewedDriver?.accountUserId ?? (reviewedDriver?.id === 'driver-1' ? 'user-driver' : undefined)
				if (recipientId) {
					await store.createNotifications([notification(
						recipientId,
						id,
						payload.status === 'approved' ? 'expense_approved' : 'expense_rejected',
						payload.status === 'approved' ? 'Expense approved' : 'Expense rejected',
						payload.status === 'approved'
							? `${reviewer.name} approved your expense.`
							: `${reviewer.name} rejected your expense${payload.rejectionReason ? `: ${payload.rejectionReason}` : '.'}`,
					)])
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
