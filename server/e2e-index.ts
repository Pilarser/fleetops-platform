import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SessionUser } from '../src/types'
import { createApiServer } from './app'
import { createWorkspaceStore } from './storage'

const databasePath = resolve('server/.data/e2e-onemobility-db.json')
const users: Array<SessionUser & { password: string }> = [
	{
		id: 'user-admin',
		name: 'Mobility Manager',
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

createApiServer(createWorkspaceStore(databasePath), {
	findUser: async (email, password) => users.find((user) =>
		user.email === email.trim().toLowerCase() && user.password === password),
}).listen(4010, '127.0.0.1', () => {
	console.log('OneMobility E2E API listening on http://127.0.0.1:4010')
})
