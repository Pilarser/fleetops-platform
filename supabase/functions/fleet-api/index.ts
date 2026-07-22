import {
	activateInvitation,
	completeCompanyRegistration,
	inviteCompanyMember,
	inviteDriverAccount,
	login,
	manageAccountLifecycle,
	requireRole,
	requireSession,
	sessionResponse,
	toSessionUser,
} from './auth.ts'
import {
	createDriver,
	createDriverTransaction,
	createTransaction,
	createVehicle,
	getWorkspace,
	getDriverWorkspace,
	getTeam,
	toggleService,
	updateDriver,
	updateDriverTransaction,
	updateTransaction,
	updateVehicle,
	withdrawDriverTransaction,
} from './database.ts'
import { ApiError, corsHeaders, json, readJson } from './http.ts'
import {
	accountLifecycleSchema,
	driverPayloadSchema,
	driverInvitationSchema,
	driverTransactionPayloadSchema,
	loginSchema,
	serviceIdSchema,
	teamInvitationSchema,
	transactionPayloadSchema,
	transactionReviewSchema,
	vehiclePayloadSchema,
	receiptUploadSchema,
	receiptConfirmationSchema,
} from './schemas.ts'
import { confirmReceipt, createReceiptDownload, createReceiptUpload } from './receipts.ts'

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

function validateInvitationRedirect(request: Request, redirectUrl: string) {
	const origin = request.headers.get('origin')
	if (!origin || new URL(redirectUrl).origin !== origin) {
		throw new ApiError(400, 'Invalid invitation redirect URL')
	}
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

		if (request.method === 'POST' && path === '/auth/accept-invitation') {
			await activateInvitation(session)
			return json(toSessionUser({ ...session, status: 'active' }))
		}

		if (request.method === 'GET' && path === '/team') {
			requireRole(session, ['fleet_admin'])
			return json(await getTeam(session.companyId))
		}

		if (request.method === 'POST' && path === '/team/invitations') {
			requireRole(session, ['fleet_admin'])
			const payload = teamInvitationSchema.parse(await readJson(request))
			validateInvitationRedirect(request, payload.redirectUrl)
			return json(await inviteCompanyMember(session, payload), 201)
		}

		if (request.method === 'POST' && path.startsWith('/accounts/') && path.endsWith('/lifecycle')) {
			requireRole(session, ['fleet_admin', 'manager'])
			const accountId = decodeURIComponent(path.slice('/accounts/'.length, -'/lifecycle'.length))
			const payload = accountLifecycleSchema.parse(await readJson(request))
			if (payload.action === 'resend_invitation') {
				if (!payload.redirectUrl) throw new ApiError(400, 'Invitation redirect URL is required')
				validateInvitationRedirect(request, payload.redirectUrl)
			}
			return json(await manageAccountLifecycle(session, accountId, payload.action, payload.redirectUrl))
		}

		if (request.method === 'GET' && path === '/driver/workspace') {
			requireRole(session, ['driver'])
			return json(await getDriverWorkspace(session.companyId, session.id))
		}

		if (request.method === 'POST' && path === '/driver/transactions') {
			requireRole(session, ['driver'])
			const payload = driverTransactionPayloadSchema.parse(await readJson(request))
			return json(await createDriverTransaction(session.companyId, session.id, payload), 201)
		}

		if (request.method === 'POST' && path.startsWith('/driver/transactions/') && path.endsWith('/withdraw')) {
			requireRole(session, ['driver'])
			const transactionId = decodeURIComponent(path.slice('/driver/transactions/'.length, -'/withdraw'.length))
			return json(await withdrawDriverTransaction(session.companyId, session.id, transactionId))
		}

		if (request.method === 'POST' && path.startsWith('/driver/transactions/') && path.endsWith('/receipt-upload')) {
			requireRole(session, ['driver'])
			const transactionId = decodeURIComponent(path.slice('/driver/transactions/'.length, -'/receipt-upload'.length))
			const payload = receiptUploadSchema.parse(await readJson(request))
			return json(await createReceiptUpload(session, transactionId, payload), 201)
		}

		if (request.method === 'POST' && path.startsWith('/driver/transactions/') && path.endsWith('/receipt-confirm')) {
			requireRole(session, ['driver'])
			const transactionId = decodeURIComponent(path.slice('/driver/transactions/'.length, -'/receipt-confirm'.length))
			const payload = receiptConfirmationSchema.parse(await readJson(request))
			return json(await confirmReceipt(session, transactionId, payload))
		}

		if (request.method === 'GET' && path.startsWith('/transactions/') && path.endsWith('/receipt')) {
			requireRole(session, ['fleet_admin', 'manager', 'finance', 'driver'])
			const transactionId = decodeURIComponent(path.slice('/transactions/'.length, -'/receipt'.length))
			return json(await createReceiptDownload(session, transactionId))
		}

		if (request.method === 'PATCH' && path.startsWith('/driver/transactions/')) {
			requireRole(session, ['driver'])
			const transactionId = decodeURIComponent(path.slice('/driver/transactions/'.length))
			const payload = driverTransactionPayloadSchema.parse(await readJson(request))
			return json(await updateDriverTransaction(session.companyId, session.id, transactionId, payload))
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

		if (request.method === 'POST' && path.startsWith('/drivers/') && path.endsWith('/invitation')) {
			requireRole(session, ['fleet_admin', 'manager'])
			const driverId = decodeURIComponent(path.slice('/drivers/'.length, -'/invitation'.length))
			const payload = driverInvitationSchema.parse(await readJson(request))
			validateInvitationRedirect(request, payload.redirectUrl)
			return json(await inviteDriverAccount(session, driverId, payload.redirectUrl), 201)
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
			return json(await updateTransaction(session.companyId, transactionId, payload, session))
		}

		throw new ApiError(404, 'Not found')
	} catch (error) {
		if (error instanceof ApiError) {
			return json({ message: error.message }, error.status)
		}
		if (error && typeof error === 'object' && 'issues' in error) {
			const issues = (error as { issues?: Array<{ message?: string }> }).issues
			return json({ message: issues?.find((issue) => issue.message)?.message ?? 'Invalid request', issues }, 400)
		}
		console.error(error)
		return json({ message: 'Internal server error' }, 500)
	}
})
