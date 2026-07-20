const encoder = new TextEncoder()

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
