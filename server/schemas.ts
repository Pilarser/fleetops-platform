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
