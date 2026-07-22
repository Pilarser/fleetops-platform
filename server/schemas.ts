import { z } from 'zod'

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
})

export const driverStatusSchema = z.enum(['active', 'suspended'])
export const vehicleStatusSchema = z.enum(['active', 'maintenance', 'inactive'])
export const fuelTypeSchema = z.enum(['diesel', 'petrol', 'hybrid', 'electric'])

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
