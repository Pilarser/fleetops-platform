import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'

export function NotFoundPage() {
	return (
		<>
			<PageHeader title="Page not found" description="The requested fleet workspace page does not exist." />
			<Card>
				<Link className="text-link" to="/">
					Back to dashboard
				</Link>
			</Card>
		</>
	)
}
