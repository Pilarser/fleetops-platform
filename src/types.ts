export type ServiceType = 'fuel' | 'charging' | 'parking' | 'fines' | 'wash' | 'tolls' | 'area_c' | 'taxi'

export type TransactionStatus = 'approved' | 'pending' | 'rejected'

export type VehicleStatus = 'active' | 'maintenance' | 'inactive'

export type DriverStatus = 'active' | 'suspended'

export type UserRole = 'fleet_admin' | 'manager' | 'finance' | 'driver' | 'support'

export interface SessionUser {
	id: string
	name: string
	email: string
	role: UserRole
	companyName: string
	membershipStatus?: 'active' | 'invited'
}

export interface TeamMember {
	id: string
	name: string
	email: string
	role: UserRole
	status: 'active' | 'invited'
}

export interface Vehicle {
	id: string
	plate: string
	make: string
	model: string
	fuelType: 'diesel' | 'petrol' | 'hybrid' | 'electric'
	status: VehicleStatus
	assignedDriverId: string
	costCenter: string
	monthlySpend: number
	mileageKm: number
}

export interface Driver {
	id: string
	name: string
	email: string
	status: DriverStatus
	vehicleId: string
	costCenter: string
	monthlySpend: number
	personalSpend: number
	accountStatus?: 'not_invited' | 'invited' | 'active'
}

export interface DriverWorkspace {
	driver: Driver
	vehicle: Vehicle | null
	transactions: Transaction[]
}

export interface MobilityService {
	id: ServiceType
	name: string
	description: string
	enabled: boolean
	monthlyLimit: number
	requiresApproval: boolean
}

export interface ProviderLocation {
	id: string
	name: string
	service: ServiceType
	address: string
	city: string
	distanceKm: number
	status: 'online' | 'limited' | 'offline'
}

export interface Transaction {
	id: string
	date: string
	driverId: string
	vehicleId: string
	service: ServiceType
	provider: string
	amount: number
	vat: number
	status: TransactionStatus
	expenseType: 'business' | 'personal'
	reviewedById?: string | null
	reviewedByName?: string | null
	reviewedAt?: string | null
	rejectionReason?: string | null
}
