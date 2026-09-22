export const expenseChangeFields = ['date', 'service', 'provider', 'amount', 'vat', 'expenseType'] as const

export type ExpenseChangeField = (typeof expenseChangeFields)[number]

export function expenseChanges<T extends Record<ExpenseChangeField, unknown>>(before: T, after: T) {
	return Object.fromEntries(
		expenseChangeFields
			.filter((field) => String(before[field]) !== String(after[field]))
			.map((field) => [field, { from: before[field], to: after[field] }]),
	)
}

export function normalizeCurrency(currency?: string) {
	return (currency || 'EUR').trim().toUpperCase()
}
