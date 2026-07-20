import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SessionUser } from '../src/types'
import { createFleetServer } from './app'
import { createFleetStore } from './storage'

const tempDir = mkdtempSync(join(tmpdir(), 'fleet-api-'))
const store = createFleetStore(join(tempDir, 'fleet-db.json'))
const testUsers: SessionUser[] = [
	{
		id: 'user-admin',
		name: 'Fleet Manager',
		email: 'admin@example.com',
		role: 'fleet_admin',
		companyName: 'FleetOps Demo',
	},
	{
		id: 'user-driver',
		name: 'Driver Demo',
		email: 'driver@example.com',
		role: 'driver',
		companyName: 'FleetOps Demo',
	},
]
const server = createFleetServer(store, {
	findUser: async (email, password) => {
		if (password !== 'demo1234') {
			return undefined
		}
		return testUsers.find((user) => user.email === email.trim().toLowerCase())
	},
})
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

async function getWorkspace(token: string) {
	const response = await fetch(`${baseUrl}/api/workspace`, {
		headers: {
			authorization: `Bearer ${token}`,
		},
	})
	assert.equal(response.status, 200)
	return (await response.json()) as Awaited<ReturnType<typeof store.getWorkspace>>
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
		assert.ok((await store.getWorkspace()).drivers.some((driver) => driver.email === 'backend.test@example.com'))
	})

	it('moves a vehicle assignment from the previous driver to the selected driver', async () => {
		const token = await login()
		const workspace = await getWorkspace(token)
		const vehicle = workspace.vehicles.find((item) => item.id === 'vehicle-1')
		assert.ok(vehicle)

		const response = await fetch(`${baseUrl}/api/vehicles/${vehicle.id}`, {
			method: 'PATCH',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				...vehicle,
				assignedDriverId: 'driver-2',
			}),
		})
		assert.equal(response.status, 200)

		const updatedWorkspace = await getWorkspace(token)
		assert.equal(updatedWorkspace.drivers.find((driver) => driver.id === 'driver-1')?.vehicleId, '')
		assert.equal(updatedWorkspace.drivers.find((driver) => driver.id === 'driver-2')?.vehicleId, 'vehicle-1')
		assert.equal(updatedWorkspace.vehicles.find((item) => item.id === 'vehicle-1')?.assignedDriverId, 'driver-2')
	})

	it('moves a driver assignment away from the previous driver for the vehicle', async () => {
		const token = await login()
		const workspace = await getWorkspace(token)
		const driver = workspace.drivers.find((item) => item.id === 'driver-1')
		const vehicle = workspace.vehicles.find((item) => item.id === 'vehicle-2')
		assert.ok(driver)
		assert.ok(vehicle)

		const preconditionResponse = await fetch(`${baseUrl}/api/vehicles/${vehicle.id}`, {
			method: 'PATCH',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				...vehicle,
				assignedDriverId: 'driver-2',
			}),
		})
		assert.equal(preconditionResponse.status, 200)

		const response = await fetch(`${baseUrl}/api/drivers/${driver.id}`, {
			method: 'PATCH',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				...driver,
				vehicleId: 'vehicle-2',
			}),
		})
		assert.equal(response.status, 200)

		const updatedWorkspace = await getWorkspace(token)
		assert.equal(updatedWorkspace.drivers.find((item) => item.id === 'driver-1')?.vehicleId, 'vehicle-2')
		assert.equal(updatedWorkspace.drivers.find((item) => item.id === 'driver-2')?.vehicleId, '')
		assert.equal(updatedWorkspace.vehicles.find((item) => item.id === 'vehicle-2')?.assignedDriverId, 'driver-1')
	})

	it('allows vehicles to be unassigned', async () => {
		const token = await login()
		const workspace = await getWorkspace(token)
		const vehicle = workspace.vehicles.find((item) => item.id === 'vehicle-1')
		assert.ok(vehicle)

		const preconditionResponse = await fetch(`${baseUrl}/api/vehicles/${vehicle.id}`, {
			method: 'PATCH',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				...vehicle,
				assignedDriverId: 'driver-1',
			}),
		})
		assert.equal(preconditionResponse.status, 200)

		const response = await fetch(`${baseUrl}/api/vehicles/${vehicle.id}`, {
			method: 'PATCH',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				...vehicle,
				assignedDriverId: '',
			}),
		})
		assert.equal(response.status, 200)

		const updatedWorkspace = await getWorkspace(token)
		assert.equal(updatedWorkspace.drivers.find((driver) => driver.id === 'driver-1')?.vehicleId, '')
		assert.equal(updatedWorkspace.vehicles.find((item) => item.id === 'vehicle-1')?.assignedDriverId, '')
	})

	it('creates pending transactions and persists their review', async () => {
		const token = await login()
		const workspace = await getWorkspace(token)
		const driver = workspace.drivers[0]
		const vehicle = workspace.vehicles[0]
		const service = workspace.services.find((item) => item.enabled)
		assert.ok(driver)
		assert.ok(vehicle)
		assert.ok(service)

		const createResponse = await fetch(`${baseUrl}/api/transactions`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				date: '2026-07-20',
				driverId: driver.id,
				vehicleId: vehicle.id,
				service: service.id,
				provider: 'Workflow Test Provider',
				amount: 48.5,
				vat: 8.75,
				expenseType: 'business',
			}),
		})
		const created = (await createResponse.json()) as { id: string; status: string }
		assert.equal(createResponse.status, 201)
		assert.equal(created.status, 'pending')

		const reviewResponse = await fetch(`${baseUrl}/api/transactions/${created.id}`, {
			method: 'PATCH',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({ status: 'approved', expenseType: 'personal' }),
		})
		assert.equal(reviewResponse.status, 200)

		const updatedWorkspace = await getWorkspace(token)
		const reviewed = updatedWorkspace.transactions.find((transaction) => transaction.id === created.id)
		assert.equal(reviewed?.status, 'approved')
		assert.equal(reviewed?.expenseType, 'personal')
	})

	it('rejects transactions with fleet references that do not exist', async () => {
		const token = await login()
		const response = await fetch(`${baseUrl}/api/transactions`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({
				date: '2026-07-20',
				driverId: 'driver-missing',
				vehicleId: 'vehicle-missing',
				service: 'fuel',
				provider: 'Invalid Test Provider',
				amount: 10,
				vat: 2,
				expenseType: 'business',
			}),
		})

		assert.equal(response.status, 400)
	})

	it('blocks drivers from creating transactions', async () => {
		const token = await login('driver@example.com')
		const response = await fetch(`${baseUrl}/api/transactions`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({}),
		})

		assert.equal(response.status, 403)
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
