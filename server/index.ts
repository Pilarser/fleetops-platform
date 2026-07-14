import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { drivers as seedDrivers, providers, services as seedServices, transactions, vehicles as seedVehicles } from '../src/data/mock-data'
import type { Driver, MobilityService, Vehicle } from '../src/types'

const port = Number(process.env.PORT ?? 4000)

let drivers = structuredClone(seedDrivers)
let services = structuredClone(seedServices)
let vehicles = structuredClone(seedVehicles)

function nextId(prefix: string) {
	return `${prefix}-${Date.now()}`
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
	response.writeHead(statusCode, {
		'access-control-allow-headers': 'content-type',
		'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
		'access-control-allow-origin': '*',
		'content-type': 'application/json',
	})
	response.end(JSON.stringify(payload))
}

function readBody(request: IncomingMessage) {
	return new Promise<unknown>((resolve, reject) => {
		let body = ''
		request.on('data', (chunk: Buffer) => {
			body += chunk.toString('utf8')
		})
		request.on('end', () => {
			if (!body) {
				resolve({})
				return
			}

			try {
				resolve(JSON.parse(body))
			} catch (error) {
				reject(error)
			}
		})
		request.on('error', reject)
	})
}

function workspacePayload() {
	return {
		drivers,
		providers,
		services,
		transactions,
		vehicles,
	}
}

createServer(async (request, response) => {
	const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
	const method = request.method ?? 'GET'

	if (method === 'OPTIONS') {
		sendJson(response, 204, null)
		return
	}

	try {
		if (method === 'GET' && url.pathname === '/api/health') {
			sendJson(response, 200, { ok: true })
			return
		}

		if (method === 'GET' && url.pathname === '/api/workspace') {
			sendJson(response, 200, workspacePayload())
			return
		}

		if (method === 'POST' && url.pathname === '/api/drivers') {
			const payload = (await readBody(request)) as Omit<Driver, 'id' | 'monthlySpend' | 'personalSpend'>
			const driver: Driver = {
				...payload,
				id: nextId('driver'),
				monthlySpend: 0,
				personalSpend: 0,
			}
			drivers = [...drivers, driver]
			sendJson(response, 201, driver)
			return
		}

		if (method === 'PATCH' && url.pathname.startsWith('/api/drivers/')) {
			const id = decodeURIComponent(url.pathname.replace('/api/drivers/', ''))
			const payload = (await readBody(request)) as Driver
			drivers = drivers.map((driver) => (driver.id === id ? { ...payload, id } : driver))
			sendJson(response, 200, drivers.find((driver) => driver.id === id))
			return
		}

		if (method === 'POST' && url.pathname === '/api/vehicles') {
			const payload = (await readBody(request)) as Omit<Vehicle, 'id' | 'monthlySpend'>
			const vehicle: Vehicle = {
				...payload,
				id: nextId('vehicle'),
				monthlySpend: 0,
			}
			vehicles = [...vehicles, vehicle]
			sendJson(response, 201, vehicle)
			return
		}

		if (method === 'PATCH' && url.pathname.startsWith('/api/vehicles/')) {
			const id = decodeURIComponent(url.pathname.replace('/api/vehicles/', ''))
			const payload = (await readBody(request)) as Vehicle
			vehicles = vehicles.map((vehicle) => (vehicle.id === id ? { ...payload, id } : vehicle))
			sendJson(response, 200, vehicles.find((vehicle) => vehicle.id === id))
			return
		}

		if (method === 'PATCH' && url.pathname.startsWith('/api/services/')) {
			const id = decodeURIComponent(url.pathname.replace('/api/services/', '')) as MobilityService['id']
			services = services.map((service) => (service.id === id ? { ...service, enabled: !service.enabled } : service))
			sendJson(response, 200, services.find((service) => service.id === id))
			return
		}

		sendJson(response, 404, { message: 'Not found' })
	} catch (error) {
		sendJson(response, 500, {
			message: error instanceof Error ? error.message : 'Unexpected server error',
		})
	}
}).listen(port, () => {
	console.log(`Fleet API listening on http://127.0.0.1:${port}`)
})
