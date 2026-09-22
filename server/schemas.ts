import { z } from 'zod'

export {
	currencySchema,
	driverExpensePayloadSchema,
	driverPayloadSchema,
	driverStatusSchema,
	driverTransactionPayloadSchema,
	expensePayloadSchema,
	expenseReviewSchema,
	expenseTypeSchema,
	fuelTypeSchema,
	serviceIdSchema,
	transactionPayloadSchema,
	transactionReviewSchema,
	vehiclePayloadSchema,
	vehicleStatusSchema,
} from '../shared/schemas'

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
})
