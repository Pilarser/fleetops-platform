export function formatCurrency(amount: number) {
	return new Intl.NumberFormat('it-IT', {
		style: 'currency',
		currency: 'EUR',
	}).format(amount)
}

export function formatNumber(value: number) {
	return new Intl.NumberFormat('it-IT').format(value)
}
