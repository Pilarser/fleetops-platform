import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { demoUsers } from '../src/data/demo-users'
import type { SessionUser, UserRole } from '../src/types'
import { sendJson } from './http'

const sessions = new Map<string, SessionUser>()

export function publicUser(user: (typeof demoUsers)[number]): SessionUser {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		companyName: user.companyName,
	}
}

export function createSession(user: SessionUser) {
	const token = `demo-token-${randomUUID()}`
	sessions.set(token, user)
	return token
}

export function findDemoUser(email: string, password: string) {
	return demoUsers.find((user) => user.email === email.trim().toLowerCase() && user.password === password)
}

function getBearerToken(request: IncomingMessage) {
	const authorization = request.headers.authorization
	if (!authorization?.startsWith('Bearer ')) {
		return undefined
	}
	return authorization.replace('Bearer ', '')
}

export function requireUser(request: IncomingMessage, response: ServerResponse) {
	const token = getBearerToken(request)
	const user = token ? sessions.get(token) : undefined
	if (!user) {
		sendJson(response, 401, { message: 'Authentication required' })
		return undefined
	}
	return user
}

export function requireRole(request: IncomingMessage, response: ServerResponse, roles: UserRole[]) {
	const user = requireUser(request, response)
	if (!user) {
		return undefined
	}
	if (!roles.includes(user.role)) {
		sendJson(response, 403, { message: 'Insufficient permissions' })
		return undefined
	}
	return user
}
