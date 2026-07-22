import { z } from 'zod'

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

export const driverInvitationSchema = z.object({
	redirectUrl: z.string().url(),
})

export const accountLifecycleSchema = z.object({
	action: z.enum(['resend_invitation', 'revoke_invitation', 'disable', 'reactivate']),
	redirectUrl: z.string().url().optional(),
})

export const driverPayloadSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	status: z.enum(['active', 'suspended']),
	vehicleId: z.string(),
	costCenter: z.string().min(1),
})

export const vehiclePayloadSchema = z.object({
	plate: z.string().min(1),
	make: z.string().min(1),
	model: z.string().min(1),
	fuelType: z.enum(['diesel', 'petrol', 'hybrid', 'electric']),
	status: z.enum(['active', 'maintenance', 'inactive']),
	assignedDriverId: z.string(),
	costCenter: z.string().min(1),
	mileageKm: z.number().min(0),
})

export const serviceIdSchema = z.enum(['fuel', 'charging', 'parking', 'fines', 'wash', 'tolls', 'area_c', 'taxi'])

export const transactionPayloadSchema = z
	.object({
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		driverId: z.string().min(1),
		vehicleId: z.string().min(1),
		service: serviceIdSchema,
		provider: z.string().trim().min(1),
		amount: z.number().positive(),
		vat: z.number().min(0),
		expenseType: z.enum(['business', 'personal']),
	})
	.refine((payload) => payload.vat <= payload.amount, { message: 'VAT cannot exceed the transaction amount', path: ['vat'] })

export const driverTransactionPayloadSchema = z
	.object({
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		service: serviceIdSchema,
		provider: z.string().trim().min(1),
		amount: z.number().positive(),
		vat: z.number().min(0),
		expenseType: z.enum(['business', 'personal']),
	})
	.refine((payload) => payload.vat <= payload.amount, { message: 'VAT cannot exceed the transaction amount', path: ['vat'] })

export const transactionReviewSchema = z
	.object({
		status: z.enum(['approved', 'rejected']),
		expenseType: z.enum(['business', 'personal']),
		rejectionReason: z.string().trim().max(500).optional(),
	})
	.superRefine((payload, context) => {
		if (payload.status === 'rejected' && !payload.rejectionReason) {
			context.addIssue({ code: 'custom', message: 'A rejection reason is required', path: ['rejectionReason'] })
		}
	})
