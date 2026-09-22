import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { expenseChanges } from '../shared/domain/expenses'
import { transactionPayloadSchema } from './schemas'

describe('shared fleet domain', () => {
	it('accepts provider-defined service identifiers and normalizes currency', () => {
		const expense = transactionPayloadSchema.parse({
			date: '2026-09-22',
			driverId: 'driver-1',
			vehicleId: 'vehicle-1',
			service: 'corporate_bike',
			provider: 'Mobility Partner',
			amount: 12.45,
			vat: 2.45,
			currency: 'usd',
			expenseType: 'business',
		})

		assert.equal(expense.service, 'corporate_bike')
		assert.equal(expense.currency, 'USD')
	})

	it('uses EUR for older clients and records only changed expense fields', () => {
		const expense = transactionPayloadSchema.parse({
			date: '2026-09-22',
			driverId: 'driver-1',
			vehicleId: 'vehicle-1',
			service: 'fuel',
			provider: 'Provider',
			amount: 10,
			vat: 2,
			expenseType: 'business',
		})
		assert.equal(expense.currency, 'EUR')
		assert.deepEqual(expenseChanges(expense, { ...expense, amount: 11 }), {
			amount: { from: 10, to: 11 },
		})
	})
})
