import { z } from 'zod'

export {
	currencySchema,
	driverExpensePayloadSchema,
	driverPayloadSchema,
	driverTransactionPayloadSchema,
	expensePayloadSchema,
	expenseReviewSchema,
	expenseTypeSchema,
	serviceIdSchema,
	transactionPayloadSchema,
	transactionReviewSchema,
	vehiclePayloadSchema,
} from '../../../shared/schemas.ts'

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
})

export const registrationMetadataSchema = z.object({
	admin_name: z.string().trim().min(2).max(100),
	company_name: z.string().trim().min(2).max(120),
	registration_intent: z.literal('company_admin'),
})

export const teamInvitationSchema = z.object({
	name: z.string().trim().min(2).max(100),
	email: z.string().email().transform((email) => email.trim().toLowerCase()),
	role: z.enum(['manager', 'finance', 'support']),
	redirectUrl: z.string().url(),
})

export const driverInvitationSchema = z.object({ redirectUrl: z.string().url() })

export const accountLifecycleSchema = z.object({
	action: z.enum(['resend_invitation', 'revoke_invitation', 'disable', 'reactivate']),
	redirectUrl: z.string().url().optional(),
})

export const receiptUploadSchema = z.object({
	fileName: z.string().trim().min(1).max(180),
	contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
	size: z.number().int().positive().max(5 * 1024 * 1024),
})

export const receiptConfirmationSchema = receiptUploadSchema.extend({ path: z.string().min(1).max(500) })
