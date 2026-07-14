import type { Driver, MobilityService, ProviderLocation, SessionUser, Transaction, Vehicle } from '../types'

export interface FleetWorkspacePayload {
	drivers: Driver[]
	providers: ProviderLocation[]
	services: MobilityService[]
	transactions: Transaction[]
	vehicles: Vehicle[]
}

const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
let authToken = localStorage.getItem('fleetos.session.token')

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
		throw new Error(`Fleet API request failed with ${response.status}`)
	}

	return (await response.json()) as T
}

export const fleetApi = {
	setToken: (token: string | null) => {
		authToken = token
	},
	login: (credentials: { email: string; password: string }) =>
		request<{ token: string; user: SessionUser }>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(credentials),
		}),
	me: () => request<SessionUser>('/auth/me'),
	getWorkspace: () => request<FleetWorkspacePayload>('/workspace'),
	createDriver: (driver: Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend'>) =>
		request<Driver>('/drivers', {
			method: 'POST',
			body: JSON.stringify(driver),
		}),
	createVehicle: (vehicle: Omit<Vehicle, 'id' | 'monthlySpend'>) =>
		request<Vehicle>('/vehicles', {
			method: 'POST',
			body: JSON.stringify(vehicle),
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
}
