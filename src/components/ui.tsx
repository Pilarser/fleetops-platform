import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'gray'
type ButtonVariant = 'primary' | 'secondary' | 'ghost'

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

export function Button({
	children,
	variant = 'primary',
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: ButtonVariant }) {
	return (
		<button className={`button button-${variant}`} {...props}>
			{children}
		</button>
	)
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
	return <input className="field" {...props} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
	return <select className="field" {...props} />
}

export function Field({
	label,
	children,
}: {
	label: string
	children: ReactNode
}) {
	return (
		<label className="field-group">
			<span>{label}</span>
			{children}
		</label>
	)
}

export function Toolbar({ children }: { children: ReactNode }) {
	return <div className="toolbar">{children}</div>
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
	return (
		<div className="empty-state">
			<strong>{title}</strong>
			<span>{detail}</span>
		</div>
	)
}

export function Dialog({
	children,
	onClose,
	title,
}: {
	children: ReactNode
	onClose: () => void
	title: string
}) {
	return (
		<div className="overlay" role="presentation">
			<section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
				<div className="dialog-header">
					<h2>{title}</h2>
					<Button type="button" variant="ghost" onClick={onClose}>
						Close
					</Button>
				</div>
				{children}
			</section>
		</div>
	)
}

export function Drawer({
	children,
	onClose,
	title,
}: {
	children: ReactNode
	onClose: () => void
	title: string
}) {
	return (
		<div className="overlay overlay-right" role="presentation">
			<aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
				<div className="dialog-header">
					<h2>{title}</h2>
					<Button type="button" variant="ghost" onClick={onClose}>
						Close
					</Button>
				</div>
				{children}
			</aside>
		</div>
	)
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
