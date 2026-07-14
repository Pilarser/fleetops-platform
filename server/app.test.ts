import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFleetServer } from './app'
import { createFleetStore } from './storage'

const tempDir = mkdtempSync(join(tmpdir(), 'fleet-api-'))
const store = createFleetStore(join(tempDir, 'fleet-db.json'))
const server = createFleetServer(store)
let baseUrl = ''

before(async () => {
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			const address = server.address()
			assert(address && typeof address === 'object')
			baseUrl = `http://127.0.0.1:${address.port}`
			resolve()
		})
	})
})

after(async () => {
	await new Promise<void>((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()))
	})
	rmSync(tempDir, { force: true, recursive: true })
})

async function login(email = 'admin@example.com') {
	const response = await fetch(`${baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			email,
			password: 'demo1234',
		}),
	})
	const payload = (await response.json()) as { token: string }
	return payload.token
}

describe('fleet API', () => {
	it('rejects unauthenticated workspace access', async () => {
		const response = await fetch(`${baseUrl}/api/workspace`)
		assert.equal(response.status, 401)
	})

	it('logs in with demo credentials', async () => {
		const response = await fetch(`${baseUrl}/api/auth/login`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				email: 'admin@example.com',
				password: 'demo1234',
			}),
		})
		const payload = (await response.json()) as { token?: string; user?: { role: string } }

		assert.equal(response.status, 200)
		assert.equal(payload.user?.role, 'fleet_admin')
		assert.ok(payload.token)
	})

	it('rejects invalid driver payloads', async () => {
		const token = await login()
		const response = await fetch(`${baseUrl}/api/drivers`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				email: 'not-an-email',
			}),
		})

		assert.equal(response.status, 400)
	})

	it('persists created drivers in the store', async () => {
		const token = await login()
		const response = await fetch(`${baseUrl}/api/drivers`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				name: 'Backend Test',
				email: 'backend.test@example.com',
				status: 'active',
				vehicleId: 'vehicle-1',
				costCenter: 'QA',
			}),
		})

		assert.equal(response.status, 201)
		assert.ok(store.getWorkspace().drivers.some((driver) => driver.email === 'backend.test@example.com'))
	})

	it('blocks driver role from admin workspace access', async () => {
		const token = await login('driver@example.com')
		const response = await fetch(`${baseUrl}/api/workspace`, {
			headers: {
				authorization: `Bearer ${token}`,
			},
		})

		assert.equal(response.status, 403)
	})
})
