import { Check, FileText, History, LoaderCircle, Pencil, Send, Undo2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TransactionEvent, TransactionEventType } from '../types'

const eventPresentation: Record<TransactionEventType, { label: string; icon: ReactNode }> = {
	submitted: { label: 'Submitted', icon: <Send size={15} /> },
	edited: { label: 'Edited', icon: <Pencil size={15} /> },
	receipt_attached: { label: 'Receipt attached', icon: <FileText size={15} /> },
	receipt_replaced: { label: 'Receipt replaced', icon: <FileText size={15} /> },
	approved: { label: 'Approved', icon: <Check size={15} /> },
	rejected: { label: 'Rejected', icon: <X size={15} /> },
	withdrawn: { label: 'Withdrawn', icon: <Undo2 size={15} /> },
}

function eventDetail(event: TransactionEvent) {
	const summary = typeof event.details.summary === 'string' ? event.details.summary : eventPresentation[event.type].label
	const changes = event.details.changes && typeof event.details.changes === 'object'
		? Object.keys(event.details.changes as Record<string, unknown>)
		: []
	return changes.length > 0 ? `${summary} Changed: ${changes.join(', ')}.` : summary
}

export function TransactionTimeline({ events, error, isLoading }: { events: TransactionEvent[]; error: string; isLoading: boolean }) {
	return (
		<section className="audit-section" aria-label="Transaction history">
			<div className="audit-heading"><History size={17} /><h3>Activity history</h3></div>
			{isLoading ? <div className="audit-state" role="status"><LoaderCircle className="spinner" size={16} /> Loading history</div> : null}
			{error ? <p className="form-error">{error}</p> : null}
			{!isLoading && !error && events.length === 0 ? <p className="audit-state">No activity has been recorded.</p> : null}
			{events.length > 0 ? (
				<ol className="audit-timeline">
					{events.map((event) => {
						const presentation = eventPresentation[event.type]
						return (
							<li key={event.id}>
								<span className="audit-icon">{presentation.icon}</span>
								<div><strong>{presentation.label}</strong><p>{eventDetail(event)}</p><small>{event.actorName} · {new Date(event.createdAt).toLocaleString()}</small></div>
							</li>
						)
					})}
				</ol>
			) : null}
		</section>
	)
}
