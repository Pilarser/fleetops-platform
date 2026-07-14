import type { SessionUser } from '../types'

export interface DemoUser extends SessionUser {
	password: string
}

export const demoUsers: DemoUser[] = [
	{
		id: 'user-1',
		name: 'Fleet Manager',
		email: 'admin@example.com',
		password: 'demo1234',
		role: 'fleet_admin',
		companyName: 'Acme Italia Fleet',
	},
	{
		id: 'user-2',
		name: 'Finance Lead',
		email: 'finance@example.com',
		password: 'demo1234',
		role: 'finance',
		companyName: 'Acme Italia Fleet',
	},
	{
		id: 'user-3',
		name: 'Driver Demo',
		email: 'driver@example.com',
		password: 'demo1234',
		role: 'driver',
		companyName: 'Acme Italia Fleet',
	},
]
