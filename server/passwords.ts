import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

const algorithm = 'pbkdf2_sha256'
const iterations = 310000
const keyLength = 32
const digest = 'sha256'

export function hashPassword(password: string) {
	const salt = randomBytes(16).toString('base64url')
	const hash = pbkdf2Sync(password, salt, iterations, keyLength, digest).toString('base64url')
	return `${algorithm}$${iterations}$${salt}$${hash}`
}

export function verifyPassword(password: string, storedPassword: string) {
	const [storedAlgorithm, storedIterations, salt, storedHash] = storedPassword.split('$')
	if (storedAlgorithm !== algorithm || !storedIterations || !salt || !storedHash) {
		return false
	}

	const parsedIterations = Number(storedIterations)
	if (!Number.isInteger(parsedIterations) || parsedIterations <= 0) {
		return false
	}

	const candidateHash = pbkdf2Sync(password, salt, parsedIterations, keyLength, digest)
	const storedHashBuffer = Buffer.from(storedHash, 'base64url')

	if (candidateHash.length !== storedHashBuffer.length) {
		return false
	}

	return timingSafeEqual(candidateHash, storedHashBuffer)
}
