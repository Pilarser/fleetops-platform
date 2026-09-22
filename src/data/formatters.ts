export function formatCurrency(amount: number, currency = 'EUR') {
	return new Intl.NumberFormat('it-IT', {
		style: 'currency',
		currency,
	}).format(amount)
}

export function formatNumber(value: number) {
	return new Intl.NumberFormat('it-IT').format(value)
}
