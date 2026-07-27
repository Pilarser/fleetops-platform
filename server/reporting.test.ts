import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildReportGroups, createReportCsv, filterReportTransactions, summarizeReport } from '../src/data/reporting'
import type { Driver, MobilityService, Transaction, Vehicle } from '../src/types'

const drivers: Driver[] = [
	{ id: 'driver-1', name: 'Marta Rinaldi', email: 'marta@example.com', status: 'active', vehicleId: 'vehicle-1', costCenter: 'Sales', monthlySpend: 0, personalSpend: 0 },
]
const vehicles: Vehicle[] = [
	{ id: 'vehicle-1', plate: 'GE842LK', make: 'Fiat', model: '500e', fuelType: 'electric', status: 'active', assignedDriverId: 'driver-1', costCenter: 'Operations', monthlySpend: 0, mileageKm: 100 },
]
const services: MobilityService[] = [
	{ id: 'area_c', name: 'Area C', description: '', enabled: true, monthlyLimit: 100, requiresApproval: true },
]
const transactions: Transaction[] = [
	{ id: 'approved', date: '2026-07-10', driverId: 'driver-1', vehicleId: 'vehicle-1', service: 'area_c', provider: 'Comune di "Milano"', amount: 20, vat: 4, status: 'approved', expenseType: 'business', receiptName: 'receipt.pdf', reviewedByName: 'Admin' },
	{ id: 'pending', date: '2026-07-11', driverId: 'driver-1', vehicleId: 'vehicle-1', service: 'area_c', provider: 'Comune di Milano', amount: 10, vat: 2, status: 'pending', expenseType: 'personal' },
	{ id: 'outside', date: '2026-06-30', driverId: 'driver-1', vehicleId: 'vehicle-1', service: 'area_c', provider: 'Comune di Milano', amount: 30, vat: 6, status: 'approved', expenseType: 'personal' },
]

describe('reporting', () => {
	it('filters by period, status, and expense classification', () => {
		const filtered = filterReportTransactions(transactions, {
			from: '2026-07-01',
			to: '2026-07-31',
			status: 'pending',
			expenseType: 'personal',
		})
		assert.deepEqual(filtered.map((transaction) => transaction.id), ['pending'])
	})

	it('calculates approved and pending finance totals separately', () => {
		assert.deepEqual(summarizeReport(transactions.slice(0, 2)), {
			approvedSpend: 20,
			approvedVat: 4,
			pendingAmount: 10,
			pendingCount: 1,
			personalSpend: 0,
			transactionCount: 2,
		})
	})

	it('groups spend by the driver cost center', () => {
		const rows = buildReportGroups(transactions.slice(0, 2), 'cost_center', { drivers, services, vehicles })
		assert.equal(rows.length, 1)
		assert.equal(rows[0]?.label, 'Sales')
		assert.equal(rows[0]?.total, 30)
		assert.equal(rows[0]?.share, 100)
	})

	it('creates an accounting CSV with a BOM and escaped cells', () => {
		const csv = createReportCsv(transactions.slice(0, 1), { drivers, services, vehicles })
		assert.ok(csv.startsWith('\uFEFF'))
		assert.match(csv, /"Sales"/)
		assert.match(csv, /"Comune di ""Milano"""/)
		assert.match(csv, /"20.00"/)
	})
})
