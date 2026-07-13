import type { ReactNode } from 'react'

type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'gray'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
	return <section className={`card ${className}`}>{children}</section>
}

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string
	description: string
	actions?: ReactNode
}) {
	return (
		<div className="page-header">
			<div>
				<h1>{title}</h1>
				<p>{description}</p>
			</div>
			{actions ? <div className="page-actions">{actions}</div> : null}
		</div>
	)
}

export function MetricCard({
	label,
	value,
	detail,
	icon,
}: {
	label: string
	value: string
	detail: string
	icon: ReactNode
}) {
	return (
		<Card className="metric-card">
			<div className="metric-icon">{icon}</div>
			<div>
				<p className="metric-label">{label}</p>
				<strong>{value}</strong>
				<span>{detail}</span>
			</div>
		</Card>
	)
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: BadgeTone }) {
	return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Button({ children }: { children: ReactNode }) {
	return <button className="button">{children}</button>
}

export function Table<T>({
	columns,
	rows,
	renderRow,
}: {
	columns: string[]
	rows: T[]
	renderRow: (row: T) => ReactNode
}) {
	return (
		<div className="table-wrap">
			<table>
				<thead>
					<tr>
						{columns.map((column) => (
							<th key={column}>{column}</th>
						))}
					</tr>
				</thead>
				<tbody>{rows.map((row) => renderRow(row))}</tbody>
			</table>
		</div>
	)
}
