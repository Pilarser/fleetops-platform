export const corsHeaders = {
	'access-control-allow-headers': 'authorization, content-type',
	'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
	'access-control-allow-origin': '*',
}

export function json(payload: unknown, status = 200) {
	return Response.json(payload, {
		status,
		headers: corsHeaders,
	})
}

export async function readJson(request: Request) {
	try {
		return await request.json()
	} catch {
		throw new ApiError(400, 'Request body must be valid JSON')
	}
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message)
	}
}
