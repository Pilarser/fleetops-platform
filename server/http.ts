import type { IncomingMessage, ServerResponse } from 'node:http'

export interface RequestContext {
	method: string
	request: IncomingMessage
	response: ServerResponse
	url: URL
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
	response.writeHead(statusCode, {
		'access-control-allow-headers': 'content-type, authorization',
		'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
		'access-control-allow-origin': '*',
		'content-type': 'application/json',
	})
	response.end(JSON.stringify(payload))
}

export function readBody(request: IncomingMessage) {
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
