import type { UserRole } from '../types'

const fleetManagers: UserRole[] = ['fleet_admin', 'manager']
const transactionOperators: UserRole[] = ['fleet_admin', 'manager', 'finance']

export function canManageFleet(role?: UserRole) {
	return Boolean(role && fleetManagers.includes(role))
}

export function canCreateTransaction(role?: UserRole) {
	return Boolean(role && transactionOperators.includes(role))
}

export function canReviewTransaction(role?: UserRole) {
	return Boolean(role && transactionOperators.includes(role))
}

export function canViewReports(role?: UserRole) {
	return Boolean(role && transactionOperators.includes(role))
}
