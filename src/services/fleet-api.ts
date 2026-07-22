import type { AccountLifecycleAction, Driver, DriverTransactionDraft, DriverWorkspace, MobilityService, ProviderLocation, SessionUser, TeamMember, Transaction, Vehicle } from '../types'

export interface FleetWorkspacePayload {
	drivers: Driver[]
	providers: ProviderLocation[]
	services: MobilityService[]
	transactions: Transaction[]
	vehicles: Vehicle[]
}

const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
let authToken: string | null = localStorage.getItem('fleetos.session.token')

export class FleetApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message)
	}
}

export function hasFleetApi() {
	return Boolean(apiBaseUrl)
}

async function request<T>(path: string, options?: RequestInit) {
	if (!apiBaseUrl) {
		throw new Error('Fleet API URL is not configured')
	}

	const response = await fetch(`${apiBaseUrl}${path}`, {
		...options,
		headers: {
			'content-type': 'application/json',
			...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
			...options?.headers,
		},
	})

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as
			| { message?: string; issues?: Array<{ message?: string }> }
			| null
		const issueMessage = payload?.issues?.find((issue) => issue.message)?.message
		throw new FleetApiError(
			response.status,
			issueMessage ?? payload?.message ?? `Fleet API request failed with ${response.status}`,
		)
	}

	return (await response.json()) as T
}

export const fleetApi = {
	setToken: (token: string | null) => {
		authToken = token
	},
	login: (credentials: { email: string; password: string }) =>
		request<{ token: string; refreshToken?: string; expiresAt?: number; user: SessionUser }>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(credentials),
		}),
	me: () => request<SessionUser>('/auth/me'),
	completeRegistration: () => request<SessionUser>('/auth/complete-registration', { method: 'POST' }),
	acceptInvitation: () => request<SessionUser>('/auth/accept-invitation', { method: 'POST' }),
	getTeam: () => request<TeamMember[]>('/team'),
	inviteTeamMember: (invitation: { name: string; email: string; role: 'manager' | 'finance' | 'support'; redirectUrl: string }) =>
		request<TeamMember>('/team/invitations', {
			method: 'POST',
			body: JSON.stringify(invitation),
		}),
	manageAccount: (accountId: string, action: AccountLifecycleAction, redirectUrl?: string) =>
		request<{ id: string; action: AccountLifecycleAction }>(`/accounts/${accountId}/lifecycle`, {
			method: 'POST',
			body: JSON.stringify({ action, redirectUrl }),
		}),
	getWorkspace: () => request<FleetWorkspacePayload>('/workspace'),
	getDriverWorkspace: () => request<DriverWorkspace>('/driver/workspace'),
	createDriverTransaction: (transaction: DriverTransactionDraft) =>
		request<Transaction>('/driver/transactions', { method: 'POST', body: JSON.stringify(transaction) }),
	updateDriverTransaction: (transactionId: string, transaction: DriverTransactionDraft) =>
		request<Transaction>(`/driver/transactions/${transactionId}`, { method: 'PATCH', body: JSON.stringify(transaction) }),
	withdrawDriverTransaction: (transactionId: string) =>
		request<Transaction>(`/driver/transactions/${transactionId}/withdraw`, { method: 'POST' }),
	createDriver: (driver: Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend'>) =>
		request<Driver>('/drivers', {
			method: 'POST',
			body: JSON.stringify(driver),
		}),
	inviteDriver: (driverId: string, redirectUrl: string) =>
		request<{ driverId: string; accountStatus: 'invited' }>(`/drivers/${driverId}/invitation`, {
			method: 'POST',
			body: JSON.stringify({ redirectUrl }),
		}),
	createVehicle: (vehicle: Omit<Vehicle, 'id' | 'monthlySpend'>) =>
		request<Vehicle>('/vehicles', {
			method: 'POST',
			body: JSON.stringify(vehicle),
		}),
	createTransaction: (transaction: Omit<Transaction, 'id' | 'status'>) =>
		request<Transaction>('/transactions', {
			method: 'POST',
			body: JSON.stringify(transaction),
		}),
	toggleService: (serviceId: MobilityService['id']) =>
		request<MobilityService>(`/services/${serviceId}`, {
			method: 'PATCH',
		}),
	updateDriver: (driver: Driver) =>
		request<Driver>(`/drivers/${driver.id}`, {
			method: 'PATCH',
			body: JSON.stringify(driver),
		}),
	updateVehicle: (vehicle: Vehicle) =>
		request<Vehicle>(`/vehicles/${vehicle.id}`, {
			method: 'PATCH',
			body: JSON.stringify(vehicle),
		}),
	updateTransaction: (
		transactionId: string,
		review: {
			status: 'approved' | 'rejected'
			expenseType: Transaction['expenseType']
			rejectionReason?: string
		},
	) =>
		request<Transaction>(`/transactions/${transactionId}`, {
			method: 'PATCH',
			body: JSON.stringify(review),
		}),
}
