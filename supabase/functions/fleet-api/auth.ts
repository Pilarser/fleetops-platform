import { createClient, type Session } from 'supabase'
import { sql } from './database.ts'
import { ApiError } from './http.ts'
import { verifyPassword } from './passwords.ts'
import { registrationMetadataSchema } from './schemas.ts'

export type UserRole = 'fleet_admin' | 'manager' | 'finance' | 'driver' | 'support'

export interface SessionUser {
	id: string
	name: string
	email: string
	role: UserRole
	companyName: string
}

export interface AuthenticatedProfile extends SessionUser {
	authUserId: string
	companyId: string
}

type ProfileRecord = {
	id: string
	authUserId: string | null
	companyId: string
	name: string
	email: string
	password: string | null
	role: string
	companyName: string
}

const userRoles: UserRole[] = ['fleet_admin', 'manager', 'finance', 'driver', 'support']
const defaultServices = [
	['fuel', 'Fuel', 'Fuel payments and business/private expense split.', true, 1200, false],
	['charging', 'EV charging', 'Charging sessions from enabled provider networks.', true, 800, false],
	['parking', 'Parking', 'Street parking, garage payments, and parking history.', true, 300, false],
	['fines', 'Fines', 'Fine intake, assignment, payment, and dispute workflow.', true, 500, true],
	['wash', 'Car wash', 'Bookable washes with receipt consolidation.', true, 180, false],
	['tolls', 'Tolls', 'Toll device usage and toll provider reconciliation.', false, 600, false],
	['area_c', 'Area C', 'Urban access payments by plate and city rule set.', true, 160, false],
	['taxi', 'Taxi', 'Ride booking and corporate payment attribution.', false, 400, true],
] as const

function requiredEnv(name: string) {
	const value = Deno.env.get(name)
	if (!value) {
		throw new Error(`${name} is not configured`)
	}
	return value
}

function keyFromJsonEnvironment(name: string) {
	const value = Deno.env.get(name)
	if (!value) {
		return undefined
	}
	try {
		const keys = JSON.parse(value) as Record<string, string>
		return keys.default ?? Object.values(keys)[0]
	} catch {
		return undefined
	}
}

function publishableKey() {
	return Deno.env.get('SUPABASE_ANON_KEY') ?? keyFromJsonEnvironment('SUPABASE_PUBLISHABLE_KEYS') ??
		requiredEnv('SUPABASE_ANON_KEY')
}

function secretKey() {
	return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? keyFromJsonEnvironment('SUPABASE_SECRET_KEYS') ??
		requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
}

function authClient() {
	return createClient(requiredEnv('SUPABASE_URL'), publishableKey(), {
		auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
	})
}

function adminClient() {
	return createClient(requiredEnv('SUPABASE_URL'), secretKey(), {
		auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
	})
}

export function parseUserRole(role: string): UserRole | undefined {
	return userRoles.find((candidate) => candidate === role)
}

function mapProfile(record: ProfileRecord): AuthenticatedProfile {
	const role = parseUserRole(record.role)
	if (!record.authUserId || !role) {
		throw new ApiError(403, 'User profile is not configured')
	}
	return {
		id: record.id,
		authUserId: record.authUserId,
		companyId: record.companyId,
		name: record.name,
		email: record.email,
		role,
		companyName: record.companyName,
	}
}

async function findProfileByAuthUserId(authUserId: string) {
	const [record] = await sql<ProfileRecord[]>`
		select u.id, u."authUserId", u."companyId", u.name, u.email, u.password, u.role, c.name as "companyName"
		from "User" u
		join "Company" c on c.id = u."companyId"
		where u."authUserId" = ${authUserId}
		limit 1
	`
	return record ? mapProfile(record) : undefined
}

async function authenticatedIdentity(request: Request) {
	const { data, error } = await authClient().auth.getUser(bearerToken(request))
	if (error || !data.user) {
		throw new ApiError(401, 'Invalid or expired session')
	}
	return data.user
}

async function findLegacyProfile(email: string) {
	const [record] = await sql<ProfileRecord[]>`
		select u.id, u."authUserId", u."companyId", u.name, u.email, u.password, u.role, c.name as "companyName"
		from "User" u
		join "Company" c on c.id = u."companyId"
		where lower(u.email) = ${email}
		limit 1
	`
	return record
}

async function linkProfile(profileId: string, authUserId: string) {
	await sql`
		update "User"
		set "authUserId" = ${authUserId}, password = null, "updatedAt" = now()
		where id = ${profileId}
	`
}

async function findAuthUserByEmail(email: string) {
	const { data, error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
	if (error) {
		throw error
	}
	return data.users.find((user) => user.email?.toLowerCase() === email)
}

async function migrateLegacyUser(record: ProfileRecord, password: string) {
	if (!record.password || !(await verifyPassword(password, record.password))) {
		throw new ApiError(401, 'Invalid email or password')
	}

	const admin = adminClient()
	const existingAuthUser = await findAuthUserByEmail(record.email.toLowerCase())
	let authUserId = existingAuthUser?.id

	if (authUserId) {
		const { error } = await admin.auth.admin.updateUserById(authUserId, {
			email_confirm: true,
			password,
			user_metadata: { name: record.name },
		})
		if (error) {
			throw error
		}
	} else {
		const { data, error } = await admin.auth.admin.createUser({
			email: record.email,
			email_confirm: true,
			password,
			user_metadata: { name: record.name },
		})
		if (error || !data.user) {
			throw error ?? new Error('Unable to create Supabase Auth user')
		}
		authUserId = data.user.id
	}

	const { data, error } = await authClient().auth.signInWithPassword({ email: record.email, password })
	if (error || !data.session || !authUserId) {
		throw error ?? new Error('Unable to create Supabase session')
	}

	await linkProfile(record.id, authUserId)
	return { profile: await findProfileByAuthUserId(authUserId), session: data.session }
}

export async function login(emailValue: string, password: string) {
	const email = emailValue.trim().toLowerCase()
	const directLogin = await authClient().auth.signInWithPassword({ email, password })

	if (directLogin.data.session && directLogin.data.user) {
		let profile = await findProfileByAuthUserId(directLogin.data.user.id)
		if (profile) {
			await linkProfile(profile.id, directLogin.data.user.id)
		} else {
			const legacyProfile = await findLegacyProfile(email)
			if (!legacyProfile || (legacyProfile.authUserId && legacyProfile.authUserId !== directLogin.data.user.id)) {
				throw new ApiError(403, 'User profile is not configured')
			}
			await linkProfile(legacyProfile.id, directLogin.data.user.id)
			profile = await findProfileByAuthUserId(directLogin.data.user.id)
		}
		if (!profile) {
			throw new ApiError(403, 'User profile is not configured')
		}
		return { profile, session: directLogin.data.session }
	}

	const legacyProfile = await findLegacyProfile(email)
	if (!legacyProfile) {
		throw new ApiError(401, 'Invalid email or password')
	}
	const migrated = await migrateLegacyUser(legacyProfile, password)
	if (!migrated.profile) {
		throw new ApiError(403, 'User profile is not configured')
	}
	return { profile: migrated.profile, session: migrated.session }
}

function bearerToken(request: Request) {
	const authorization = request.headers.get('authorization')
	if (!authorization?.startsWith('Bearer ')) {
		throw new ApiError(401, 'Authentication required')
	}
	return authorization.slice('Bearer '.length)
}

export async function requireSession(request: Request) {
	const identity = await authenticatedIdentity(request)
	const profile = await findProfileByAuthUserId(identity.id)
	if (!profile) {
		throw new ApiError(403, 'User profile is not configured')
	}
	return profile
}

export async function completeCompanyRegistration(request: Request) {
	const identity = await authenticatedIdentity(request)
	if (!identity.email || !identity.email_confirmed_at) {
		throw new ApiError(403, 'Email verification is required')
	}

	const existingProfile = await findProfileByAuthUserId(identity.id)
	if (existingProfile) {
		return existingProfile
	}

	const metadata = registrationMetadataSchema.parse(identity.user_metadata)
	const email = identity.email.trim().toLowerCase()
	const companyId = `company-${crypto.randomUUID()}`
	const profileId = `user-${crypto.randomUUID()}`

	await sql.begin(async (transaction) => {
		const [emailOwner] = await transaction`
			select id from "User" where lower(email) = ${email} limit 1
		`
		if (emailOwner) {
			throw new ApiError(409, 'An account already exists for this email')
		}

		await transaction`
			insert into "Company" (id, name, "createdAt", "updatedAt")
			values (${companyId}, ${metadata.company_name}, now(), now())
		`
		await transaction`
			insert into "User" (id, "authUserId", "companyId", name, email, password, role, "createdAt", "updatedAt")
			values (${profileId}, ${identity.id}, ${companyId}, ${metadata.admin_name}, ${email}, null, 'fleet_admin', now(), now())
		`

		for (const [type, name, description, enabled, monthlyLimit, requiresApproval] of defaultServices) {
			await transaction`
				insert into "MobilityService" (id, "companyId", type, name, description, enabled, "monthlyLimit", "requiresApproval", "createdAt", "updatedAt")
				values (${`${companyId}:${type}`}, ${companyId}, ${type}, ${name}, ${description}, ${enabled}, ${monthlyLimit}, ${requiresApproval}, now(), now())
			`
		}
	})

	const profile = await findProfileByAuthUserId(identity.id)
	if (!profile) {
		throw new Error('Unable to create company administrator profile')
	}
	return profile
}

export function requireRole(session: AuthenticatedProfile, roles: UserRole[]) {
	if (!roles.includes(session.role)) {
		throw new ApiError(403, 'Insufficient permissions')
	}
}

export function toSessionUser(session: AuthenticatedProfile): SessionUser {
	return {
		id: session.id,
		name: session.name,
		email: session.email,
		role: session.role,
		companyName: session.companyName,
	}
}

export function sessionResponse(session: Session, profile: AuthenticatedProfile) {
	return {
		token: session.access_token,
		refreshToken: session.refresh_token,
		expiresAt: session.expires_at,
		user: toSessionUser(profile),
	}
}
