import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { SessionUser, UserRole } from '../src/types'
import { sendJson } from './http'
import { verifyPassword } from './passwords'
import { prisma } from './prisma'

const sessions = new Map<string, SessionUser>()

export interface AuthProvider {
	findUser: (email: string, password: string) => Promise<SessionUser | undefined>
}

const userRoles = ['fleet_admin', 'manager', 'finance', 'driver', 'support'] satisfies UserRole[]

function isUserRole(role: string): role is UserRole {
	return userRoles.includes(role as UserRole)
}

export async function findUserByCredentials(email: string, password: string) {
	const user = await prisma.user.findUnique({
		include: { company: true },
		where: { email: email.trim().toLowerCase() },
	})

	if (!user || !user.password || !verifyPassword(password, user.password) || !isUserRole(user.role)) {
		return undefined
	}

	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		companyName: user.company.name,
	}
}

export const prismaAuthProvider: AuthProvider = {
	findUser: findUserByCredentials,
}

export function createSession(user: SessionUser) {
	const token = `demo-token-${randomUUID()}`
	sessions.set(token, user)
	return token
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
