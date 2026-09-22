import { z } from 'zod'

export const driverStatusSchema = z.enum(['active', 'suspended'])
export const vehicleStatusSchema = z.enum(['active', 'maintenance', 'inactive'])
export const fuelTypeSchema = z.enum(['diesel', 'petrol', 'hybrid', 'electric'])
export const serviceIdSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/, 'Invalid service identifier')
export const currencySchema = z.string().trim().regex(/^[A-Za-z]{3}$/, 'Currency must be a three-letter ISO code').transform((value) => value.toUpperCase())
export const expenseTypeSchema = z.enum(['business', 'personal'])

export const driverPayloadSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	status: driverStatusSchema,
	vehicleId: z.string(),
	costCenter: z.string().min(1),
})

export const vehiclePayloadSchema = z.object({
	plate: z.string().min(1),
	make: z.string().min(1),
	model: z.string().min(1),
	fuelType: fuelTypeSchema,
	status: vehicleStatusSchema,
	assignedDriverId: z.string(),
	costCenter: z.string().min(1),
	mileageKm: z.number().min(0),
})

const expenseAmountsSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	service: serviceIdSchema,
	provider: z.string().trim().min(1),
	amount: z.number().positive(),
	vat: z.number().min(0),
	currency: currencySchema.default('EUR'),
	expenseType: expenseTypeSchema,
})

export const expensePayloadSchema = expenseAmountsSchema
	.extend({
		driverId: z.string().min(1),
		vehicleId: z.string().min(1),
	})
	.refine((payload) => payload.vat <= payload.amount, { message: 'VAT cannot exceed the expense amount', path: ['vat'] })

export const driverExpensePayloadSchema = expenseAmountsSchema
	.refine((payload) => payload.vat <= payload.amount, { message: 'VAT cannot exceed the expense amount', path: ['vat'] })

export const expenseReviewSchema = z.object({
	status: z.enum(['approved', 'rejected']),
	expenseType: expenseTypeSchema,
	rejectionReason: z.string().trim().max(500).optional(),
}).superRefine((payload, context) => {
	if (payload.status === 'rejected' && !payload.rejectionReason) {
		context.addIssue({ code: 'custom', message: 'A rejection reason is required', path: ['rejectionReason'] })
	}
})

// Compatibility aliases for existing API consumers.
export const transactionPayloadSchema = expensePayloadSchema
export const driverTransactionPayloadSchema = driverExpensePayloadSchema
export const transactionReviewSchema = expenseReviewSchema
