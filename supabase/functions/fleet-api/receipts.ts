import { adminClient, type AuthenticatedProfile } from './auth.ts'
import { ApiError } from './http.ts'
import { confirmTransactionReceipt, getTransactionReceiptAccess } from './database.ts'

export const receiptBucket = 'fleet-receipts'

type ReceiptMetadata = {
	fileName: string
	contentType: 'application/pdf' | 'image/jpeg' | 'image/png'
	size: number
}

const extensions: Record<ReceiptMetadata['contentType'], string> = {
	'application/pdf': 'pdf',
	'image/jpeg': 'jpg',
	'image/png': 'png',
}

async function ensureReceiptBucket() {
	const client = adminClient()
	const { data } = await client.storage.getBucket(receiptBucket)
	if (data) return client

	const { error } = await client.storage.createBucket(receiptBucket, {
		public: false,
		fileSizeLimit: 5 * 1024 * 1024,
		allowedMimeTypes: Object.keys(extensions),
	})
	if (error && !error.message.toLowerCase().includes('already exists')) {
		throw new ApiError(500, 'Receipt storage is unavailable')
	}
	return client
}

export async function createReceiptUpload(session: AuthenticatedProfile, transactionId: string, metadata: ReceiptMetadata) {
	const access = await getTransactionReceiptAccess(session.companyId, session.id, session.role, transactionId, true)
	const path = `${session.companyId}/${access.driverId}/${transactionId}/${crypto.randomUUID()}.${extensions[metadata.contentType]}`
	const client = await ensureReceiptBucket()
	const { data, error } = await client.storage.from(receiptBucket).createSignedUploadUrl(path)
	if (error || !data?.token) throw new ApiError(500, 'Unable to authorize receipt upload')
	return { bucket: receiptBucket, path, token: data.token }
}

export async function confirmReceipt(session: AuthenticatedProfile, transactionId: string, metadata: ReceiptMetadata & { path: string }) {
	const access = await getTransactionReceiptAccess(session.companyId, session.id, session.role, transactionId, true)
	const expectedPrefix = `${session.companyId}/${access.driverId}/${transactionId}/`
	if (!metadata.path.startsWith(expectedPrefix)) throw new ApiError(400, 'Invalid receipt path')

	const client = await ensureReceiptBucket()
	const separator = metadata.path.lastIndexOf('/')
	const folder = metadata.path.slice(0, separator)
	const objectName = metadata.path.slice(separator + 1)
	const { data: objects, error } = await client.storage.from(receiptBucket).list(folder, {
		limit: 2,
		search: objectName,
	})
	const object = objects?.find((candidate) => candidate.name === objectName && candidate.id)
	const actualSize = Number(object?.metadata?.size)
	const actualType = String(object?.metadata?.mimetype ?? '')
	if (error || !object || actualSize !== metadata.size || actualType !== metadata.contentType) {
		throw new ApiError(400, 'Uploaded receipt does not match the selected file')
	}

	const updated = await confirmTransactionReceipt(session.companyId, session.id, transactionId, metadata)
	if (access.receiptPath && access.receiptPath !== metadata.path) {
		await client.storage.from(receiptBucket).remove([access.receiptPath])
	}
	return updated
}

export async function createReceiptDownload(session: AuthenticatedProfile, transactionId: string) {
	const access = await getTransactionReceiptAccess(session.companyId, session.id, session.role, transactionId, false)
	if (!access.receiptPath || !access.receiptName) throw new ApiError(404, 'No receipt is attached')
	const client = await ensureReceiptBucket()
	const { data, error } = await client.storage.from(receiptBucket).createSignedUrl(access.receiptPath, 60, {
		download: access.receiptName,
	})
	if (error || !data?.signedUrl) throw new ApiError(500, 'Unable to open receipt')
	return { url: data.signedUrl, expiresIn: 60 }
}
