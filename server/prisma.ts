import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://fleetops:fleetops@localhost:5432/fleetops',
})

export const prisma = new PrismaClient({ adapter })
