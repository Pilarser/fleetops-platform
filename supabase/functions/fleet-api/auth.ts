import { createClient, type Session } from 'supabase'
import { sql } from './database.ts'
import { ApiError } from './http.ts'
import { registrationMetadataSchema } from './schemas.ts'

export type UserRole = 'fleet_admin' | 'manager' | 'finance' | 'driver' | 'support'

export interface SessionUser {
	id: string
	name: string
	email: string
	role: UserRole
	companyName: string
	membershipStatus: 'active' | 'invited' | 'disabled'
}

export interface AuthenticatedProfile extends SessionUser {
	authUserId: string
	companyId: string
	status: 'active' | 'invited' | 'disabled'
}

type ProfileRecord = {
	id: string
	authUserId: string | null
	companyId: string
	name: string
	email: string
	role: string
	status: string
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
		status: record.status === 'invited' || record.status === 'disabled' ? record.status : 'active',
		membershipStatus: record.status === 'invited' || record.status === 'disabled' ? record.status : 'active',
		companyName: record.companyName,
	}
}

async function findProfileByAuthUserId(authUserId: string) {
	const [record] = await sql<ProfileRecord[]>`
		select u.id, u."authUserId", u."companyId", u.name, u.email, u.role, u.status, c.name as "companyName"
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

async function findProfileByEmail(email: string) {
	const [record] = await sql<ProfileRecord[]>`
		select u.id, u."authUserId", u."companyId", u.name, u.email, u.role, u.status, c.name as "companyName"
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
		set "authUserId" = ${authUserId}, "updatedAt" = now()
		where id = ${profileId}
	`
}

export async function login(emailValue: string, password: string) {
	const email = emailValue.trim().toLowerCase()
	const directLogin = await authClient().auth.signInWithPassword({ email, password })

	if (directLogin.data.session && directLogin.data.user) {
		let profile = await findProfileByAuthUserId(directLogin.data.user.id)
		if (profile) {
			await linkProfile(profile.id, directLogin.data.user.id)
		} else {
			const emailProfile = await findProfileByEmail(email)
			if (!emailProfile || (emailProfile.authUserId && emailProfile.authUserId !== directLogin.data.user.id)) {
				throw new ApiError(403, 'User profile is not configured')
			}
			await linkProfile(emailProfile.id, directLogin.data.user.id)
			profile = await findProfileByAuthUserId(directLogin.data.user.id)
		}
		if (!profile) {
			throw new ApiError(403, 'User profile is not configured')
		}
		if (profile.status === 'disabled') {
			throw new ApiError(403, 'This account has been disabled. Contact your fleet administrator.')
		}
		return { profile, session: directLogin.data.session }
	}

	const emailProfile = await findProfileByEmail(email)
	if (emailProfile?.status === 'disabled') {
		throw new ApiError(403, 'This account has been disabled. Contact your fleet administrator.')
	}
	throw new ApiError(401, 'Invalid email or password')
}

type AccountLifecycleAction = 'resend_invitation' | 'revoke_invitation' | 'disable' | 'reactivate'

type ManagedAccount = {
	id: string
	authUserId: string | null
	companyId: string
	name: string
	email: string
	role: UserRole
	status: 'active' | 'invited' | 'disabled'
	driverId: string | null
}

function invitationMetadata(account: ManagedAccount) {
	return {
		company_id: account.companyId,
		...(account.driverId ? { driver_id: account.driverId } : {}),
		invitation_pending: true,
		name: account.name,
		role: account.role,
	}
}

export async function manageAccountLifecycle(
	session: AuthenticatedProfile,
	accountId: string,
	action: AccountLifecycleAction,
	redirectUrl?: string,
) {
	const [record] = await sql<ManagedAccount[]>`
		select u.id, u."authUserId", u."companyId", u.name, u.email, u.role, u.status, d.id as "driverId"
		from "User" u
		left join "Driver" d on d."userId" = u.id
		where u.id = ${accountId} and u."companyId" = ${session.companyId}
		limit 1
	`
	if (!record) {
		throw new ApiError(404, 'Account not found')
	}

	const role = parseUserRole(record.role)
	if (!role) {
		throw new ApiError(400, 'Account role is invalid')
	}
	const account: ManagedAccount = {
		...record,
		role,
		status: record.status === 'invited' || record.status === 'disabled' ? record.status : 'active',
	}
	if (session.role === 'manager' && account.role !== 'driver') {
		throw new ApiError(403, 'Managers can only manage driver accounts')
	}
	const admin = adminClient()

	if (action === 'resend_invitation') {
		if (account.status !== 'invited' || !redirectUrl) {
			throw new ApiError(409, 'Only pending invitations can be resent')
		}
		if (account.authUserId) {
			const { error } = await admin.auth.admin.deleteUser(account.authUserId)
			if (error) throw error
			await sql`update "User" set "authUserId" = null, "updatedAt" = now() where id = ${account.id}`
		}
		const { data, error } = await admin.auth.admin.inviteUserByEmail(account.email, {
			data: invitationMetadata(account),
			redirectTo: redirectUrl,
		})
		if (error || !data.user) {
			throw new ApiError(409, error?.message ?? 'Unable to resend the invitation')
		}
		try {
			await sql`update "User" set "authUserId" = ${data.user.id}, "updatedAt" = now() where id = ${account.id}`
		} catch (profileError) {
			await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined)
			throw profileError
		}
	}

	if (action === 'revoke_invitation') {
		if (account.status !== 'invited') {
			throw new ApiError(409, 'Only pending invitations can be revoked')
		}
		if (account.authUserId) {
			const { error } = await admin.auth.admin.deleteUser(account.authUserId)
			if (error) throw error
		}
		await sql`delete from "User" where id = ${account.id} and "companyId" = ${session.companyId}`
	}

	if (action === 'disable') {
		if (account.id === session.id) {
			throw new ApiError(400, 'You cannot disable your own account')
		}
		if (account.status !== 'active' || !account.authUserId) {
			throw new ApiError(409, 'Only active accounts can be disabled')
		}
		const { error } = await admin.auth.admin.updateUserById(account.authUserId, { ban_duration: '876000h' })
		if (error) throw error
		try {
			await sql`update "User" set status = 'disabled', "updatedAt" = now() where id = ${account.id}`
		} catch (profileError) {
			await admin.auth.admin.updateUserById(account.authUserId, { ban_duration: 'none' }).catch(() => undefined)
			throw profileError
		}
	}

	if (action === 'reactivate') {
		if (account.status !== 'disabled' || !account.authUserId) {
			throw new ApiError(409, 'Only disabled accounts can be reactivated')
		}
		const { error } = await admin.auth.admin.updateUserById(account.authUserId, { ban_duration: 'none' })
		if (error) throw error
		await sql`update "User" set status = 'active', "updatedAt" = now() where id = ${account.id}`
	}

	return { id: account.id, action }
}

export async function inviteCompanyMember(
	session: AuthenticatedProfile,
	payload: { name: string; email: string; role: 'manager' | 'finance' | 'support'; redirectUrl: string },
) {
	const [existingProfile] = await sql`select id from "User" where lower(email) = ${payload.email} limit 1`
	if (existingProfile) {
		throw new ApiError(409, 'A user profile already exists for this email')
	}

	const admin = adminClient()
	const { data, error } = await admin.auth.admin.inviteUserByEmail(payload.email, {
		data: {
			company_id: session.companyId,
			invitation_pending: true,
			name: payload.name,
			role: payload.role,
		},
		redirectTo: payload.redirectUrl,
	})
	if (error || !data.user) {
		throw new ApiError(409, error?.message ?? 'Unable to invite this user')
	}

	const profileId = `user-${crypto.randomUUID()}`
	try {
		const [member] = await sql`
			insert into "User" (id, "authUserId", "companyId", name, email, role, status, "createdAt", "updatedAt")
			values (${profileId}, ${data.user.id}, ${session.companyId}, ${payload.name}, ${payload.email}, ${payload.role}, 'invited', now(), now())
			returning id, name, email, role, status
		`
		return member
	} catch (profileError) {
		await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined)
		throw profileError
	}
}

export async function inviteDriverAccount(
	session: AuthenticatedProfile,
	driverId: string,
	redirectUrl: string,
) {
	const [driver] = await sql<{ id: string; name: string; email: string; userId: string | null }[]>`
		select id, name, email, "userId"
		from "Driver"
		where id = ${driverId} and "companyId" = ${session.companyId}
		limit 1
	`
	if (!driver) {
		throw new ApiError(404, 'Driver not found')
	}
	if (driver.userId) {
		throw new ApiError(409, 'This driver already has a login account')
	}

	const email = driver.email.trim().toLowerCase()
	const [existingProfile] = await sql`select id from "User" where lower(email) = ${email} limit 1`
	if (existingProfile) {
		throw new ApiError(409, 'A user profile already exists for this email')
	}

	const admin = adminClient()
	const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
		data: {
			company_id: session.companyId,
			driver_id: driver.id,
			invitation_pending: true,
			name: driver.name,
			role: 'driver',
		},
		redirectTo: redirectUrl,
	})
	if (error || !data.user) {
		throw new ApiError(409, error?.message ?? 'Unable to invite this driver')
	}

	const profileId = `user-${crypto.randomUUID()}`
	try {
		await sql.begin(async (transaction) => {
			await transaction`
				insert into "User" (id, "authUserId", "companyId", name, email, role, status, "createdAt", "updatedAt")
				values (${profileId}, ${data.user.id}, ${session.companyId}, ${driver.name}, ${email}, 'driver', 'invited', now(), now())
			`
			const [linkedDriver] = await transaction`
				update "Driver"
				set "userId" = ${profileId}, "updatedAt" = now()
				where id = ${driver.id} and "companyId" = ${session.companyId} and "userId" is null
				returning id
			`
			if (!linkedDriver) {
				throw new ApiError(409, 'This driver already has a login account')
			}
		})
		return { driverId: driver.id, accountStatus: 'invited' as const }
	} catch (profileError) {
		await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined)
		throw profileError
	}
}

export async function activateInvitation(session: AuthenticatedProfile) {
	const [member] = await sql`
		update "User"
		set status = 'active', "updatedAt" = now()
		where id = ${session.id} and "companyId" = ${session.companyId}
		returning id
	`
	if (!member) {
		throw new ApiError(404, 'Membership not found')
	}
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
	if (profile.status === 'disabled') {
		throw new ApiError(403, 'This account has been disabled. Contact your fleet administrator.')
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
			insert into "User" (id, "authUserId", "companyId", name, email, role, "createdAt", "updatedAt")
			values (${profileId}, ${identity.id}, ${companyId}, ${metadata.admin_name}, ${email}, 'fleet_admin', now(), now())
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
	if (session.status !== 'active') {
		throw new ApiError(403, 'Invitation setup is incomplete')
	}
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
		membershipStatus: session.status,
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
