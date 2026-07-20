import { ApiError } from './http.ts'

export type UserRole = 'fleet_admin' | 'manager' | 'finance' | 'driver' | 'support'

export interface SessionUser {
	id: string
	name: string
	email: string
	role: UserRole
	companyName: string
}

export interface SessionClaims extends SessionUser {
	companyId: string
	exp: number
}

const encoder = new TextEncoder()
const userRoles: UserRole[] = ['fleet_admin', 'manager', 'finance', 'driver', 'support']

function encodeBase64Url(value: Uint8Array | string) {
	const bytes = typeof value === 'string' ? encoder.encode(value) : value
	let binary = ''
	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string) {
	const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
	const binary = atob(padded)
	return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
	if (left.length !== right.length) {
		return false
	}
	let difference = 0
	for (let index = 0; index < left.length; index += 1) {
		difference |= left[index] ^ right[index]
	}
	return difference === 0
}

async function hmac(value: string, secret: string) {
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { hash: 'SHA-256', name: 'HMAC' }, false, [
		'sign',
	])
	return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

export async function verifyPassword(password: string, storedPassword: string) {
	const [algorithm, iterationsValue, salt, storedHash] = storedPassword.split('$')
	const iterations = Number(iterationsValue)
	if (algorithm !== 'pbkdf2_sha256' || !Number.isInteger(iterations) || iterations <= 0 || !salt || !storedHash) {
		return false
	}

	const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
	const candidate = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ hash: 'SHA-256', iterations, name: 'PBKDF2', salt: encoder.encode(salt) },
			key,
			256,
		),
	)
	return constantTimeEqual(candidate, decodeBase64Url(storedHash))
}

export async function createSession(user: SessionUser, companyId: string, secret: string) {
	const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
	const payload = encodeBase64Url(
		JSON.stringify({
			...user,
			companyId,
			exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
		}),
	)
	const signature = encodeBase64Url(await hmac(`${header}.${payload}`, secret))
	return `${header}.${payload}.${signature}`
}

export async function requireSession(request: Request, secret: string) {
	const authorization = request.headers.get('authorization')
	if (!authorization?.startsWith('Bearer ')) {
		throw new ApiError(401, 'Authentication required')
	}

	const token = authorization.slice('Bearer '.length)
	const [header, payload, signature] = token.split('.')
	if (!header || !payload || !signature) {
		throw new ApiError(401, 'Invalid session')
	}

	const expectedSignature = await hmac(`${header}.${payload}`, secret)
	if (!constantTimeEqual(expectedSignature, decodeBase64Url(signature))) {
		throw new ApiError(401, 'Invalid session')
	}

	try {
		const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as SessionClaims
		if (!claims.id || !claims.companyId || !userRoles.includes(claims.role) || claims.exp <= Date.now() / 1000) {
			throw new Error('Invalid claims')
		}
		return claims
	} catch {
		throw new ApiError(401, 'Invalid or expired session')
	}
}

export function requireRole(session: SessionClaims, roles: UserRole[]) {
	if (!roles.includes(session.role)) {
		throw new ApiError(403, 'Insufficient permissions')
	}
}

export function toSessionUser(session: SessionClaims): SessionUser {
	return {
		id: session.id,
		name: session.name,
		email: session.email,
		role: session.role,
		companyName: session.companyName,
	}
}

export function parseUserRole(role: string): UserRole | undefined {
	return userRoles.find((candidate) => candidate === role)
}
