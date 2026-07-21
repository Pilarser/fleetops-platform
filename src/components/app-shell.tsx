import {
	BarChart3,
	Car,
	CreditCard,
	FileText,
	Gauge,
	MapPinned,
	Settings2,
	Users,
	UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Button } from './ui'
import { useAuth } from '../state/auth'
import { hasSupabaseAuth } from '../services/supabase-auth'

const navItems = [
	{ to: '/', label: 'Dashboard', icon: Gauge },
	{ to: '/vehicles', label: 'Vehicles', icon: Car },
	{ to: '/drivers', label: 'Drivers', icon: Users },
	{ to: '/transactions', label: 'Transactions', icon: CreditCard },
	{ to: '/services', label: 'Services', icon: Settings2 },
	{ to: '/providers', label: 'Providers', icon: MapPinned },
	{ to: '/reports', label: 'Reports', icon: BarChart3 },
]

export function AppShell({ children }: { children: ReactNode }) {
	const { logout, user } = useAuth()
	const visibleNavItems = user?.role === 'driver'
		? navItems.slice(0, 1)
		: user?.role === 'fleet_admin' && hasSupabaseAuth()
			? [...navItems, { to: '/team', label: 'Team', icon: UsersRound }]
			: navItems

	return (
		<div className="app-shell">
			<aside className="sidebar">
				<div className="brand">
					<div className="brand-mark">
						<FileText size={22} />
					</div>
					<div>
						<strong>FleetOS</strong>
						<span>Mobility control</span>
					</div>
				</div>

				<nav className="nav">
					{visibleNavItems.map((item) => {
						const Icon = item.icon
						return (
							<NavLink key={item.to} to={item.to} end={item.to === '/'}>
								<Icon size={18} />
								<span>{item.label}</span>
							</NavLink>
						)
					})}
				</nav>
			</aside>

			<div className="main-area">
				<header className="topbar">
					<div>
						<span className="topbar-label">Workspace</span>
						<strong>{user?.companyName ?? 'Fleet workspace'}</strong>
					</div>
					<div className="topbar-user">
						<span>{user?.name.split(' ').map((part) => part[0]).join('').slice(0, 2) ?? 'U'}</span>
						<div>
							<strong>{user?.name}</strong>
							<small>{user?.role.replace('_', ' ')} - {user?.email}</small>
						</div>
						<Button type="button" variant="secondary" onClick={logout}>
							Logout
						</Button>
					</div>
				</header>
				<main className="content">{children}</main>
			</div>
		</div>
	)
}
