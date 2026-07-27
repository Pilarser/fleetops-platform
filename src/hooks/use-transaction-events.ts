import { useEffect, useState } from 'react'
import { fleetApi } from '../services/fleet-api'
import type { TransactionEvent } from '../types'

export function useTransactionEvents(transactionId?: string, refreshKey?: string) {
	const [events, setEvents] = useState<TransactionEvent[]>([])
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		if (!transactionId) {
			setEvents([])
			setError('')
			return
		}

		let active = true
		setIsLoading(true)
		setError('')
		fleetApi.getTransactionEvents(transactionId)
			.then((history) => {
				if (active) setEvents(history)
			})
			.catch((loadError) => {
				if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load transaction history')
			})
			.finally(() => {
				if (active) setIsLoading(false)
			})

		return () => {
			active = false
		}
	}, [refreshKey, transactionId])

	return { events, error, isLoading }
}
