export type ServiceId = string
export type ServiceType = ServiceId
export type CurrencyCode = string

export type ExpenseStatus = 'approved' | 'pending' | 'rejected' | 'withdrawn'
export type TransactionStatus = ExpenseStatus

export type ExpenseEventType = 'submitted' | 'edited' | 'receipt_attached' | 'receipt_replaced' | 'approved' | 'rejected' | 'withdrawn'
export type TransactionEventType = ExpenseEventType

export type VehicleStatus = 'active' | 'maintenance' | 'inactive'

export type DriverStatus = 'active' | 'suspended'

export type UserRole = 'fleet_admin' | 'manager' | 'finance' | 'driver' | 'support'

export interface SessionUser {
	id: string
	name: string
	email: string
	role: UserRole
	companyName: string
	membershipStatus?: 'active' | 'invited' | 'disabled'
}

export interface TeamMember {
	id: string
	name: string
	email: string
	role: UserRole
	status: 'active' | 'invited' | 'disabled'
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
	accountStatus?: 'not_invited' | 'invited' | 'active' | 'disabled'
	accountUserId?: string
}

export type AccountLifecycleAction = 'resend_invitation' | 'revoke_invitation' | 'disable' | 'reactivate'

export interface DriverWorkspace {
	driver: Driver
	vehicle: Vehicle | null
	services: MobilityService[]
	transactions: Transaction[]
}

export type DriverExpenseDraft = Pick<Expense, 'date' | 'service' | 'provider' | 'amount' | 'vat' | 'expenseType'> &
	Partial<Pick<Expense, 'currency'>>
export type DriverTransactionDraft = DriverExpenseDraft

export type ExpenseInput = Omit<Expense, 'id' | 'status' | 'currency'> & Partial<Pick<Expense, 'currency'>>

export interface MobilityService {
	id: ServiceId
	name: string
	description: string
	enabled: boolean
	monthlyLimit: number
	currency: CurrencyCode
	requiresApproval: boolean
}

export interface ProviderLocation {
	id: string
	name: string
	service: ServiceId
	address: string
	city: string
	distanceKm: number
	status: 'online' | 'limited' | 'offline'
}

export interface Expense {
	id: string
	date: string
	driverId: string
	vehicleId: string
	service: ServiceId
	provider: string
	amount: number
	vat: number
	currency: CurrencyCode
	status: ExpenseStatus
	expenseType: 'business' | 'personal'
	reviewedById?: string | null
	reviewedByName?: string | null
	reviewedAt?: string | null
	rejectionReason?: string | null
	receiptPath?: string | null
	receiptName?: string | null
	receiptMimeType?: string | null
	receiptSize?: number | null
}

/** @deprecated Use Expense for new domain code. */
export type Transaction = Expense

export interface ExpenseEvent {
	id: string
	transactionId: string
	type: ExpenseEventType
	actorId: string
	actorName: string
	actorRole: string
	details: Record<string, unknown>
	createdAt: string
}

/** @deprecated Use ExpenseEvent for new domain code. */
export type TransactionEvent = ExpenseEvent

export interface Notification {
	id: string
	transactionId?: string | null
	type: 'expense_submitted' | 'expense_approved' | 'expense_rejected'
	title: string
	message: string
	readAt?: string | null
	createdAt: string
}
