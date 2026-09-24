import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SessionUser } from '../src/types'
import { createFleetServer } from './app'
import { createFleetStore } from './storage'

const databasePath = resolve('server/.data/e2e-fleet-db.json')
const users: Array<SessionUser & { password: string }> = [
	{
		id: 'user-admin',
		name: 'Fleet Manager',
		email: 'admin@example.com',
		password: 'demo1234',
		role: 'fleet_admin',
		companyName: 'OneMobility Demo',
	},
	{
		id: 'user-driver',
		name: 'Driver User',
		email: 'driver@example.com',
		password: 'demo1234',
		role: 'driver',
		companyName: 'OneMobility Demo',
	},
]

rmSync(databasePath, { force: true })

createFleetServer(createFleetStore(databasePath), {
	findUser: async (email, password) => users.find((user) =>
		user.email === email.trim().toLowerCase() && user.password === password),
}).listen(4010, '127.0.0.1', () => {
	console.log('Fleet E2E API listening on http://127.0.0.1:4010')
})
